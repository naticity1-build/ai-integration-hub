import type { ConnectorType } from "@hub/core";
import type { ConnectionAuthType } from "./auth-types.js";
import { AUTH_TYPE_DEFINITIONS } from "./auth-types.js";

export interface ConnectorMetadata {
  type: ConnectorType;
  displayName: string;
  description: string;
  oauthSupported: boolean;
  supportedAuthTypes: ConnectionAuthType[];
  configSchema: Record<string, unknown>;
}

export const CONNECTOR_METADATA: ConnectorMetadata[] = [
  {
    type: "google_drive",
    displayName: "Google Drive",
    description: "Search, read, and summarize documents",
    oauthSupported: true,
    supportedAuthTypes: ["oauth"],
    configSchema: { type: "object", properties: {} },
  },
  {
    type: "gmail",
    displayName: "Gmail",
    description: "Search emails, summarize threads, draft messages",
    oauthSupported: true,
    supportedAuthTypes: ["oauth"],
    configSchema: { type: "object", properties: {} },
  },
  {
    type: "google_calendar",
    displayName: "Google Calendar",
    description: "List events and find availability",
    oauthSupported: true,
    supportedAuthTypes: ["oauth"],
    configSchema: { type: "object", properties: {} },
  },
  {
    type: "custom_rest",
    displayName: "Custom REST API",
    description: "Query any REST API endpoint",
    oauthSupported: false,
    supportedAuthTypes: ["none", "basic", "bearer", "api_key", "oauth"],
    configSchema: {
      type: "object",
      properties: {
        baseUrl: { type: "string", description: "Base URL של ה-API" },
      },
      required: ["baseUrl"],
    },
  },
  {
    type: "outlook",
    displayName: "Outlook",
    description: "Microsoft Outlook email integration",
    oauthSupported: true,
    supportedAuthTypes: ["oauth", "bearer"],
    configSchema: { type: "object", properties: {} },
  },
  {
    type: "sharepoint",
    displayName: "SharePoint",
    description: "Microsoft SharePoint documents",
    oauthSupported: true,
    supportedAuthTypes: ["oauth", "bearer"],
    configSchema: { type: "object", properties: {} },
  },
  {
    type: "priority",
    displayName: "Priority ERP",
    description: "Priority ERP business data integration",
    oauthSupported: false,
    supportedAuthTypes: ["none", "basic", "bearer", "api_key"],
    configSchema: {
      type: "object",
      properties: {
        baseUrl: { type: "string", description: "Priority REST API base URL" },
        company: { type: "string", description: "שם בסיס הנתונים (Company)" },
      },
      required: ["baseUrl", "company"],
    },
  },
];

export function getConnectorMetadata(type: ConnectorType): ConnectorMetadata | undefined {
  return CONNECTOR_METADATA.find((m) => m.type === type);
}

export function getSupportedAuthTypes(connectorType: ConnectorType): ConnectionAuthType[] {
  return getConnectorMetadata(connectorType)?.supportedAuthTypes ?? ["none"];
}

export function isAuthTypeSupported(
  connectorType: ConnectorType,
  authType: ConnectionAuthType
): boolean {
  return getSupportedAuthTypes(connectorType).includes(authType);
}

export function resolveConnectionAuthType(
  connectorType: ConnectorType,
  authType: unknown
): ConnectionAuthType {
  if (
    typeof authType === "string" &&
    authType in AUTH_TYPE_DEFINITIONS &&
    isAuthTypeSupported(connectorType, authType as ConnectionAuthType)
  ) {
    return authType as ConnectionAuthType;
  }
  return getSupportedAuthTypes(connectorType)[0] ?? "none";
}

export function buildTenantConnectorSettings(
  overrides: { connectorType: ConnectorType; enabled: boolean }[]
): (ConnectorMetadata & { enabled: boolean })[] {
  return CONNECTOR_METADATA.map((meta) => ({
    ...meta,
    enabled: overrides.find((o) => o.connectorType === meta.type)?.enabled ?? true,
  }));
}
