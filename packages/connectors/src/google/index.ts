import type { ConnectorPlugin, ToolExecutionContext, ToolExecutionResult } from "../types.js";
import { googleFetch, getAccessToken } from "../credential-resolver.js";

const SEARCH_SCHEMA = {
  type: "object",
  properties: {
    query: { type: "string", description: "Search query" },
    maxResults: { type: "number", description: "Maximum results to return", default: 10 },
  },
  required: ["query"],
};

const READ_SCHEMA = {
  type: "object",
  properties: {
    documentId: { type: "string", description: "Document ID to read" },
  },
  required: ["documentId"],
};

async function hasLiveCredentials(ctx: ToolExecutionContext): Promise<boolean> {
  const token = await getAccessToken(ctx.connection);
  return token !== null;
}

export const googleDriveConnector: ConnectorPlugin = {
  type: "google_drive",
  displayName: "Google Drive",

  getCapabilities() {
    return [
      {
        id: "gdrive-search",
        connectorType: "google_drive",
        toolName: "search_documents",
        description: "Search documents in Google Drive",
        inputSchema: SEARCH_SCHEMA,
      },
      {
        id: "gdrive-read",
        connectorType: "google_drive",
        toolName: "read_document",
        description: "Read the content of a Google Drive document",
        inputSchema: READ_SCHEMA,
      },
      {
        id: "gdrive-summarize",
        connectorType: "google_drive",
        toolName: "summarize_document",
        description: "Summarize a Google Drive document",
        inputSchema: READ_SCHEMA,
      },
    ];
  },

  async validateConnection(connection) {
    try {
      const res = await googleFetch(connection, "https://www.googleapis.com/drive/v3/about?fields=user");
      return res.ok;
    } catch {
      return false;
    }
  },

  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const live = await hasLiveCredentials(ctx);

    switch (toolName) {
      case "search_documents":
        return live
          ? searchDriveLive(args.query as string, args.maxResults as number | undefined, ctx)
          : mockSearch("Google Drive", args.query as string, ctx);
      case "read_document":
        return live
          ? readDriveLive(args.documentId as string, ctx)
          : mockRead("Google Drive", args.documentId as string, ctx);
      case "summarize_document":
        return live
          ? summarizeDriveLive(args.documentId as string, ctx)
          : mockSummarize("Google Drive", args.documentId as string, ctx);
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${toolName}` }], isError: true };
    }
  },
};

export const gmailConnector: ConnectorPlugin = {
  type: "gmail",
  displayName: "Gmail",

  getCapabilities() {
    return [
      {
        id: "gmail-search",
        connectorType: "gmail",
        toolName: "search_emails",
        description: "Search emails in Gmail",
        inputSchema: SEARCH_SCHEMA,
      },
      {
        id: "gmail-summarize",
        connectorType: "gmail",
        toolName: "summarize_thread",
        description: "Summarize an email thread",
        inputSchema: {
          type: "object",
          properties: {
            threadId: { type: "string", description: "Email thread ID" },
          },
          required: ["threadId"],
        },
      },
      {
        id: "gmail-draft",
        connectorType: "gmail",
        toolName: "draft_email",
        description: "Draft a new email",
        inputSchema: {
          type: "object",
          properties: {
            to: { type: "string", description: "Recipient email" },
            subject: { type: "string", description: "Email subject" },
            body: { type: "string", description: "Email body" },
          },
          required: ["to", "subject", "body"],
        },
      },
    ];
  },

  async validateConnection(connection) {
    try {
      const res = await googleFetch(connection, "https://gmail.googleapis.com/gmail/v1/users/me/profile");
      return res.ok;
    } catch {
      return false;
    }
  },

  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const live = await hasLiveCredentials(ctx);

    switch (toolName) {
      case "search_emails":
        return live
          ? searchGmailLive(args.query as string, args.maxResults as number | undefined, ctx)
          : mockSearch("Gmail", args.query as string, ctx);
      case "summarize_thread":
        return live
          ? summarizeThreadLive(args.threadId as string, ctx)
          : mockSummarize("Gmail thread", args.threadId as string, ctx);
      case "draft_email":
        return live
          ? draftEmailLive(args.to as string, args.subject as string, args.body as string, ctx)
          : {
              content: [
                {
                  type: "text",
                  text: `[Draft created] To: ${args.to}, Subject: ${args.subject}\n\n${args.body}`,
                },
              ],
            };
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${toolName}` }], isError: true };
    }
  },
};

async function searchDriveLive(
  query: string,
  maxResults: number | undefined,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const max = maxResults ?? 10;
  const q = encodeURIComponent(`fullText contains '${query.replace(/'/g, "\\'")}'`);
  const res = await googleFetch(
    ctx.connection,
    `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=${max}&fields=files(id,name,mimeType,modifiedTime)`
  );

  if (!res.ok) {
    return { content: [{ type: "text", text: `Drive search failed: ${await res.text()}` }], isError: true };
  }

  const data = (await res.json()) as { files?: Array<{ id: string; name: string; mimeType: string }> };
  const files = data.files ?? [];
  const text = files.length
    ? files.map((f) => `- ${f.name} (${f.id}, ${f.mimeType})`).join("\n")
    : "No documents found.";
  return { content: [{ type: "text", text }] };
}

