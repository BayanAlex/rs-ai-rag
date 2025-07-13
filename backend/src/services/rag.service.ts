/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { RunnableSequence } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { formatDocumentsAsString } from 'langchain/util/document';
import { RagCacheService } from './rag-cache.service';
import { Document } from '@langchain/core/documents';

export interface RagQueryRequest {
  query: string;
  maxResults?: number;
  similarityThreshold?: number;
}

export interface RagQueryResponse {
  answer: string;
  sources: string[];
}

const errorAnswer =
  "Sorry. I don't have enough information to answer that question.";

const promptTemplate = `
You are an AI assistant that helps answer questions based on the provided context about artworks and cultural objects.

Context:
{context}

Question: {question}

Instructions:
- Use the provided context to answer the question accurately
- Be concise but informative
- Focus on the most relevant information from the context
- If discussing artworks, mention specific details like artist, title, date, or medium when available
- Add short sources info list that you used from the context at the end of your answer
- Format response in JSON with the following structure:
{{
  "answer": "Your answer here",
  "sources": ["Title and Artist of the first source used", "Title and Artist of the second source used", ...]
}}
- Format the answer as HTML if possible, using <b> for bold text and <i> for italic text
- If you cannot find relevant information, return:
{{
  "answer": "${errorAnswer}",
  "sources": []
}}
`;

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private vectorStore: FaissStore;
  private embeddings: OpenAIEmbeddings;
  private llm: ChatOpenAI;
  private ragChain: RunnableSequence;

  constructor(
    private configService: ConfigService,
    private cache: RagCacheService,
  ) {
    void this.init();
  }

  private async init() {
    try {
      const openAIApiKey = this.configService.get<string>('OPENAI_API_KEY');
      if (!openAIApiKey) {
        throw new Error('OpenAI API key is missing');
      }

      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey,
        modelName: 'text-embedding-ada-002',
      });

      this.llm = new ChatOpenAI({
        openAIApiKey,
        modelName: 'gpt-4.1',
        temperature: 0.7,
        maxTokens: 1000,
      });

      // Load FAISS vector store from disk
      this.vectorStore = await FaissStore.load(
        '../faiss.index',
        this.embeddings,
      );

      this.initializeRagChain();

      this.logger.log('RAG service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize RAG service', error);
      throw error;
    }
  }

  private initializeRagChain() {
    const ragPrompt = PromptTemplate.fromTemplate(promptTemplate);

    this.ragChain = RunnableSequence.from([
      (input: {
        question: string;
        documents: Document<Record<string, any>>[];
      }) => ({
        context:
          input.documents && input.documents.length > 0
            ? formatDocumentsAsString(input.documents)
            : 'No relevant context found.',
        question: input.question,
      }),
      ragPrompt,
      this.llm,
      new StringOutputParser(),
    ]);
  }

  async queryRag({
    query,
    maxResults = 10,
    similarityThreshold = 0.2,
  }: RagQueryRequest): Promise<RagQueryResponse> {
    const startTime = Date.now();

    const cached = this.cache.get(query);
    if (cached) {
      this.logger.log('Cache hit for query:', query);
      return cached;
    }

    try {
      this.logger.log(`Processing RAG query: "${query}"`);

      const searchResults = await this.vectorStore.similaritySearchWithScore(
        query,
        maxResults,
      );

      const relevantDocuments = searchResults
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .filter(([_, score]) => score >= similarityThreshold)
        .map(([doc, score]) => ({ doc, score }));

      this.logger.log(
        relevantDocuments.length
          ? `Found ${relevantDocuments.length} relevant documents:`
          : 'No relevant documents found.',
        relevantDocuments,
      );

      if (relevantDocuments.length === 0) {
        const result = { answer: errorAnswer, sources: [] };
        this.cache.set(query, result);
        return result;
      }

      const documents = relevantDocuments.map(({ doc }) => doc);
      let response: RagQueryResponse;
      try {
        const rawLlmResponse = (await this.ragChain.invoke({
          question: query,
          documents,
        })) as string;
        response = JSON.parse(rawLlmResponse) as RagQueryResponse;
      } catch (error) {
        this.logger.error('Error generating answer from RAG chain', error);
        throw new Error(
          'Failed to generate answer from RAG chain. Please try again later.',
        );
      }
      const processingTime = Date.now() - startTime;

      this.logger.log(`RAG query completed in ${processingTime}ms`);
      this.cache.set(query, response);
      return response;
    } catch (error) {
      this.logger.error('Error processing RAG query', error);
      throw new Error(`Failed to process RAG query: ${error.message}`);
    }
  }
}
