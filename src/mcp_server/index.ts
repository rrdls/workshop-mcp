import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { extractContentFromUrl, getAllDocUrls } from "./utils";
import { chromaClient, embeddings } from "./embedding";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const server = new McpServer({
  name: "doc-ingestor-server",
  version: "1.0.0",
});

server.registerTool(
  "get-all-urls-from-docs",
  {
    title: "Get All URLS from docs",
    description:
      "Scrape content from a library documentation URL and get all documentation links (URLS)",
    inputSchema: {
      url: z.string().url(),
    },
  },
  async ({ url }) => {
    const allUrls = await getAllDocUrls(url);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(allUrls, null, 2),
        },
      ],
    };
  }
);

server.registerTool(
  "get-text-content-from-url",
  {
    title: "Get text content from url",
    description: "Scrape text content from a library documentation URL",
    inputSchema: {
      url: z.string().url(),
    },
  },
  async ({ url }) => {
    const document = await extractContentFromUrl(url);

    return {
      content: [
        {
          type: "text",
          text: document?.pageContent || "",
        },
      ],
    };
  }
);

server.registerTool(
  "get-multiple-text-content-from-urls",
  {
    title: "Get multiples text content from urls",
    description: "Scrape text content from a library documentation URLS",
    inputSchema: {
      urls: z.array(z.string().url()),
    },
  },
  async ({ urls }) => {
    const documents = await Promise.all(
      urls.map((url) => extractContentFromUrl(url))
    );

    const textContent = documents.map((document) => document?.pageContent);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(textContent, null, 2),
        },
      ],
    };
  }
);

server.registerTool(
  "store-snippet-in-chromadb",
  {
    title: "Store short snippets in vector databases (chomadb)",
    description: "Store a small snippets in vector databases (chomadb)",
    inputSchema: {
      snippets: z.array(
        z.object({
          title: z.string({
            description:
              "Short, clear title describing what the snippet demonstrates",
          }),
          description: z.string({
            description:
              "Brief explanation of what the snippet does and why it matters (mention functions, hooks, behaviors, etc.)",
          }),
          source: z.string({ description: "source URL" }),
          language: z.string({
            description:
              "language name (e.g., 'Python', 'Javascript', 'Css', 'HTML', ...)",
          }),
          code: z.string({
            description: "A small snippet of codeShort code as a string",
          }),
        })
      ),
    },
  },
  async ({ snippets }) => {
    const snippetCollection = await chromaClient.getOrCreateCollection({
      name: "snippet",
      metadata: { "hnsw:space": "cosine" },
    });

    const formattedSnippets = snippets.map(
      (snippet) =>
        `TITLE: ${snippet.title}
           DESCRIPTION: ${snippet.description}
           SOURCE: ${snippet.source}
           LANGUAGE: ${snippet.language}
           CODE:
            \`\`\`
            ${snippet.code}
            \`\`\``
    );

    const docEmbeddings = await embeddings.embedDocuments(
      formattedSnippets.map((snippet) => snippet)
    );

    await snippetCollection.add({
      ids: formattedSnippets.map(() => uuidv4()),
      documents: formattedSnippets,
      embeddings: docEmbeddings,
      metadatas: snippets.map(({ source }) => ({
        source,
      })),
    });

    return {
      content: [
        {
          type: "text",
          text: `${docEmbeddings.length} snippets saved`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Erro ao iniciar o servidor:", err);
  process.exit(1);
});
