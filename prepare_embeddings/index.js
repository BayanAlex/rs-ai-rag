import 'dotenv/config';
import fs from 'fs/promises';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { FaissStore } from '@langchain/community/vectorstores/faiss';

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

async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

function objectToDocument(object) {
  // Filter empty fields
  const fields = [
    { label: 'Title', value: object.title },
    { label: 'Artist', value: object.artist },
    { label: 'Dated', value: object.dated },
    { label: 'Department', value: object.department },
    { label: 'Description', value: object.description },
    { label: 'Medium', value: object.medium },
    { label: 'Country', value: object.country },
    { label: 'Dimensions', value: object.dimensions },
    { label: 'Credit Line', value: object.creditLine },
    { label: 'Style', value: object.style },
    { label: 'Text', value: object.text }
  ];
  const fullText = fields
    .filter(f => f.value !== undefined && f.value !== null && f.value !== '')
    .map(f => `${f.label}: ${f.value}`)
    .join('\n');

  return new Document({
    pageContent: fullText,
    metadata: {
      title: object.title || '',
      artist: object.artist || '',
      source: 'ingest-script'
    }
  });
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
    chunkOverlap: 50,
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
      // Retry on rate limit or connection errors
      if (
        (err.status === 429 || err.message?.includes('connect')) &&
        attempt < maxRetries
      ) {
        console.warn(`Error: ${err.message || err}. Retrying in ${delay}ms...`);
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
  const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
  const maxTokensPerBatch = 50_000; // Stay under OpenAI's 300k/request limit
  let batch = [];
  let batchTokens = 0;
  let batchCount = 0;
  let totalChunks = 0;
  let faiss = null;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const tokens = estimateTokens(chunk.pageContent);
    if (batchTokens + tokens > maxTokensPerBatch && batch.length > 0) {
      batchCount++;
      console.log(`Sending batch #${batchCount} with ${batch.length} chunks, ~${batchTokens} tokens`);
      if (!faiss) {
        faiss = await withRetry(() =>
          FaissStore.fromDocuments(batch, embeddings)
        );
      } else {
        const docs = [...batch];
        await withRetry(() => faiss.addDocuments(docs, embeddings));
      }
      totalChunks += batch.length;
      await sleep(5000);
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
    if (!faiss) {
      faiss = await withRetry(() =>
        FaissStore.fromDocuments(batch, embeddings)
      );
    } else {
      const docs = [...batch];
      await withRetry(() => faiss.addDocuments(docs, embeddings));
    }
    totalChunks += batch.length;
  }
  if (faiss) {
    await faiss.save('../faiss.index');
    console.log('FAISS index saved');
  }
  console.log(`All batches sent. Total chunks processed: ${totalChunks}`);
}
