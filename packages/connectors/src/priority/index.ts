import type { ConnectorPlugin, ToolExecutionContext, ToolExecutionResult } from "../types.js";
import { fetchConnectionSecrets } from "../secrets.js";
import { buildAuthHeaders } from "../http-auth.js";
import { resolveConnectionAuthType } from "../metadata.js";
import type { ConnectionAuthType } from "../auth-types.js";

const QUERY_SCHEMA = {
  type: "object",
  properties: {
    form: { type: "string", description: "Priority form/table name" },
    filter: { type: "string", description: "OData-style filter expression" },
    select: { type: "string", description: "Fields to select" },
    top: { type: "number", description: "Max records to return", default: 10 },
  },
  required: ["form"],
};

function getAuthType(connection: { config: Record<string, unknown> }): ConnectionAuthType {
  return resolveConnectionAuthType("priority", connection.config.authType);
}

export const priorityConnector: ConnectorPlugin = {
  type: "priority",
  displayName: "Priority ERP",

  getCapabilities() {
    return [
      {
        id: "priority-query",
        connectorType: "priority",
        toolName: "query_records",
        description: "Query records from a Priority ERP form",
        inputSchema: QUERY_SCHEMA,
      },
    ];
  },

  async validateConnection(connection) {
    const baseUrl = connection.config.baseUrl as string | undefined;
    const company = connection.config.company as string | undefined;
    if (!baseUrl || !company) return false;

    const secrets = await fetchConnectionSecrets(connection.id);
    const authType = getAuthType(connection);
    const headers = buildAuthHeaders(authType, secrets);
    const url = `${baseUrl.replace(/\/$/, "")}/${company}`;

    try {
      const res = await fetch(url, { method: "GET", headers });
      return res.ok;
    } catch {
      return false;
    }
  },

  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    if (toolName !== "query_records") {
      return { content: [{ type: "text", text: `Unknown tool: ${toolName}` }], isError: true };
    }

    const baseUrl = (ctx.connection.config.baseUrl as string) ?? "";
    const company = (ctx.connection.config.company as string) ?? "";
    const form = args.form as string;
    const params = new URLSearchParams();
    if (args.filter) params.set("$filter", args.filter as string);
    if (args.select) params.set("$select", args.select as string);
    if (args.top) params.set("$top", String(args.top));

    const secrets = await fetchConnectionSecrets(ctx.connection.id);
    const authType = getAuthType(ctx.connection);
    const headers = buildAuthHeaders(authType, secrets);

    const url = `${baseUrl.replace(/\/$/, "")}/${company}/${form}?${params}`;
    try {
      const res = await fetch(url, { headers });
      const text = await res.text();
      if (!res.ok) {
        return { content: [{ type: "text", text: `Priority API error ${res.status}: ${text}` }], isError: true };
      }
      return { content: [{ type: "text", text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      return { content: [{ type: "text", text: message }], isError: true };
    }
  },
};
