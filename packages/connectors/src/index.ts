export * from "./types.js";
export * from "./registry.js";
export * from "./oauth.js";
export type { OAuthTokens, OAuthProvider } from "./oauth.js";
export * from "./credential-resolver.js";
export { googleDriveConnector, gmailConnector } from "./google/index.js";
export { googleCalendarConnector } from "./google/calendar.js";
export * from "./auth-types.js";
export * from "./http-auth.js";
export { setSecretFetcher, fetchConnectionSecrets } from "./secrets.js";
export type { SecretFetcher } from "./secrets.js";
export { customRestConnector } from "./custom-rest/index.js";
export { priorityConnector } from "./priority/index.js";

import { globalRegistry } from "./registry.js";
import { googleDriveConnector, gmailConnector } from "./google/index.js";
import { googleCalendarConnector } from "./google/calendar.js";
import { customRestConnector } from "./custom-rest/index.js";
import { priorityConnector } from "./priority/index.js";

/** Register all built-in connectors */
export function registerBuiltInConnectors(): void {
  globalRegistry.register(googleDriveConnector);
  globalRegistry.register(gmailConnector);
  globalRegistry.register(googleCalendarConnector);
  globalRegistry.register(customRestConnector);
  globalRegistry.register(priorityConnector);
}

export { CONNECTOR_METADATA, getConnectorMetadata, buildTenantConnectorSettings, getSupportedAuthTypes, isAuthTypeSupported, resolveConnectionAuthType } from "./metadata.js";
export type { ConnectorMetadata } from "./metadata.js";
export { globalRegistry };
