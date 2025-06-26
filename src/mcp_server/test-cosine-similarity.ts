import { chromaClient, embeddings } from "./embedding";
import { v4 as uuidv4 } from "uuid";

const snippetCollection = await chromaClient.getOrCreateCollection({
  name: "snippet",
  metadata: { "hnsw:space": "cosine" },
});

const docs = [
  {
    pageContent: "The powerhouse of the cell is the mitochondria",
    metadata: { source: "https://example.com" },
  },
  {
    pageContent: "Buildings are made out of brick",
    metadata: { source: "https://example.com" },
  },
  {
    pageContent: "Mitochondria are made out of lipids",
    metadata: { source: "https://example.com" },
  },
  {
    pageContent: "The 2024 Olympics are in Paris",
    metadata: { source: "https://example.com" },
  },
];

const docEmbeddings = await embeddings.embedDocuments(
  docs.map((d) => d.pageContent)
);

await snippetCollection.add({
  ids: docs.map(() => uuidv4()),
  documents: docs.map((d) => d.pageContent),
  embeddings: docEmbeddings,
  metadatas: docs.map((d) => d.metadata),
});

console.log("Done !");

const queryVec = await embeddings.embedQuery("construções");
const results = await snippetCollection.query({
  queryEmbeddings: [queryVec],
  nResults: 2,
  where: { source: "https://example.com" },
});

results.ids[0].forEach((id, idx) => {
  const score = results.distances[0][idx];
  const content = results.documents[0][idx];
  console.log(`[${score?.toFixed(3)}] ${content}`);
});
