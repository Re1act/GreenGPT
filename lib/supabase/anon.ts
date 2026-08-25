import "server-only";
import { createClient } from "@supabase/supabase-js";

// Anon-key client for read-only server-side data access (route handlers, RPCs).
// Safe by construction: the `anon` role only has SELECT granted, via
// supabase/migrations/20260825174706_grant_public_read.sql and the follow-up
// grants in the map overlay migrations. This client can never write.
//
// Marked server-only even though the anon key is itself safe to expose to the
// browser, so that route handlers stay the single place server data access is
// wired up -- if a component needs this data, it should call our API route,
// not import this client directly into client code.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Check .env.local against .env.local.example."
  );
}

export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});
