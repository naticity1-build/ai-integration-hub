import type { ConnectorPlugin, ToolExecutionContext, ToolExecutionResult } from "../types.js";
import { fetchConnectionSecrets } from "../secrets.js";
import { buildAuthHeaders } from "../http-auth.js";
import { resolveConnectionAuthType } from "../metadata.js";
import type { ConnectionAuthType } from "../auth-types.js";

const CUSTOM_REST_SCHEMA = {
  type: "object",
  properties: {
    endpoint: { type: "string", description: "API endpoint path" },
    method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"], default: "GET" },
    body: { type: "object", description: "Request body for POST/PUT/PATCH" },
    headers: { type: "object", description: "Additional request headers" },
  },
  required: ["endpoint"],
};

function getAuthType(connection: { config: Record<string, unknown> }): ConnectionAuthType {
  return resolveConnectionAuthType("custom_rest", connection.config.authType);
}

export const customRestConnector: ConnectorPlugin = {
  type: "custom_rest",
  displayName: "Custom REST API",

  getCapabilities() {
    return [
      {
        id: "rest-query",
        connectorType: "custom_rest",
        toolName: "query_api",
        description: "Query a custom REST API endpoint",
        inputSchema: CUSTOM_REST_SCHEMA,
      },
    ];
  },

  async validateConnection(connection) {
    const baseUrl = connection.config.baseUrl as string | undefined;
    if (!baseUrl) return false;
    try {
      const secrets = await fetchConnectionSecrets(connection.id);
      const authType = getAuthType(connection);
      const headers = buildAuthHeaders(authType, secrets);
      const res = await fetch(baseUrl, { method: "HEAD", headers });
      return res.ok || res.status === 404 || res.status === 405;
    } catch {
      return false;
    }
  },

  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    if (toolName !== "query_api") {
      return { content: [{ type: "text", text: `Unknown tool: ${toolName}` }], isError: true };
    }

    const baseUrl = (ctx.connection.config.baseUrl as string) ?? "https://api.example.com";
    const method = (args.method as string) ?? "GET";
    const endpoint = args.endpoint as string;
    const url = `${baseUrl.replace(/\/$/, "")}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const secrets = await fetchConnectionSecrets(ctx.connection.id);
    const authType = getAuthType(ctx.connection);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...buildAuthHeaders(authType, secrets),
      ...((args.headers as Record<string, string>) ?? {}),
    };

    if (authType === "oauth" && secrets?.access_token) {
      headers.Authorization = `Bearer ${secrets.access_token as string}`;
    }

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: ["POST", "PUT", "PATCH"].includes(method) && args.body
          ? JSON.stringify(args.body)
          : undefined,
      });

      const text = await res.text();
      const preview = text.length > 4000 ? `${text.slice(0, 4000)}... [truncated]` : text;

      return {
        content: [
          {
            type: "text",
            text: `[REST] ${method} ${url}\nStatus: ${res.status}\n\n${preview}`,
          },
        ],
        isError: !res.ok,
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Request failed: ${err instanceof Error ? err.message : "Unknown error"}` }],
        isError: true,
      };
    }
  },
};

// Backward-compatible re-export
export { setSecretFetcher } from "../secrets.js";
