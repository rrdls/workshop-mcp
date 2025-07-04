import express from "express";
import { randomUUID } from "node:crypto";
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import z from "zod";
import * as dotenv from "dotenv";
dotenv.config();
console.log(process.env);

export const getServer = () => {
  const server = new McpServer(
    {
      name: "simple-streamable-http-server",
      version: "1.0.0",
    },
    { capabilities: { logging: {} } }
  );
  // Register a simple tool that returns a greeting
  server.registerTool(
    "greet",
    {
      title: "Greeting Tool", // Display name for UI
      description: "A simple greeting tool",
      inputSchema: {
        name: z.string().describe("Name to greet"),
      },
    },
    async ({ name }) => {
      return {
        content: [
          {
            type: "text",
            text: `Hello, ${name}!`,
          },
        ],
      };
    }
  );
  // Register a tool that sends multiple greetings with notifications (with annotations)
  server.tool(
    "multi-greet",
    "A tool that sends different greetings with delays between them",
    {
      name: z.string().describe("Name to greet"),
    },
    {
      title: "Multiple Greeting Tool",
      readOnlyHint: true,
      openWorldHint: false,
    },
    async ({ name }, { sendNotification }) => {
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));
      await sendNotification({
        method: "notifications/message",
        params: { level: "debug", data: `Starting multi-greet for ${name}` },
      });
      await sleep(1000); // Wait 1 second before first greeting
      await sendNotification({
        method: "notifications/message",
        params: { level: "info", data: `Sending first greeting to ${name}` },
      });
      await sleep(1000); // Wait another second before second greeting
      await sendNotification({
        method: "notifications/message",
        params: { level: "info", data: `Sending second greeting to ${name}` },
      });
      return {
        content: [
          {
            type: "text",
            text: `Good morning, ${name}!`,
          },
        ],
      };
    }
  );

  // Register a simple prompt with title
  server.registerPrompt(
    "greeting-template",
    {
      title: "Greeting Template", // Display name for UI
      description: "A simple greeting prompt template",
      argsSchema: {
        name: z.string().describe("Name to include in greeting"),
      },
    },
    async ({ name }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please greet ${name} in a friendly manner.`,
            },
          },
        ],
      };
    }
  );
  // Register a tool specifically for testing resumability
  server.tool(
    "start-notification-stream",
    "Starts sending periodic notifications for testing resumability",
    {
      interval: z
        .number()
        .describe("Interval in milliseconds between notifications")
        .default(100),
      count: z
        .number()
        .describe("Number of notifications to send (0 for 100)")
        .default(50),
    },
    async ({ interval, count }, { sendNotification }) => {
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));
      let counter = 0;
      while (count === 0 || counter < count) {
        counter++;
        try {
          await sendNotification({
            method: "notifications/message",
            params: {
              level: "info",
              data: `Periodic notification #${counter} at ${new Date().toISOString()}`,
            },
          });
        } catch (error) {
          console.error("Error sending notification:", error);
        }
        // Wait for the specified interval
        await sleep(interval);
      }
      return {
        content: [
          {
            type: "text",
            text: `Started sending periodic notifications every ${interval}ms`,
          },
        ],
      };
    }
  );
  // Create a simple resource at a fixed URI
  server.registerResource(
    "greeting-resource",
    "https://example.com/greetings/default",
    {
      title: "Default Greeting", // Display name for UI
      description: "A simple greeting resource",
      mimeType: "text/plain",
    },
    async () => {
      return {
        contents: [
          {
            uri: "https://example.com/greetings/default",
            text: "Hello, world!",
          },
        ],
      };
    }
  );
  // Create additional resources for ResourceLink demonstration
  server.registerResource(
    "example-file-1",
    "file:///example/file1.txt",
    {
      title: "Example File 1",
      description: "First example file for ResourceLink demonstration",
      mimeType: "text/plain",
    },
    async () => {
      return {
        contents: [
          {
            uri: "file:///example/file1.txt",
            text: "This is the content of file 1",
          },
        ],
      };
    }
  );
  server.registerResource(
    "example-file-2",
    "file:///example/file2.txt",
    {
      title: "Example File 2",
      description: "Second example file for ResourceLink demonstration",
      mimeType: "text/plain",
    },
    async () => {
      return {
        contents: [
          {
            uri: "file:///example/file2.txt",
            text: "This is the content of file 2",
          },
        ],
      };
    }
  );
  // Register a tool that returns ResourceLinks
  server.registerTool(
    "list-files",
    {
      title: "List Files with ResourceLinks",
      description:
        "Returns a list of files as ResourceLinks without embedding their content",
      inputSchema: {
        includeDescriptions: z
          .boolean()
          .optional()
          .describe("Whether to include descriptions in the resource links"),
      },
    },
    async (args: any) => {
      const resourceLinks = [
        {
          type: "resource_link",
          uri: "https://example.com/greetings/default",
          name: "Default Greeting",
          mimeType: "text/plain",
          ...(args.includeDescriptions && {
            description: "A simple greeting resource",
          }),
        },
        {
          type: "resource_link",
          uri: "file:///example/file1.txt",
          name: "Example File 1",
          mimeType: "text/plain",
          ...(args.includeDescriptions && {
            description: "First example file for ResourceLink demonstration",
          }),
        },
        {
          type: "resource_link",
          uri: "file:///example/file2.txt",
          name: "Example File 2",
          mimeType: "text/plain",
          ...(args.includeDescriptions && {
            description: "Second example file for ResourceLink demonstration",
          }),
        },
      ];
      return {
        content: [
          {
            type: "text",
            text: "Here are the available files as resource links:",
          },
          ...resourceLinks,
          {
            type: "text",
            text: "\nYou can read any of these resources using their URI.",
          },
        ],
      };
    }
  );
  return server;
};

