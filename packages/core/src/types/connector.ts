/** Supported connector types — extensible via plugin registry */
export type ConnectorType =
  | "google_drive"
  | "gmail"
  | "google_calendar"
  | "outlook"
  | "sharepoint"
  | "priority"
  | "crm"
  | "custom_rest";

export type ConnectorStatus = "active" | "inactive" | "error" | "pending_auth";

/** A configured connection to an external data source within a tenant */
export interface Connection {
  id: string;
  tenantId: string;
  type: ConnectorType;
  name: string;
  status: ConnectorStatus;
  /** Encrypted credentials — never exposed to MCP clients */
  credentialsRef: string;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** Capability exposed by a connector (maps to MCP tools) */
export interface ConnectorCapability {
  id: string;
  connectorType: ConnectorType;
  toolName: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
