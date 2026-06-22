"use client";

import { useState } from "react";
import { getApiUrl } from "@/lib/api";

type ConnectionAuthType = "oauth" | "basic" | "bearer" | "api_key" | "none";

interface AuthCredentialField {
  key: string;
  label: string;
  type: "text" | "password";
  required?: boolean;
  placeholder?: string;
}

interface AuthTypeDefinition {
  type: ConnectionAuthType;
  label: string;
  credentialFields: AuthCredentialField[];
}

interface Connection {
  id: string;
  type: string;
  name: string;
  status: string;
  config?: Record<string, unknown>;
}

interface ConnectorSetting {
  type: string;
  displayName: string;
  oauthSupported: boolean;
  supportedAuthTypes: ConnectionAuthType[];
  configSchema: Record<string, unknown>;
}

function ConnectionConfigForm({
  connection,
  connector,
  authTypeDefinitions,
  token,
  onOAuth,
  onSaved,
}: {
  connection: Connection;
  connector: ConnectorSetting;
  authTypeDefinitions: Record<ConnectionAuthType, AuthTypeDefinition>;
  token: string;
  onOAuth: (connectionId: string) => void;
  onSaved: () => void;
}) {
  const schema = connector.configSchema as {
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
  const properties = schema.properties ?? {};
  const required = schema.required ?? [];

  const defaultAuthType =
    (connection.config?.authType as ConnectionAuthType | undefined) ??
    connector.supportedAuthTypes[0] ??
    "none";

  const [authType, setAuthType] = useState<ConnectionAuthType>(defaultAuthType);
  const [configValues, setConfigValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.keys(properties).map((key) => [
        key,
        typeof connection.config?.[key] === "string" ? (connection.config[key] as string) : "",
      ])
    )
  );
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const authDef = authTypeDefinitions[authType];

  async function save() {
    setSaving(true);
    setError("");
    try {
      const config = Object.fromEntries(
        Object.entries(configValues).map(([key, value]) => [key, value.trim()])
      );
      for (const key of required) {
        if (!config[key]) {
          throw new Error(`שדה חובה: ${properties[key]?.description ?? key}`);
        }
      }

      for (const field of authDef.credentialFields) {
        if (field.required && !credentials[field.key]?.trim()) {
          throw new Error(`שדה חובה: ${field.label}`);
        }
      }

      const res = await fetch(`${getApiUrl()}/api/v1/connections/${connection.id}/config`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ authType, config, credentials }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בשמירת ההגדרות");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  async function saveAuthTypeForOAuth() {
    setSaving(true);
    setError("");
    try {
      const config = Object.fromEntries(
        Object.entries(configValues).map(([key, value]) => [key, value.trim()])
      );
      const res = await fetch(`${getApiUrl()}/api/v1/connections/${connection.id}/config`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ authType: "oauth", config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בשמירה");
      onOAuth(connection.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        marginTop: "0.75rem",
        padding: "1rem",
        background: "var(--bg)",
        borderRadius: "6px",
        maxWidth: "480px",
      }}
    >
      <label style={{ display: "block", marginBottom: "1rem" }}>
        <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 600 }}>
          סוג אימות
        </span>
        <select
          value={authType}
          onChange={(e) => setAuthType(e.target.value as ConnectionAuthType)}
          style={{ width: "100%" }}
        >
          {connector.supportedAuthTypes.map((type) => (
            <option key={type} value={type}>
              {authTypeDefinitions[type].label}
            </option>
          ))}
        </select>
      </label>

      {Object.entries(properties).map(([key, field]) => (
        <label key={key} style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
            {field.description ?? key}
            {required.includes(key) ? " *" : ""}
          </span>
          <input
            type={field.type === "number" ? "number" : "text"}
            value={configValues[key] ?? ""}
            onChange={(e) => setConfigValues((prev) => ({ ...prev, [key]: e.target.value }))}
            style={{ width: "100%" }}
          />
        </label>
      ))}

      {authType !== "oauth" &&
        authDef.credentialFields.map((field) => (
          <label key={field.key} style={{ display: "block", marginBottom: "0.75rem" }}>
            <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
              {field.label}
              {field.required ? " *" : ""}
            </span>
            <input
              type={field.type}
              placeholder={field.placeholder}
              value={credentials[field.key] ?? ""}
              onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
              style={{ width: "100%" }}
            />
          </label>
        ))}

      {error && <p style={{ color: "var(--error)", marginBottom: "0.5rem" }}>{error}</p>}

      {authType === "oauth" ? (
        <button onClick={saveAuthTypeForOAuth} disabled={saving}>
          {saving ? "מעביר..." : "המשך ל-OAuth"}
        </button>
      ) : (
        <button onClick={save} disabled={saving}>
          {saving ? "שומר..." : "שמור והפעל"}
        </button>
      )}
    </div>
  );
}

