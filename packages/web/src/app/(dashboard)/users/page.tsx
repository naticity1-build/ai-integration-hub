import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/server-auth";
import { UsersAdminClient } from "./users-admin-client";

export default async function UsersPage() {
  const auth = await getAuthContext();
  const isOrgAdmin = auth?.roleName === "admin" && !!auth?.tenantId;

  if (!isOrgAdmin) {
    if (auth?.isSuperAdmin) redirect("/organizations");
    return (
      <div>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "1.5rem" }}>ניהול משתמשים</h1>
        <UsersAdminClient canManage={false} />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <div>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "1.5rem" }}>ניהול משתמשים</h1>
      <UsersAdminClient
        canManage
        tenantId={auth.tenantId!}
        token={session?.access_token ?? ""}
      />
    </div>
  );
}
