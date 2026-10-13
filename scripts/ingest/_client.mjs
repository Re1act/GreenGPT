// Shared service-role client + run-logging helper for ingestion scripts.
// Run any script with: node --env-file=.env.local scripts/ingest/<name>.mjs
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local scripts/ingest/<name>.mjs"
  );
}

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export async function withRunLog(sourceName, fn) {
  const startedAt = new Date();
  let rowsUpserted = 0;
  let rowsFailed = 0;
  let status = "success";
  let notes = null;

  try {
    const result = await fn();
    rowsUpserted = result?.rowsUpserted ?? 0;
    rowsFailed = result?.rowsFailed ?? 0;
    if (rowsFailed > 0) status = rowsUpserted > 0 ? "partial" : "failed";
    notes = result?.notes ?? null;
  } catch (err) {
    status = "failed";
    notes = String(err?.message ?? err);
    throw err;
  } finally {
    const finishedAt = new Date();
    const { error } = await supabase.rpc("log_ingestion_run", {
      p_source_name: sourceName,
      p_started_at: startedAt.toISOString(),
      p_finished_at: finishedAt.toISOString(),
      p_status: status,
      p_rows_upserted: rowsUpserted,
      p_rows_failed: rowsFailed,
      p_notes: notes,
    });
    if (error) {
      console.error(`[${sourceName}] failed to log ingestion run:`, error.message);
    }
    console.log(
      `[${sourceName}] ${status} — ${rowsUpserted} upserted, ${rowsFailed} failed (${(
        (finishedAt - startedAt) /
        1000
      ).toFixed(1)}s)`
    );
  }
}
