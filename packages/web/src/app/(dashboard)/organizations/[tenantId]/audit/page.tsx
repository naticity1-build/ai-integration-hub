import { getHubStore } from "@/lib/server-auth";

export default async function OrgAuditPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const store = getHubStore();
  const logs = await store.listAuditLog(tenantId, { limit: 50 });

  return (
    <div>
      <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>לוג ביקורת</h2>
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