async function readDriveLive(documentId: string, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
  const metaRes = await googleFetch(
    ctx.connection,
    `https://www.googleapis.com/drive/v3/files/${documentId}?fields=mimeType,name`
  );
  if (!metaRes.ok) {
    return { content: [{ type: "text", text: `Failed to get file metadata` }], isError: true };
  }
  const meta = (await metaRes.json()) as { mimeType: string; name: string };

  let content: string;
  if (meta.mimeType === "application/vnd.google-apps.document") {
    const exportRes = await googleFetch(
      ctx.connection,
      `https://www.googleapis.com/drive/v3/files/${documentId}/export?mimeType=text/plain`
    );
    content = exportRes.ok ? await exportRes.text() : "Could not export document";
  } else {
    const fileRes = await googleFetch(
      ctx.connection,
      `https://www.googleapis.com/drive/v3/files/${documentId}?alt=media`
    );
    content = fileRes.ok ? await fileRes.text() : "Could not read file";
  }

  return {
    content: [{ type: "text", text: `# ${meta.name}\n\n${content.slice(0, 8000)}` }],
  };
}

async function summarizeDriveLive(documentId: string, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
  const read = await readDriveLive(documentId, ctx);
  if (read.isError) return read;
  const text = read.content[0]?.text ?? "";
  const summary = text.length > 500 ? `${text.slice(0, 500)}... [truncated for summary]` : text;
  return { content: [{ type: "text", text: `Summary of document ${documentId}:\n${summary}` }] };
}

async function searchGmailLive(
  query: string,
  maxResults: number | undefined,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const max = maxResults ?? 10;
  const q = encodeURIComponent(query);
  const res = await googleFetch(
    ctx.connection,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${max}`
  );

  if (!res.ok) {
    return { content: [{ type: "text", text: `Gmail search failed: ${await res.text()}` }], isError: true };
  }

  const data = (await res.json()) as { messages?: Array<{ id: string; threadId: string }> };
  const messages = data.messages ?? [];
  const lines: string[] = [];

  for (const msg of messages.slice(0, 5)) {
    const detailRes = await googleFetch(
      ctx.connection,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`
    );
    if (detailRes.ok) {
      const detail = (await detailRes.json()) as {
        id: string;
        threadId: string;
        payload?: { headers?: Array<{ name: string; value: string }> };
      };
      const headers = detail.payload?.headers ?? [];
      const subject = headers.find((h) => h.name === "Subject")?.value ?? "(no subject)";
      const from = headers.find((h) => h.name === "From")?.value ?? "";
      lines.push(`- ${subject} | from: ${from} | id: ${msg.id} | thread: ${msg.threadId}`);
    }
  }

  return {
    content: [
      {
        type: "text",
        text: lines.length ? lines.join("\n") : "No emails found.",
      },
    ],
  };
}

async function summarizeThreadLive(threadId: string, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
  const res = await googleFetch(
    ctx.connection,
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`
  );

  if (!res.ok) {
    return { content: [{ type: "text", text: `Failed to fetch thread` }], isError: true };
  }

  const data = (await res.json()) as {
    messages?: Array<{ payload?: { headers?: Array<{ name: string; value: string }> } }>;
  };
  const messages = data.messages ?? [];
  const lines = messages.map((m, i) => {
    const headers = m.payload?.headers ?? [];
    const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
    const from = headers.find((h) => h.name === "From")?.value ?? "";
    return `${i + 1}. ${from}: ${subject}`;
  });

  return {
    content: [
      {
        type: "text",
        text: `Thread ${threadId} (${messages.length} messages):\n${lines.join("\n")}`,
      },
    ],
  };
}

async function draftEmailLive(
  to: string,
  subject: string,
  body: string,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");
  const encoded = Buffer.from(raw).toString("base64url");

  const res = await googleFetch(ctx.connection, "https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    body: JSON.stringify({ message: { raw: encoded } }),
  });

  if (!res.ok) {
    return { content: [{ type: "text", text: `Draft creation failed: ${await res.text()}` }], isError: true };
  }

  const data = (await res.json()) as { id: string };
  return { content: [{ type: "text", text: `Draft created (id: ${data.id}). To: ${to}, Subject: ${subject}` }] };
}

function mockSearch(source: string, query: string, ctx: ToolExecutionContext): ToolExecutionResult {
  return {
    content: [
      {
        type: "text",
        text: `[${source}] Found 3 results for "${query}" (tenant: ${ctx.tenantId}, connection: ${ctx.connection.id})`,
      },
    ],
  };
}

function mockRead(source: string, id: string, ctx: ToolExecutionContext): ToolExecutionResult {
  return {
    content: [
      {
        type: "text",
        text: `[${source}] Document ${id} content (tenant: ${ctx.tenantId})`,
      },
    ],
  };
}

function mockSummarize(source: string, id: string, _ctx: ToolExecutionContext): ToolExecutionResult {
  return {
    content: [
      {
        type: "text",
        text: `[${source}] Summary of ${id}: This is a placeholder summary.`,
      },
    ],
  };
}
