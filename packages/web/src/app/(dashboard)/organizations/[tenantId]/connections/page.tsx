import { createClient } from "@/lib/supabase/server";
import { getHubStore } from "@/lib/server-auth";
import { buildTenantConnectorSettings, AUTH_TYPE_DEFINITIONS } from "@hub/connectors";
import { ConnectionsClient } from "../../../connections/connections-client";

export default async function OrgConnectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ success?: string; connectionId?: string }>;
}) {
  const { tenantId } = await params;
  const query = await searchParams;
  const store = getHubStore();
  const connections = await store.listConnections(tenantId);
  const overrides = await store.listTenantConnectorOverrides(tenantId);
  const enabledConnectors = buildTenantConnectorSettings(overrides)
    .filter((s) => s.enabled)
    .map((s) => ({ type: s.type, displayName: s.displayName }));
  const connectorSettings = buildTenantConnectorSettings(overrides)
    .filter((s) => s.enabled)
    .map((s) => ({
      type: s.type,
      displayName: s.displayName,
      oauthSupported: s.oauthSupported,
      supportedAuthTypes: s.supportedAuthTypes,
      configSchema: s.configSchema,
    }));

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";

  return (
    <div>
      <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>חיבורים</h2>
      {query.success && (
        <div className="card" style={{ marginBottom: "1rem", borderColor: "var(--success)" }}>
          חיבור OAuth הושלם בהצלחה!
        </div>
      )}
      <ConnectionsClient
        connections={connections}
        token={token}
        tenantId={tenantId}
        enabledConnectors={enabledConnectors}
        connectorSettings={connectorSettings}
        authTypeDefinitions={AUTH_TYPE_DEFINITIONS}
      />
    </div>
  );
}
