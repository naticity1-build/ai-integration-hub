import { NextResponse } from "next/server";
import { createHubStore } from "@hub/db";
import { createSupabaseAdminClient, registerUser } from "@hub/auth";
import type { RegisterUserInput } from "@hub/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterUserInput;
    const store = createHubStore();
    const supabase = createSupabaseAdminClient();
    const result = await registerUser(store, supabase, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
