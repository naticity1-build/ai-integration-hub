import { handle } from "hono/vercel";
import { app } from "@hub/api/app";

export const runtime = "nodejs";

const handler = handle(app);

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
export const PUT = handler;