const app = express();
app.use(express.json());
const MCP_PORT = 3001;
// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// MCP POST endpoint with optional auth
const mcpPostHandler = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  console.log(
    sessionId
      ? `Received MCP request for session: ${sessionId}`
      : "Received MCP request:",
    req.body
  );

  try {
    let transport: StreamableHTTPServerTransport;
    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID when session is initialized
          // This avoids race conditions where requests might come in before the session is stored
          console.log(`Session initialized with ID: ${sessionId}`);
          transports[sessionId] = transport;
        },
      });

      // Set up onclose handler to clean up transport when closed
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(
            `Transport closed for session ${sid}, removing from transports map`
          );
          delete transports[sid];
        }
      };

      // Connect the transport to the MCP server BEFORE handling the request
      // so responses can flow back through the same transport
      const server = getServer();
      await server.connect(transport);

      await transport.handleRequest(req, res, req.body);
      return; // Already handled
    } else {
      // Invalid request - no session ID or not initialization request
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }

    // Handle the request with existing transport - no need to reconnect
    // The existing transport is already connected to the server
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
};

app.post("/mcp", mcpPostHandler);

// Handle GET requests for SSE streams (using built-in support from StreamableHTTP)
const mcpGetHandler = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  // Check for Last-Event-ID header for resumability
  const lastEventId = req.headers["last-event-id"] as string | undefined;
  if (lastEventId) {
    console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
  } else {
    console.log(`Establishing new SSE stream for session ${sessionId}`);
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
};

app.get("/mcp", mcpGetHandler);

// Handle DELETE requests for session termination (according to MCP spec)
const mcpDeleteHandler = async (
  req: express.Request,
  res: express.Response
) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  console.log(`Received session termination request for session ${sessionId}`);

  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("Error handling session termination:", error);
    if (!res.headersSent) {
      res.status(500).send("Error processing session termination");
    }
  }
};

app.delete("/mcp", mcpDeleteHandler);

app.listen(MCP_PORT, () => {
  console.log(`MCP Streamable HTTP Server listening on port ${MCP_PORT}`);
});

// Handle server shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");

  // Close all active transports to properly clean up resources
  for (const sessionId in transports) {
    try {
      console.log(`Closing transport for session ${sessionId}`);
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }
  console.log("Server shutdown complete");
  process.exit(0);
});
