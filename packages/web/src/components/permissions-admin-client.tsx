"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiUrl } from "@/lib/api";

interface Grant {
  id: string;
  targetType: "department" | "role" | "user";
  targetId: string;
  connectorType: string;
  allowedTools: string[];
}

interface UserRow {
  id: string;
  email: string;
  displayName: string;
}

interface Department {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
}

interface ConnectorOption {
  type: string;
  displayName: string;
  tools: { toolName: string; description: string }[];
}

const TARGET_TYPE_LABELS: Record<Grant["targetType"], string> = {
  user: "משתמש",
  department: "מחלקה",
  role: "תפקיד",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "מנהל ארגון",
  manager: "מנהל מחלקה",
  member: "משתמש",
  viewer: "צופה",
};

export function PermissionsAdminClient({
  tenantId,
  token,
  enabledConnectors,
}: {
  tenantId: string;
  token: string;
  enabledConnectors: ConnectorOption[];
}) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [targetType, setTargetType] = useState<Grant["targetType"]>("user");
  const [targetId, setTargetId] = useState("");
  const [connectorType, setConnectorType] = useState(enabledConnectors[0]?.type ?? "");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  const apiBase = `${getApiUrl()}/api/v1`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const selectedConnector = enabledConnectors.find((c) => c.type === connectorType);
  const availableTools = selectedConnector?.tools ?? [];

  const resolveTargetLabel = useCallback(
    (grant: Grant) => {
      if (grant.targetType === "user") {
        const user = users.find((u) => u.id === grant.targetId);
        return user ? `${user.displayName} (${user.email})` : grant.targetId;
      }
      if (grant.targetType === "department") {
        return departments.find((d) => d.id === grant.targetId)?.name ?? grant.targetId;
      }
      const role = roles.find((r) => r.id === grant.targetId);
      return role ? (ROLE_LABELS[role.name] ?? role.name) : grant.targetId;
    },
    [users, departments, roles]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [grantsRes, usersRes, deptsRes, rolesRes] = await Promise.all([
        fetch(`${apiBase}/tenants/${tenantId}/grants`, { headers }),
        fetch(`${apiBase}/tenants/${tenantId}/users`, { headers }),
        fetch(`${apiBase}/tenants/${tenantId}/departments`, { headers }),
        fetch(`${apiBase}/tenants/${tenantId}/roles`, { headers }),
      ]);

      const [grantsData, usersData, deptsData, rolesData] = await Promise.all([
        grantsRes.json(),
        usersRes.json(),
        deptsRes.json(),
        rolesRes.json(),
      ]);

      if (!grantsRes.ok) throw new Error(grantsData.error ?? "Failed to load grants");
      setGrants(grantsData);
      setUsers(usersRes.ok ? usersData : []);
      setDepartments(deptsRes.ok ? deptsData : []);
      setRoles(rolesRes.ok ? rolesData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }, [apiBase, tenantId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (enabledConnectors.length > 0 && !connectorType) {
      setConnectorType(enabledConnectors[0]!.type);
    }
  }, [enabledConnectors, connectorType]);

  useEffect(() => {
    setSelectedTools([]);
  }, [connectorType]);

  function toggleTool(toolName: string) {
    setSelectedTools((prev) =>
      prev.includes(toolName) ? prev.filter((t) => t !== toolName) : [...prev, toolName]
    );
  }

  async function createGrant() {
    if (!targetId) {
      setError("יש לבחור יעד");
      return;
    }
    if (!connectorType) {
      setError("יש לבחור סוג חיבור");
      return;
    }
    if (selectedTools.length === 0) {
      setError("יש לבחור לפחות כלי אחד");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/tenants/${tenantId}/grants`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          targetType,
          targetId,
          connectorType,
          allowedTools: selectedTools,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create grant");
      setTargetId("");
      setSelectedTools([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירה");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGrant(grantId: string) {
    if (!confirm("למחוק הרשאה זו?")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/tenants/${tenantId}/grants/${grantId}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה במחיקה");
    } finally {
      setSaving(false);
    }
  }

  const targetOptions =
    targetType === "user"
      ? users.map((u) => ({ id: u.id, label: `${u.displayName} (${u.email})` }))
      : targetType === "department"
        ? departments.map((d) => ({ id: d.id, label: d.name }))
        : roles.map((r) => ({ id: r.id, label: ROLE_LABELS[r.name] ?? r.name }));

  if (loading) {
    return (
      <div className="card">
        <p style={{ color: "var(--muted)" }}>טוען הרשאות...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {error && (
        <div className="card" style={{ borderColor: "var(--danger)" }}>
          {error}
        </div>
      )}

      <div className="card">
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>הוסף הרשאה</h2>
        {enabledConnectors.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>
            אין סוגי חיבורים מופעלים לארגון. הפעל סוגי חיבור תחילה.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 520 }}>
            <label>
              <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
                סוג יעד
              </span>
              <select
                value={targetType}
                onChange={(e) => {
                  setTargetType(e.target.value as Grant["targetType"]);
                  setTargetId("");
                }}
                style={{ width: "100%" }}
              >
                <option value="user">משתמש</option>
                <option value="department">מחלקה</option>
                <option value="role">תפקיד</option>
              </select>
            </label>

            <label>
              <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
                יעד
              </span>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="">בחר...</option>
                {targetOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
                סוג חיבור
              </span>
              <select
                value={connectorType}
                onChange={(e) => setConnectorType(e.target.value)}
                style={{ width: "100%" }}
              >
                {enabledConnectors.map((c) => (
                  <option key={c.type} value={c.type}>
                    {c.displayName}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem" }}>
                כלים מורשים
              </span>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={selectedTools.includes("*")}
                  onChange={() =>
                    setSelectedTools((prev) => (prev.includes("*") ? [] : ["*"]))
                  }
                />
                כל הכלים (*)
              </label>
              {!selectedTools.includes("*") &&
                availableTools.map((tool) => (
                  <label
                    key={tool.toolName}
                    style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.35rem" }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTools.includes(tool.toolName)}
                      onChange={() => toggleTool(tool.toolName)}
                    />
                    <span>
                      <strong>{tool.toolName}</strong>
                      <br />
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        {tool.description}
                      </span>
                    </span>
                  </label>
                ))}
            </div>

            <button onClick={createGrant} disabled={saving}>
              {saving ? "שומר..." : "הוסף הרשאה"}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>הרשאות קיימות</h2>
        <table className="table">
          <thead>
            <tr>
              <th>יעד</th>
              <th>סוג יעד</th>
              <th>Connector</th>
              <th>כלים מורשים</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {grants.map((g) => (
              <tr key={g.id}>
                <td>{resolveTargetLabel(g)}</td>
                <td>{TARGET_TYPE_LABELS[g.targetType]}</td>
                <td>{g.connectorType}</td>
                <td>{g.allowedTools.join(", ")}</td>
                <td>
                  <button
                    className="secondary"
                    disabled={saving}
                    onClick={() => deleteGrant(g.id)}
                  >
                    מחק
                  </button>
                </td>
              </tr>
            ))}
            {grants.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)", textAlign: "center" }}>
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
