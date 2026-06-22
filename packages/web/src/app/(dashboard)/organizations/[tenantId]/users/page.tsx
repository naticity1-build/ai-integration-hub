import { createClient } from "@/lib/supabase/server";
import { UsersAdminClient } from "../../../users/users-admin-client";

export default async function OrgUsersPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <div>
      <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>משתמשי הארגון</h2>
      <UsersAdminClient
        canManage
        tenantId={tenantId}
        token={session?.access_token ?? ""}
      />
    </div>
  );
}
