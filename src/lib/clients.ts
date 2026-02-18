import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// ── Supabase (safe for client & server) ─────────────────────────
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── OpenRouter (server-side only — no browser key exposure) ─────
export const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
});
