"use client";

import { useEffect, useState } from "react";

interface ConnectorSetting {
  type: string;
  displayName: string;
  description: string;
  oauthSupported: boolean;
  enabled: boolean;
}

export function ConnectorSettingsClient({ tenantId }: { tenantId: string }) {
  const [settings, setSettings] = useState<ConnectorSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/organizations/${tenantId}/connector-settings`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [tenantId]);

  async function toggle(connectorType: string, enabled: boolean) {
    setUpdating(connectorType);
    setError("");
    try {
      const res = await fetch(`/api/admin/organizations/${tenantId}/connector-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorType, enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      setSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בעדכון");
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <p style={{ color: "var(--muted)" }}>טוען סוגי חיבורים...</p>
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
        <p style={{ color: "var(--muted)", marginBottom: "1rem", fontSize: "0.875rem" }}>
          הפעל או כבה סוגי חיבורים זמינים לארגון זה. חיבורים מכובים לא יופיעו למנהל הארגון.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>סוג חיבור</th>
              <th>תיאור</th>
              <th>OAuth</th>
              <th>סטטוס</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((s) => (
              <tr key={s.type}>
                <td style={{ fontWeight: 500 }}>{s.displayName}</td>
                <td style={{ color: "var(--muted)", fontSize: "0.875rem" }}>{s.description}</td>
                <td>{s.oauthSupported ? "כן" : "לא"}</td>
                <td>
                  <span className={`badge ${s.enabled ? "active" : "error"}`}>
                    {s.enabled ? "מופעל" : "מכובה"}
                  </span>
                </td>
                <td>
                  <button
                    className={s.enabled ? "secondary" : undefined}
                    disabled={updating === s.type}
                    onClick={() => toggle(s.type, !s.enabled)}
                  >
                    {updating === s.type ? "מעדכן..." : s.enabled ? "כבה" : "הפעל"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
