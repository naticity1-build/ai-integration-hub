import { getHubStore } from "@/lib/server-auth";

export default async function OrgPermissionsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const store = getHubStore();
  const grants = await store.listGrants(tenantId);

  return (
    <div>
      <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>הרשאות</h2>
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