function authTypeLabel(
  authType: unknown,
  definitions: Record<ConnectionAuthType, AuthTypeDefinition>
): string {
  if (typeof authType === "string" && authType in definitions) {
    return definitions[authType as ConnectionAuthType].label;
  }
  return "—";
}

export function ConnectionsClient({
  connections,
  token,
  tenantId,
  enabledConnectors = [],
  connectorSettings = [],
  authTypeDefinitions,
}: {
  connections: Connection[];
  token: string;
  tenantId?: string;
  enabledConnectors?: { type: string; displayName: string }[];
  connectorSettings?: ConnectorSetting[];
  authTypeDefinitions: Record<ConnectionAuthType, AuthTypeDefinition>;
}) {
  const [configuringId, setConfiguringId] = useState<string | null>(null);

  const settingsByType = Object.fromEntries(connectorSettings.map((s) => [s.type, s]));

  async function resolveTenantId(): Promise<string> {
    if (tenantId) return tenantId;
    const meRes = await fetch(`${getApiUrl()}/api/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const me = await meRes.json();
    return me.auth.tenantId as string;
  }

  async function startOAuth(connectionId: string) {
    const res = await fetch(`${getApiUrl()}/api/v1/connections/${connectionId}/oauth/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "שגיאה בהפעלת OAuth");
      return;
    }
    if (data.url) window.location.href = data.url;
  }

  async function createConnection(type: string, name: string) {
    const resolvedTenantId = await resolveTenantId();
    await fetch(`${getApiUrl()}/api/v1/tenants/${resolvedTenantId}/connections`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type, name }),
    });
    window.location.reload();
  }

  return (
    <>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginBottom: "1rem", fontSize: "1rem" }}>הוספת חיבור חדש</h2>
        {enabledConnectors.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>
            אין סוגי חיבורים זמינים לארגון זה. פנה לסופר אדמין להפעלת סוגי חיבור.
          </p>
        ) : (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {enabledConnectors.map((c) => (
              <button
                key={c.type}
                className="secondary"
                onClick={() => createConnection(c.type, c.displayName)}
              >
                + {c.displayName}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>שם</th>
              <th>סוג</th>
              <th>אימות</th>
              <th>סטטוס</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {connections.map((c) => {
              const connector = settingsByType[c.type];
              const needsSetup = c.status === "pending_auth";

              return (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.type}</td>
                  <td>{authTypeLabel(c.config?.authType, authTypeDefinitions)}</td>
                  <td>
                    <span
                      className={`badge ${c.status === "active" ? "active" : c.status === "pending_auth" ? "pending" : "error"}`}
                    >
                      {needsSetup ? "ממתין להגדרה" : c.status}
                    </span>
                  </td>
                  <td>
                    {connector && (
                      <button onClick={() => setConfiguringId(configuringId === c.id ? null : c.id)}>
                        {configuringId === c.id ? "סגור" : needsSetup ? "הגדרה" : "עריכה"}
                      </button>
                    )}
                    {configuringId === c.id && connector && (
                      <ConnectionConfigForm
                        connection={c}
                        connector={connector}
                        authTypeDefinitions={authTypeDefinitions}
                        token={token}
                        onOAuth={startOAuth}
                        onSaved={() => window.location.reload()}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {connections.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)", textAlign: "center" }}>
                  אין חיבורים. הוסף חיבור חדש למעלה.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
