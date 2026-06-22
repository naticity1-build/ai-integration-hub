#!/usr/bin/env node
import { createHubStore, DEMO_USER_ID, wireCredentialResolver } from "@hub/db";
import { resolveUserFromMcpToken } from "@hub/auth";
import { startHubMcpServer } from "./server.js";
import { startHttpMcpServer } from "./http.js";

const store = createHubStore();
wireCredentialResolver(store);

let userId = process.env.HUB_USER_ID ?? DEMO_USER_ID;

if (process.env.HUB_MCP_TOKEN) {
  const resolved = await resolveUserFromMcpToken(process.env.HUB_MCP_TOKEN, store);
  if (resolved) {
    userId = resolved.userId;
  } else {
    console.error("Invalid or expired HUB_MCP_TOKEN");
    process.exit(1);
  }
}

const transport = process.env.MCP_TRANSPORT ?? "stdio";

if (transport === "http") {
  await startHttpMcpServer({ store, defaultUserId: userId });
} else if (transport === "both") {
  void startHttpMcpServer({ store, defaultUserId: userId });
  await startHubMcpServer({ store, userId });
} else {
  await startHubMcpServer({ store, userId });
}
