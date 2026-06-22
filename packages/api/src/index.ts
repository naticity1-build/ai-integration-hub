import { serve } from "@hono/node-server";
import { app } from "./app.js";

const port = Number(process.env.API_PORT ?? 3001);
console.log(`Hub API listening on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
