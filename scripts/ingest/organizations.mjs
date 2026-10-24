// Loads the hand-curated directory in data/organizations.json into
// public.organizations. The JSON file is the source of truth: edit it, rerun
// this, and the table matches. Entries are keyed by (name, website), so fixing a
// description or flipping "verified" updates the existing row.
//
// Validation is strict on purpose -- a malformed entry stops the whole load
// rather than publishing half-checked data. Only rows with verified: true are
// ever shown publicly (row-level security in the local_brief migration).
// Run: node --env-file=.env.local scripts/ingest/organizations.mjs
import { readFileSync } from "node:fs";
import { supabase, withRunLog } from "./_client.mjs";
import { validateOrganization } from "./_organizations.mjs";

const FILE = "data/organizations.json";

async function run() {
  const { organizations } = JSON.parse(readFileSync(FILE, "utf8"));
  const problems = organizations.flatMap((o, i) =>
    validateOrganization(o).map((p) => `#${i} ${o.name ?? "(no name)"}: ${p}`)
  );
  if (problems.length) {
    throw new Error(`Fix ${FILE} before loading:\n  ${problems.join("\n  ")}`);
  }

  const rows = organizations.map((o) => ({ ...o, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from("organizations").upsert(rows, { onConflict: "name,website" });
  if (error) throw new Error(error.message);

  const verified = rows.filter((r) => r.verified).length;
  return {
    rowsUpserted: rows.length,
    rowsFailed: 0,
    notes: `${verified} verified (public), ${rows.length - verified} unverified (hidden)`,
  };
}

await withRunLog("organizations_manual", run);
