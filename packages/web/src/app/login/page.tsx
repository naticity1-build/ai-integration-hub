"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { registerUser } from "@/lib/api";

type AuthMode = "login" | "register";
type OrgMode = "join" | "create";

export default function LoginPage() {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [orgMode, setOrgMode] = useState<OrgMode>("join");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("abc");
  const [tenantName, setTenantName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await registerUser({
        email,
        password,
        displayName,
        mode: orgMode,
        tenantSlug: orgMode === "join" ? tenantSlug : undefined,
        tenantName: orgMode === "create" ? tenantName : undefined,
        orgSlug: orgMode === "create" ? orgSlug : undefined,
      });

      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(`נרשמת בהצלחה. ${authError.message}`);
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card" style={{ width: "100%", maxWidth: 420 }}>
        <h1 style={{ marginBottom: "0.5rem", fontSize: "1.5rem" }}>AI Integration Hub</h1>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
          {authMode === "login" ? "התחברות למערכת ניהול האינטגרציה" : "יצירת חשבון חדש"}
        </p>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <button
            type="button"
            className={authMode === "login" ? "" : "secondary"}
            style={{ flex: 1 }}
            onClick={() => { setAuthMode("login"); setError(""); }}
          >
            התחברות
          </button>
          <button
            type="button"
            className={authMode === "register" ? "" : "secondary"}
            style={{ flex: 1 }}
            onClick={() => { setAuthMode("register"); setError(""); }}
          >
            הרשמה
          </button>
        </div>

        {authMode === "login" ? (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>אימייל</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>סיסמה</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p style={{ color: "var(--danger)", fontSize: "0.875rem" }}>{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? "מתחבר..." : "התחברות"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>שם מלא</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>אימייל</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>סיסמה (מינימום 6 תווים)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <p style={{ fontSize: "0.875rem", marginBottom: "0.75rem", color: "var(--muted)" }}>ארגון</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
                  <input
                    type="radio"
                    name="orgMode"
                    checked={orgMode === "join"}
                    onChange={() => setOrgMode("join")}
                  />
                  הצטרפות לארגון קיים
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
                  <input
                    type="radio"
                    name="orgMode"
                    checked={orgMode === "create"}
                    onChange={() => setOrgMode("create")}
                  />
                  יצירת ארגון חדש (מנהל)
                </label>
              </div>

              {orgMode === "join" ? (
                <div>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>קוד ארגון (slug)</label>
                  <input
                    type="text"
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    placeholder="abc"
                    required
                  />
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                    משתמשים חדשים נרשמים כצופים (Viewer). המשתמש הראשון בארגון חדש הופך למנהל מערכת.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>שם הארגון</label>
                    <input
                      type="text"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      placeholder="החברה שלי"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>קוד ארגון (slug)</label>
                    <input
                      type="text"
                      value={orgSlug}
                      onChange={(e) => setOrgSlug(e.target.value.toLowerCase())}
                      placeholder="my-company"
                      pattern="[a-z0-9-]+"
                      required
                    />
                  </div>
                </>
              )}
            </div>

            {error && <p style={{ color: "var(--danger)", fontSize: "0.875rem" }}>{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? "נרשם..." : "הרשמה"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
