import { notFound } from "next/navigation";
import { getHubStore } from "@/lib/server-auth";

export default async function OrganizationOverviewPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const store = getHubStore();
  const tenant = await store.getTenant(tenantId);
  if (!tenant) notFound();

  const [users, connections, grants] = await Promise.all([
    store.listUsers(tenantId),
    store.listConnections(tenantId),
    store.listGrants(tenantId),
  ]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
      <div className="card">
        <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>משתמשים</p>
        <p style={{ fontSize: "2rem", fontWeight: 600 }}>{users.length}</p>
      </div>
      <div className="card">
        <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>חיבורים</p>
        <p style={{ fontSize: "2rem", fontWeight: 600 }}>{connections.length}</p>
      </div>
      <div className="card">
        <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>הרשאות</p>
        <p style={{ fontSize: "2rem", fontWeight: 600 }}>{grants.length}</p>
      </div>
    </div>
  );
}
