import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createHubMcpServer } from "./server.js";
import type { HubDataStore, HubStore } from "@hub/db";
import { resolveUserFromMcpToken } from "@hub/auth";

export interface HttpMcpServerOptions {
  store: HubDataStore;
  defaultUserId: string;
  port?: number;
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60_000;

function log(level: string, message: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ level, message, ...meta, ts: new Date().toISOString() }));
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

async function resolveUserId(
  req: IncomingMessage,
  store: HubDataStore,
  defaultUserId: string
): Promise<string | null> {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const resolved = await resolveUserFromMcpToken(token, store as HubStore);
    if (resolved) return resolved.userId;
  }
  return defaultUserId || null;
}

export async function startHttpMcpServer(options: HttpMcpServerOptions): Promise<void> {
  const port = options.port ?? Number(process.env.PORT ?? process.env.MCP_HTTP_PORT ?? 3100);
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", transport: "streamable-http" }));
      return;
    }

    if (url.pathname !== "/mcp") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const userId = await resolveUserId(req, options.store, options.defaultUserId);
    if (!userId) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    if (!checkRateLimit(userId)) {
      log("warn", "rate_limit_exceeded", { userId });
      res.writeHead(429);
      res.end(JSON.stringify({ error: "Rate limit exceeded" }));
      return;
    }

    const sessionId = (req.headers["mcp-session-id"] as string) ?? randomUUID();
    let transport = sessions.get(sessionId);

    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId,
      });
      sessions.set(sessionId, transport);

      const mcpServer = createHubMcpServer({ store: options.store, userId });
      await mcpServer.connect(transport);

      transport.onclose = () => {
        sessions.delete(sessionId);
        log("info", "mcp_session_closed", { sessionId, userId });
      };

      log("info", "mcp_session_created", { sessionId, userId });
    }

    await transport.handleRequest(req, res);
  });

  await new Promise<void>((resolve) => {
    server.listen(port, "0.0.0.0", () => {
      log("info", "mcp_http_server_started", { port, host: "0.0.0.0" });
      resolve();
    });
  });
}
