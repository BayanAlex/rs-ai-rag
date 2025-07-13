import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import 'dotenv/config';

const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });

const docs = [
  { pageContent: "The Mona Lisa is a famous painting by Leonardo da Vinci.", metadata: { source: "test-script", tag: "art" } },
  { pageContent: "Starry Night was painted by Vincent van Gogh.", metadata: { source: "test-script", tag: "art" } },
  { pageContent: "The Eiffel Tower is in Paris.", metadata: { source: "test-script", tag: "landmark" } },
];

(async () => {
  // Insert documents
  const faiss = await FaissStore.fromDocuments(docs, embeddings);
  console.log("Inserted test documents into FAISS.");

  // Perform similarity search
  const query = "Who painted the Mona Lisa?";
  const results = await faiss.similaritySearchWithScore(query, 2);
  console.log("Similarity search results:");
  for (const [doc, score] of results) {
    console.log(`Score: ${score.toFixed(3)} | Content: ${doc.pageContent}`);
  }
})();