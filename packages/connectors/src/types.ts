import type { ConnectorCapability, ConnectorType, Connection } from "@hub/core";

export interface ToolExecutionContext {
  connection: Connection;
  userId: string;
  tenantId: string;
}

export interface ToolExecutionResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** Plugin interface — every connector implements this */
export interface ConnectorPlugin {
  type: ConnectorType;
  displayName: string;
  /** Capabilities this connector exposes as MCP tools */
  getCapabilities(): ConnectorCapability[];
  /** Execute a tool by name with the given arguments */
  executeTool(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext
  ): Promise<ToolExecutionResult>;
  /** Validate connection credentials (called during setup) */
  validateConnection?(connection: Connection): Promise<boolean>;
}
