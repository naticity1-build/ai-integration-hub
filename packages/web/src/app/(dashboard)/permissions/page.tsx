import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/server-auth";
import { apiFetch } from "@/lib/api";

interface Grant {
  id: string;
  targetType: string;
  targetId: string;
  connectorType: string;
  allowedTools: string[];
}

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
  let grants: Grant[] = [];

  if (token && auth?.tenantId) {
    try {
      grants = await apiFetch<Grant[]>(`/tenants/${auth.tenantId}/grants`, { token });
    } catch {
      // empty
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "1.5rem" }}>הרשאות</h1>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>יעד</th>
              <th>סוג יעד</th>
              <th>Connector</th>
              <th>כלים מורשים</th>
            </tr>
          </thead>
          <tbody>
            {grants.map((g) => (
              <tr key={g.id}>
                <td>{g.targetId}</td>
                <td>{g.targetType}</td>
                <td>{g.connectorType}</td>
                <td>{g.allowedTools.join(", ")}</td>
              </tr>
            ))}
            {grants.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "var(--muted)", textAlign: "center" }}>
                  אין הרשאות מוגדרות
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
