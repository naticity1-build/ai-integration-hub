import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/server-auth";
import { apiFetch } from "@/lib/api";

interface AuditEntry {
  id: string;
  action: string;
  userId: string;
  connectorType: string | null;
  toolName: string | null;
  createdAt: string;
}

export default async function AuditPage() {
  const auth = await getAuthContext();
  const isOrgAdmin = auth?.roleName === "admin" && !!auth?.tenantId;
  if (!isOrgAdmin) {
    if (auth?.isSuperAdmin) redirect("/organizations");
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  let logs: AuditEntry[] = [];

  if (token && auth?.tenantId) {
    try {
      logs = await apiFetch<AuditEntry[]>(`/tenants/${auth.tenantId}/audit?limit=50`, { token });
    } catch {
      // empty
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "1.5rem" }}>לוג ביקורת</h1>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>זמן</th>
              <th>פעולה</th>
              <th>משתמש</th>
              <th>Connector</th>
              <th>כלי</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.createdAt).toLocaleString("he-IL")}</td>
                <td>{l.action}</td>
                <td>{l.userId.slice(0, 8)}...</td>
                <td>{l.connectorType ?? "-"}</td>
                <td>{l.toolName ?? "-"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)", textAlign: "center" }}>
                  אין רשומות ביקורת
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
