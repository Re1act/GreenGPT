import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client. Bypasses grants entirely (writes facilities, legislation,
// drought, etc.). Only ever import this from ingestion scripts or an explicitly
// authenticated admin/curation route -- never from a route a browser can trigger
// without its own auth check, and never from client code.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Check .env.local against .env.local.example."
  );
}

export const supabaseService = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
