import type { HubDataStore } from "@hub/db";

export interface HubMcpServerOptions {
  store: HubDataStore;
  /** User ID resolved from auth token / session */
  userId: string;
}

export type { HubMcpServerOptions as McpServerOptions };
