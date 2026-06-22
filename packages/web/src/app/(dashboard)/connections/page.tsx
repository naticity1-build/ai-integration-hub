import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, getHubStore } from "@/lib/server-auth";
import { buildTenantConnectorSettings, AUTH_TYPE_DEFINITIONS } from "@hub/connectors";
import type { ConnectionAuthType } from "@hub/connectors";
import { ConnectionsClient } from "./connections-client";

interface Connection {
  id: string;
  type: string;
  name: string;
  status: string;
  config?: Record<string, unknown>;
}

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; connectionId?: string }>;
}) {
  const auth = await getAuthContext();
  const isOrgAdmin = auth?.roleName === "admin" && !!auth?.tenantId;
  if (!isOrgAdmin) {
    if (auth?.isSuperAdmin) redirect("/organizations");
    redirect("/dashboard");
  }

  const params = await searchParams;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  let connections: Connection[] = [];
  let enabledConnectors: { type: string; displayName: string }[] = [];
  let connectorSettings: {
    type: string;
    displayName: string;
    oauthSupported: boolean;
    supportedAuthTypes: ConnectionAuthType[];
    configSchema: Record<string, unknown>;
  }[] = [];

  if (token && auth?.tenantId) {
    try {
      const { apiFetch } = await import("@/lib/api");
      connections = await apiFetch<Connection[]>(`/tenants/${auth.tenantId}/connections`, { token });
    } catch {
      // empty
    }

    const store = getHubStore();
    const overrides = await store.listTenantConnectorOverrides(auth.tenantId);
    enabledConnectors = buildTenantConnectorSettings(overrides)
      .filter((s) => s.enabled)
      .map((s) => ({ type: s.type, displayName: s.displayName }));
    connectorSettings = buildTenantConnectorSettings(overrides)
      .filter((s) => s.enabled)
      .map((s) => ({
        type: s.type,
        displayName: s.displayName,
        oauthSupported: s.oauthSupported,
        supportedAuthTypes: s.supportedAuthTypes,
        configSchema: s.configSchema,
      }));
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "1.5rem" }}>חיבורים</h1>
      {params.success && (
        <div className="card" style={{ marginBottom: "1rem", borderColor: "var(--success)" }}>
          חיבור OAuth הושלם בהצלחה!
        </div>
      )}
      <ConnectionsClient
        connections={connections}
        token={token}
        tenantId={auth!.tenantId!}
        enabledConnectors={enabledConnectors}
        connectorSettings={connectorSettings}
        authTypeDefinitions={AUTH_TYPE_DEFINITIONS}
      />
    </div>
  );
}
