import type { ConnectorType } from "@hub/core";

export interface OAuthProvider {
  name: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId: string;
  clientSecret: string;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
}

const GOOGLE_SCOPES: Record<string, string[]> = {
  google_drive: [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/documents.readonly",
  ],
  gmail: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.compose",
  ],
  google_calendar: ["https://www.googleapis.com/auth/calendar.readonly"],
};

export function getOAuthProvider(connectorType: ConnectorType): OAuthProvider | null {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.OAUTH_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? process.env.OAUTH_CLIENT_SECRET ?? "";

  if (!clientId || !clientSecret) return null;

  if (connectorType === "google_drive" || connectorType === "gmail" || connectorType === "google_calendar") {
    return {
      name: "google",
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: GOOGLE_SCOPES[connectorType] ?? [],
      clientId,
      clientSecret,
    };
  }

  if (connectorType === "outlook" || connectorType === "sharepoint") {
    return {
      name: "microsoft",
      authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      scopes: ["https://graph.microsoft.com/.default"],
      clientId: process.env.MICROSOFT_CLIENT_ID ?? clientId,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? clientSecret,
    };
  }

  return null;
}

export function buildOAuthUrl(provider: OAuthProvider, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: provider.scopes.join(" "),
    state,
    access_type: "offline",
    prompt: "consent",
  });
  return `${provider.authUrl}?${params.toString()}`;
}

export async function exchangeOAuthCode(
  provider: OAuthProvider,
  code: string,
  redirectUri: string
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token exchange failed: ${text}`);
  }

  const data = (await res.json()) as OAuthTokens & { expires_in?: number };
  if (data.expires_in) {
    data.expires_at = Date.now() + data.expires_in * 1000;
  }
  return data;
}

export async function refreshOAuthToken(
  provider: OAuthProvider,
  refreshToken: string
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error("Token refresh failed");
  const data = (await res.json()) as OAuthTokens & { expires_in?: number };
  if (data.expires_in) {
    data.expires_at = Date.now() + data.expires_in * 1000;
  }
  return data;
}
