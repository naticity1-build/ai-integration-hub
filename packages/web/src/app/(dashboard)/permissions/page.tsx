import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, getHubStore } from "@/lib/server-auth";
import { PermissionsAdminClient } from "@/components/permissions-admin-client";
import { getEnabledConnectorOptions } from "@/lib/connector-options";

export default async function PermissionsPage() {
  const auth = await getAuthContext();
  const isOrgAdmin = auth?.roleName === "admin" && !!auth?.tenantId;
  if (!isOrgAdmin) {
    if (auth?.isSuperAdmin) redirect("/organizations");
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  const tenantId = auth!.tenantId!;

  const store = getHubStore();
  const overrides = await store.listTenantConnectorOverrides(tenantId);
  const enabledConnectors = getEnabledConnectorOptions(overrides);

  return (
    <div>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "1.5rem" }}>הרשאות</h1>
      <PermissionsAdminClient
        tenantId={tenantId}
        token={token}
        enabledConnectors={enabledConnectors}
      />
    </div>
  );
}
