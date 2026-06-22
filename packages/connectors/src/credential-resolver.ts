import type { Connection } from "@hub/core";
import type { OAuthTokens } from "./oauth.js";
import { getOAuthProvider, refreshOAuthToken } from "./oauth.js";

export type CredentialResolver = (connection: Connection) => Promise<OAuthTokens | null>;

let credentialResolver: CredentialResolver | null = null;

export function setCredentialResolver(resolver: CredentialResolver): void {
  credentialResolver = resolver;
}

export async function getAccessToken(connection: Connection): Promise<string | null> {
  if (!credentialResolver) return null;
  const tokens = await credentialResolver(connection);
  if (!tokens?.access_token) return null;

  if (tokens.expires_at && tokens.expires_at < Date.now() + 60_000 && tokens.refresh_token) {
    const provider = getOAuthProvider(connection.type);
    if (provider) {
      const refreshed = await refreshOAuthToken(provider, tokens.refresh_token);
      return refreshed.access_token;
    }
  }

  return tokens.access_token;
}

export async function googleFetch(
  connection: Connection,
  url: string,
  options?: RequestInit
): Promise<Response> {
  const token = await getAccessToken(connection);
  if (!token) throw new Error("No valid credentials for connection");

  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}
