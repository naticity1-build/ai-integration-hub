import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { PermissionEngine } from "@hub/core";
import { globalRegistry, registerBuiltInConnectors } from "@hub/connectors";
import type { HubDataStore } from "@hub/db";

export interface HubMcpServerOptions {
  store: HubDataStore;
  /** User ID resolved from auth token / session */
  userId: string;
}

/**
 * Creates an MCP server that dynamically exposes tools
 * based on the user's permissions and active tenant connections.
 */
export function createHubMcpServer(options: HubMcpServerOptions): Server {
  registerBuiltInConnectors();

  const { store, userId } = options;
  const permissionEngine = new PermissionEngine();

  const server = new Server(
    {
      name: "ai-integration-hub",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const user = await store.getUserContext(userId);
    if (!user) {
      return { tools: [] };
    }

    const [connections, grants] = await Promise.all([
      store.getActiveConnections(user.tenantId),
      store.getPermissionGrants(user.tenantId),
    ]);

    const capabilities = globalRegistry.getAllCapabilities();
    const resolved = permissionEngine.resolveTools({
      user,
      grants,
      activeConnections: connections,
      capabilities,
    });

    return {
      tools: resolved.map((tool) => ({
        name: tool.toolName,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const user = await store.getUserContext(userId);
    if (!user) {
      return {
        content: [{ type: "text" as const, text: "Unauthorized: user not found" }],
        isError: true,
      };
    }

    const { name: toolName, arguments: args } = request.params;
    const [connections, grants] = await Promise.all([
      store.getActiveConnections(user.tenantId),
      store.getPermissionGrants(user.tenantId),
    ]);

    const capabilities = globalRegistry.getAllCapabilities();
    const resolved = permissionEngine.resolveTools({
      user,
      grants,
      activeConnections: connections,
      capabilities,
    });

    const tool = resolved.find((t) => t.toolName === toolName);
    if (!tool) {
      await store.logAudit({
        tenantId: user.tenantId,
        userId: user.userId,
        action: "tool_denied",
        toolName,
        metadata: { reason: "permission_denied" },
      });
      return {
        content: [{ type: "text" as const, text: `Access denied: ${toolName}` }],
        isError: true,
      };
    }

    const plugin = globalRegistry.get(tool.connectorType);
    if (!plugin) {
      return {
        content: [{ type: "text" as const, text: `Connector not found: ${tool.connectorType}` }],
        isError: true,
      };
    }

    const connection = connections.find((c) => c.id === tool.connectionId);
    if (!connection) {
      return {
        content: [{ type: "text" as const, text: "Connection not found" }],
        isError: true,
      };
    }

    await store.logAudit({
      tenantId: user.tenantId,
      userId: user.userId,
      action: "tool_invoked",
      connectorType: tool.connectorType,
      toolName,
      metadata: { connectionId: connection.id },
    });

    const result = await plugin.executeTool(
      toolName,
      (args as Record<string, unknown>) ?? {},
      {
        connection,
        userId: user.userId,
        tenantId: user.tenantId,
      }
    );

    return result as CallToolResult;
  });

  return server;
}

export async function startHubMcpServer(options: HubMcpServerOptions): Promise<void> {
  const server = createHubMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
