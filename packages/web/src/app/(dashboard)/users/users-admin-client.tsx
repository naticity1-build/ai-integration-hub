"use client";

import { useEffect, useState } from "react";

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

const ROLE_LABELS: Record<string, string> = {
  admin: "מנהל ארגון",
  manager: "מנהל מחלקה",
  member: "משתמש",
  viewer: "צופה",
};

export function UsersAdminClient({
  canManage,
  tenantId,
}: {
  canManage: boolean;
  tenantId?: string;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canManage) void load();
    else setLoading(false);
  }, [canManage, tenantId]);

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
              <th>תפקיד</th>
              <th>מחלקה</th>
              <th>סטטוס</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.displayName}</td>
                <td>{u.email}</td>
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
                  {u.isActive ? (
                    <button
                      className="secondary"
                      disabled={saving === u.id}
                      onClick={() => updateUser(u.id, { isActive: false })}
                    >
                      השבת
                    </button>
                  ) : (
                    <button
                      disabled={saving === u.id}
                      onClick={() => updateUser(u.id, { isActive: true })}
                    >
                      הפעל מחדש
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "var(--muted)", textAlign: "center" }}>
                  אין משתמשים רשומים
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: "1rem", fontSize: "0.875rem", color: "var(--muted)" }}>
        משתמשים חדשים נרשמים אוטומטית כצופים. מנהל ארגון יכול לשנות תפקיד, מחלקה, או לחסום גישה.
      </p>
    </div>
  );
}
