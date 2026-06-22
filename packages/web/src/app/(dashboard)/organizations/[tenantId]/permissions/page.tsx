import { createClient } from "@/lib/supabase/server";
import { getHubStore } from "@/lib/server-auth";
import { PermissionsAdminClient } from "@/components/permissions-admin-client";
import { getEnabledConnectorOptions } from "@/lib/connector-options";

export default async function OrgPermissionsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";

  const store = getHubStore();
  const overrides = await store.listTenantConnectorOverrides(tenantId);
  const enabledConnectors = getEnabledConnectorOptions(overrides);

  return (
    <div>
      <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>הרשאות</h2>
      <PermissionsAdminClient
        tenantId={tenantId}
        token={token}
        enabledConnectors={enabledConnectors}
      />
    </div>
  );
}
