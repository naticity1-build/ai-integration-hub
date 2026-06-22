"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { getApiUrl } from "@/lib/api";
import { McpConnectionGuide } from "@/components/mcp-connection-guide";

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  departmentId: string | null;
  roleId: string;
  roleName: string;
  departmentName: string | null;
  isActive: boolean;
}

interface Role {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface McpTokenRow {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "מנהל ארגון",
  manager: "מנהל מחלקה",
  member: "משתמש",
  viewer: "צופה",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("he-IL");
}

export function UsersAdminClient({
  canManage,
  tenantId,
  token,
}: {
  canManage: boolean;
  tenantId?: string;
  token?: string;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [resolvedTenantId, setResolvedTenantId] = useState(tenantId ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userTokens, setUserTokens] = useState<McpTokenRow[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [newTokenName, setNewTokenName] = useState("claude");
  const [newTokenDays, setNewTokenDays] = useState(90);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [lastIssuedToken, setLastIssuedToken] = useState<string | null>(null);

  const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  const apiBase = `${getApiUrl()}/api/v1`;
  const apiHeaders = token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : undefined;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setUsers(data.users);
      setRoles(data.roles);
      setDepartments(data.departments);
      setResolvedTenantId(data.tenantId ?? tenantId ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }

  const loadUserTokens = useCallback(
    async (userId: string) => {
      if (!token || !resolvedTenantId) return;
      setTokensLoading(true);
      try {
        const res = await fetch(
          `${apiBase}/tenants/${resolvedTenantId}/mcp-tokens?userId=${encodeURIComponent(userId)}`,
          { headers: apiHeaders }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load tokens");
        setUserTokens(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה בטעינת טוקנים");
      } finally {
        setTokensLoading(false);
      }
    },
    [apiBase, apiHeaders, resolvedTenantId, token]
  );

  useEffect(() => {
    if (canManage) void load();
    else setLoading(false);
  }, [canManage, tenantId]);

  useEffect(() => {
    if (expandedUserId) void loadUserTokens(expandedUserId);
  }, [expandedUserId, loadUserTokens]);

  async function updateUser(
    userId: string,
    patch: { roleId?: string; departmentId?: string | null; isActive?: boolean }
  ) {
    setSaving(userId);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}${query}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בעדכון");
    } finally {
      setSaving(null);
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
  }

  async function createMcpToken(userId: string) {
    if (!token || !resolvedTenantId) return;
    setSaving(userId);
    setError("");
    setIssuedToken(null);
    try {
      const res = await fetch(
        `${apiBase}/tenants/${resolvedTenantId}/users/${userId}/mcp-tokens`,
        {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify({ name: newTokenName, expiresInDays: newTokenDays }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create token");
      setIssuedToken(data.token);
      setLastIssuedToken(data.token);
      await loadUserTokens(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירת טוקן");
    } finally {
      setSaving(null);
    }
  }

  async function revokeMcpToken(tokenId: string) {
    if (!token || !resolvedTenantId || !expandedUserId) return;
    if (!confirm("לבטל טוקן זה?")) return;
    setSaving(expandedUserId);
    setError("");
    try {
      const res = await fetch(
        `${apiBase}/tenants/${resolvedTenantId}/mcp-tokens/${tokenId}`,
        { method: "DELETE", headers: apiHeaders }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to revoke");
      await loadUserTokens(expandedUserId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בביטול טוקן");
    } finally {
      setSaving(null);
    }
  }

  function toggleMcpPanel(userId: string) {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
    setIssuedToken(null);
  }

  if (!canManage) {
    return (
      <div className="card">
        <p style={{ color: "var(--muted)" }}>
          רק מנהל ארגון או סופר אדמין יכול לנהל משתמשים והרשאות.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card">
        <p style={{ color: "var(--muted)" }}>טוען משתמשים...</p>
      </div>
    );
  }

  return (
    <div>
      <McpConnectionGuide sampleToken={lastIssuedToken ?? undefined} />

      {error && (
        <div className="card" style={{ marginBottom: "1rem", borderColor: "var(--danger)" }}>
          {error}
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>שם</th>
              <th>אימייל</th>
              <th>User ID</th>
              <th>תפקיד</th>
              <th>מחלקה</th>
              <th>סטטוס</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <Fragment key={u.id}>
                <tr>
                  <td>{u.displayName}</td>
                  <td>{u.email}</td>
                  <td>
                    <code style={{ fontSize: "0.7rem" }}>{u.id.slice(0, 8)}…</code>
                    <button
                      type="button"
                      className="secondary"
                      style={{ marginRight: "0.35rem", padding: "0.15rem 0.4rem", fontSize: "0.7rem" }}
                      onClick={() => copyText(u.id)}
                    >
                      העתק
                    </button>
                  </td>
                  <td>
                    <select
                      value={u.roleId}
                      disabled={saving === u.id}
                      onChange={(e) => updateUser(u.id, { roleId: e.target.value })}
                      style={{ width: "auto", minWidth: 120 }}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {ROLE_LABELS[r.name] ?? r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={u.departmentId ?? ""}
                      disabled={saving === u.id}
                      onChange={(e) =>
                        updateUser(u.id, {
                          departmentId: e.target.value || null,
                        })
                      }
                      style={{ width: "auto", minWidth: 120 }}
                    >
                      <option value="">ללא מחלקה</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${u.isActive ? "active" : "error"}`}>
                      {u.isActive ? "פעיל" : "מושבת"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="secondary"
                        disabled={saving === u.id}
                        onClick={() => toggleMcpPanel(u.id)}
                      >
                        {expandedUserId === u.id ? "סגור MCP" : "טוקן MCP"}
                      </button>
                      {u.isActive ? (
                        <button
                          type="button"
                          className="secondary"
                          disabled={saving === u.id}
                          onClick={() => updateUser(u.id, { isActive: false })}
                        >
                          השבת
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={saving === u.id}
                          onClick={() => updateUser(u.id, { isActive: true })}
                        >
                          הפעל
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedUserId === u.id && (
                  <tr key={`${u.id}-mcp`}>
                    <td colSpan={7} style={{ background: "var(--bg)" }}>
                      <div style={{ padding: "1rem" }}>
                        <h3 style={{ fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                          טוקני MCP — {u.displayName}
                        </h3>
                        <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
                          User ID מלא: <code>{u.id}</code>
                        </p>

                        <div
                          style={{
                            display: "flex",
                            gap: "0.75rem",
                            flexWrap: "wrap",
                            marginBottom: "1rem",
                            alignItems: "flex-end",
                          }}
                        >
                          <label>
                            <span style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                              שם טוקן
                            </span>
                            <input
                              value={newTokenName}
                              onChange={(e) => setNewTokenName(e.target.value)}
                              style={{ width: 140 }}
                            />
                          </label>
                          <label>
                            <span style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                              תוקף (ימים)
                            </span>
                            <input
                              type="number"
                              min={1}
                              value={newTokenDays}
                              onChange={(e) => setNewTokenDays(Number(e.target.value))}
                              style={{ width: 100 }}
                            />
                          </label>
                          <button
                            type="button"
                            disabled={saving === u.id || !token}
                            onClick={() => createMcpToken(u.id)}
                          >
                            {saving === u.id ? "יוצר..." : "צור טוקן MCP"}
                          </button>
                        </div>

                        {issuedToken && (
                          <div
                            className="card"
                            style={{ marginBottom: "1rem", borderColor: "var(--success)" }}
                          >
                            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                              הטוקן נוצר — העתק עכשיו (לא יוצג שוב):
                            </p>
                            <code
                              style={{
                                display: "block",
                                wordBreak: "break-all",
                                fontSize: "0.75rem",
                                marginBottom: "0.5rem",
                              }}
                            >
                              {issuedToken}
                            </code>
                            <button type="button" onClick={() => copyText(issuedToken)}>
                              העתק טוקן
                            </button>
                          </div>
                        )}

                        {tokensLoading ? (
                          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>טוען טוקנים...</p>
                        ) : (
                          <table className="table">
                            <thead>
                              <tr>
                                <th>שם</th>
                                <th>נוצר</th>
                                <th>תפוגה</th>
                                <th>סטטוס</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {userTokens.map((t) => (
                                <tr key={t.id}>
                                  <td>{t.name}</td>
                                  <td>{formatDate(t.createdAt)}</td>
                                  <td>{formatDate(t.expiresAt)}</td>
                                  <td>
                                    {t.revokedAt ? (
                                      <span className="badge error">מבוטל</span>
                                    ) : (
                                      <span className="badge active">פעיל</span>
                                    )}
                                  </td>
                                  <td>
                                    {!t.revokedAt && (
                                      <button
                                        type="button"
                                        className="secondary"
                                        disabled={saving === u.id}
                                        onClick={() => revokeMcpToken(t.id)}
                                      >
                                        בטל
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {userTokens.length === 0 && (
                                <tr>
                                  <td colSpan={5} style={{ color: "var(--muted)", textAlign: "center" }}>
                                    אין טוקנים
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: "var(--muted)", textAlign: "center" }}>
                  אין משתמשים רשומים
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: "1rem", fontSize: "0.875rem", color: "var(--muted)" }}>
        משתמשים חדשים נרשמים אוטומטית כצופים. צור טוקן MCP לכל משתמש ושלח לו את פרטי החיבור.
      </p>
    </div>
  );
}
