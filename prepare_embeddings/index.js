import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fs from 'fs/promises';
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";

main()
  .catch((error) => console.error('Error processing documents:', error));

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Provide the path to the JSON files directory as an argument.');
    process.exit(1);
  }
  console.log('Loading documents from', path);

  const documents = await getDocumentsFromJsonFiles(path);
  console.log('Documents loaded:', documents.length);
  
  const chunks = await chunkify(documents);
  console.log('Chunks created:', chunks.length);

  await createEmbeddings(chunks);
  console.log('Embeddings created and stored successfully.');
}

function getSupabaseClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase URL and Service Role Key must be set in environment variables.');
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);
  return supabase;
}

async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

function objectToDocument(object) {
  const fullText = `
Title: ${object.title}
Artist: ${object.artist}
Dated: ${object.dated}
Department: ${object.department}
Description: ${object.description}
Medium: ${object.medium}
Dimensions: ${object.dimensions}
Credit Line: ${object.creditLine}
Style: ${object.style}
Text: ${object.text}
`.trim();
  return new Document({ pageContent: fullText });
}

async function getDocumentsFromJsonFiles(dir, documents = []) {
  const files = await fs.readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const res = `${dir}/${file.name}`;
    if (file.isDirectory()) {
      await getDocumentsFromJsonFiles(res, documents);
    } else if (file.isFile() && file.name.endsWith('.json')) {
      const jsonData = await readJsonFile(res);
      if (jsonData) {
        const document = objectToDocument(jsonData);
        documents.push(document);
      }
    }
  }
  return documents;
}

async function chunkify(documents) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });
  return splitter.splitDocuments(documents);
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4); // rough estimate
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(fn, maxRetries = 5) {
  let attempt = 0;
  let delay = 2000;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (err.status === 429 && attempt < maxRetries) {
        console.warn(`Rate limit hit, retrying in ${delay}ms...`);
        await sleep(delay);
        attempt++;
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
}

async function createEmbeddings(chunks) {
  const supabase = getSupabaseClient();
  const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
  const maxTokensPerBatch = 290_000; // Stay under OpenAI's 300k/request limit
  let batch = [];
  let batchTokens = 0;
  let batchCount = 0;
  let totalChunks = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const tokens = estimateTokens(chunk.pageContent);
    if (batchTokens + tokens > maxTokensPerBatch && batch.length > 0) {
      batchCount++;
      console.log(`Sending batch #${batchCount} with ${batch.length} chunks, ~${batchTokens} tokens`);
      await withRetry(() =>
        SupabaseVectorStore.fromDocuments(batch, embeddings, {
          client: supabase,
          tableName: 'documents',
          queryName: 'match_documents',
        })
      );
      totalChunks += batch.length;
      await sleep(2000);
      // Start new batch
      batch = [];
      batchTokens = 0;
    }
    batch.push(chunk);
    batchTokens += tokens;
  }
  // Send any remaining batch
  if (batch.length > 0) {
    batchCount++;
    console.log(`Sending batch #${batchCount} with ${batch.length} chunks, ~${batchTokens} tokens`);
    await withRetry(() =>
      SupabaseVectorStore.fromDocuments(batch, embeddings, {
        client: supabase,
        tableName: 'documents',
        queryName: 'match_documents',
      })
    );
    totalChunks += batch.length;
  }
  console.log(`All batches sent. Total chunks processed: ${totalChunks}`);
}
