import { buildTenantConnectorSettings } from "@hub/connectors";
import { globalRegistry, registerBuiltInConnectors } from "@hub/connectors";

registerBuiltInConnectors();

export function getEnabledConnectorOptions(
  overrides: { connectorType: string; enabled: boolean }[]
) {
  const settings = buildTenantConnectorSettings(
    overrides as { connectorType: import("@hub/core").ConnectorType; enabled: boolean }[]
  ).filter((s) => s.enabled);

  const capabilities = globalRegistry.getAllCapabilities();

  return settings.map((meta) => ({
    type: meta.type,
    displayName: meta.displayName,
    tools: capabilities
      .filter((c) => c.connectorType === meta.type)
      .map((c) => ({ toolName: c.toolName, description: c.description })),
  }));
}
