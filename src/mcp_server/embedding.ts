import { ChromaClient } from "chromadb";
import { OpenAIEmbeddings } from "@langchain/openai";

const chromaClient = new ChromaClient({ path: "http://localhost:8000" });

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
  openAIApiKey: process.env.OPENAI_API_KEY,
});

export { chromaClient, embeddings };
