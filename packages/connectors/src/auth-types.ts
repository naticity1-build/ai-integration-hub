export type ConnectionAuthType = "oauth" | "basic" | "bearer" | "api_key" | "none";

export interface AuthCredentialField {
  key: string;
  label: string;
  type: "text" | "password";
  required?: boolean;
  placeholder?: string;
}

export interface AuthTypeDefinition {
  type: ConnectionAuthType;
  label: string;
  credentialFields: AuthCredentialField[];
}

export const AUTH_TYPE_DEFINITIONS: Record<ConnectionAuthType, AuthTypeDefinition> = {
  oauth: {
    type: "oauth",
    label: "OAuth 2.0",
    credentialFields: [],
  },
  basic: {
    type: "basic",
    label: "Basic Auth (שם משתמש וסיסמה)",
    credentialFields: [
      { key: "username", label: "שם משתמש", type: "text", required: true },
      { key: "password", label: "סיסמה", type: "password", required: true },
    ],
  },
  bearer: {
    type: "bearer",
    label: "Bearer Token",
    credentialFields: [
      { key: "token", label: "Bearer Token", type: "password", required: true },
    ],
  },
  api_key: {
    type: "api_key",
    label: "API Key",
    credentialFields: [
      { key: "apiKey", label: "API Key", type: "password", required: true },
      {
        key: "headerName",
        label: "שם Header",
        type: "text",
        required: false,
        placeholder: "X-API-Key",
      },
    ],
  },
  none: {
    type: "none",
    label: "ללא אימות",
    credentialFields: [],
  },
};

export function getAuthTypeDefinition(type: ConnectionAuthType): AuthTypeDefinition {
  return AUTH_TYPE_DEFINITIONS[type];
}
