import type { ConnectionAuthType } from "./auth-types.js";

export function buildAuthHeaders(
  authType: ConnectionAuthType,
  secrets: Record<string, unknown> | null
): Record<string, string> {
  if (!secrets) return {};

  switch (authType) {
    case "basic": {
      const username = secrets.username;
      const password = secrets.password;
      if (typeof username === "string" && typeof password === "string" && username) {
        const encoded = Buffer.from(`${username}:${password}`).toString("base64");
        return { Authorization: `Basic ${encoded}` };
      }
      return {};
    }
    case "bearer": {
      const token = secrets.token ?? secrets.access_token;
      if (typeof token === "string" && token) {
        return { Authorization: `Bearer ${token}` };
      }
      return {};
    }
    case "api_key": {
      const apiKey = secrets.apiKey;
      if (typeof apiKey === "string" && apiKey) {
        const headerName =
          typeof secrets.headerName === "string" && secrets.headerName.trim()
            ? secrets.headerName.trim()
            : "X-API-Key";
        return { [headerName]: apiKey };
      }
      return {};
    }
    case "oauth":
    case "none":
    default:
      return {};
  }
}
