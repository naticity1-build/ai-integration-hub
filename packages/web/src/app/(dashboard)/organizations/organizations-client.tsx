"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export function OrganizationsClient() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/organizations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setTenants(data.tenants);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slug.toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create");
      setName("");
      setSlug("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירה");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <p style={{ color: "var(--muted)" }}>טוען ארגונים...</p>
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

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>יצירת ארגון חדש</h2>
        <form onSubmit={createOrg} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <input
            placeholder="שם הארגון"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ flex: 1, minWidth: 160 }}
          />
          <input
            placeholder="slug (abc-corp)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            pattern="[a-z0-9-]+"
            style={{ flex: 1, minWidth: 160 }}
          />
          <button type="submit" disabled={creating}>
            {creating ? "יוצר..." : "צור ארגון"}
          </button>
        </form>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>שם</th>
              <th>Slug</th>
              <th>נוצר</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.slug}</td>
                <td>{new Date(t.createdAt).toLocaleDateString("he-IL")}</td>
                <td>
                  <Link href={`/organizations/${t.id}`}>ניהול</Link>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "var(--muted)", textAlign: "center" }}>
                  אין ארגונים במערכת
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
