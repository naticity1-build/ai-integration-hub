import type { ConnectorPlugin, ToolExecutionContext, ToolExecutionResult } from "../types.js";
import { googleFetch, getAccessToken } from "../credential-resolver.js";

const LIST_EVENTS_SCHEMA = {
  type: "object",
  properties: {
    timeMin: { type: "string", description: "ISO datetime start (default: now)" },
    timeMax: { type: "string", description: "ISO datetime end" },
    maxResults: { type: "number", default: 10 },
  },
};

const FIND_AVAILABILITY_SCHEMA = {
  type: "object",
  properties: {
    timeMin: { type: "string", description: "ISO datetime start" },
    timeMax: { type: "string", description: "ISO datetime end" },
    durationMinutes: { type: "number", default: 30 },
  },
  required: ["timeMin", "timeMax"],
};

export const googleCalendarConnector: ConnectorPlugin = {
  type: "google_calendar",
  displayName: "Google Calendar",

  getCapabilities() {
    return [
      {
        id: "gcal-list",
        connectorType: "google_calendar",
        toolName: "list_events",
        description: "List upcoming calendar events",
        inputSchema: LIST_EVENTS_SCHEMA,
      },
      {
        id: "gcal-availability",
        connectorType: "google_calendar",
        toolName: "find_availability",
        description: "Find free time slots in the calendar",
        inputSchema: FIND_AVAILABILITY_SCHEMA,
      },
    ];
  },

  async validateConnection(connection) {
    try {
      const res = await googleFetch(
        connection,
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1"
      );
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
    const live = (await getAccessToken(ctx.connection)) !== null;

    switch (toolName) {
      case "list_events":
        return live ? listEventsLive(args, ctx) : mockListEvents(ctx);
      case "find_availability":
        return live ? findAvailabilityLive(args, ctx) : mockAvailability(args, ctx);
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${toolName}` }], isError: true };
    }
  },
};

async function listEventsLive(
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const timeMin = (args.timeMin as string) ?? new Date().toISOString();
  const max = (args.maxResults as number) ?? 10;
  const params = new URLSearchParams({
    timeMin,
    maxResults: String(max),
    singleEvents: "true",
    orderBy: "startTime",
  });
  if (args.timeMax) params.set("timeMax", args.timeMax as string);

  const res = await googleFetch(
    ctx.connection,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`
  );

  if (!res.ok) {
    return { content: [{ type: "text", text: `Calendar list failed: ${await res.text()}` }], isError: true };
  }

  const data = (await res.json()) as {
    items?: Array<{ summary?: string; start?: { dateTime?: string }; end?: { dateTime?: string } }>;
  };
  const events = data.items ?? [];
  const text = events.length
    ? events.map((e) => `- ${e.summary ?? "(no title)"} | ${e.start?.dateTime ?? ""} - ${e.end?.dateTime ?? ""}`).join("\n")
    : "No upcoming events.";

  return { content: [{ type: "text", text }] };
}

async function findAvailabilityLive(
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const timeMin = args.timeMin as string;
  const timeMax = args.timeMax as string;
  const duration = (args.durationMinutes as number) ?? 30;

  const res = await googleFetch(
    ctx.connection,
    `https://www.googleapis.com/calendar/v3/freeBusy`,
    {
      method: "POST",
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: "primary" }],
      }),
    }
  );

  if (!res.ok) {
    return { content: [{ type: "text", text: `Availability check failed` }], isError: true };
  }

  const data = (await res.json()) as {
    calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
  };
  const busy = data.calendars?.primary?.busy ?? [];
  const text =
    busy.length === 0
      ? `Fully available between ${timeMin} and ${timeMax} for ${duration}min slots.`
      : `Busy periods:\n${busy.map((b) => `- ${b.start} to ${b.end}`).join("\n")}`;

  return { content: [{ type: "text", text }] };
}

function mockListEvents(ctx: ToolExecutionContext): ToolExecutionResult {
  return {
    content: [
      {
        type: "text",
        text: `[Google Calendar] 2 upcoming events (tenant: ${ctx.tenantId})\n- Team standup | tomorrow 09:00\n- Client call | tomorrow 14:00`,
      },
    ],
  };
}

function mockAvailability(args: Record<string, unknown>, ctx: ToolExecutionContext): ToolExecutionResult {
  return {
    content: [
      {
        type: "text",
        text: `[Google Calendar] Available slots between ${args.timeMin} and ${args.timeMax} (tenant: ${ctx.tenantId})`,
      },
    ],
  };
}
