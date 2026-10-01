// Applies supabase/migrations/*.sql to the database before every build.
// Runs automatically through the `prebuild` npm script. On Vercel the Supabase
// integration provides POSTGRES_URL_NON_POOLING; locally it is read from .env.local.
// Applied migrations are tracked in blob_meta.migrations (not exposed by the Data API).

import { readdir, readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const root = path.resolve(import.meta.dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(root, file);
    if (!existsSync(full)) continue;
    for (const line of readFileSync(full, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
      if (match && !(match[1] in process.env)) process.env[match[1]] = match[2];
    }
  }
}

loadLocalEnv();

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

if (!connectionString || process.env.SKIP_MIGRATIONS === "1") {
  console.log("[migrate] skipped (no POSTGRES_URL_NON_POOLING or SKIP_MIGRATIONS=1)");
  process.exit(0);
}

// Supabase uses its own CA. Strip sslmode from the URL so pg does not try to verify it.
const url = new URL(connectionString);
url.searchParams.delete("sslmode");
url.searchParams.delete("supa");
url.searchParams.delete("pgbouncer");

const client = new pg.Client({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  await client.query("select pg_advisory_lock(727274)");
  await client.query(`
    create schema if not exists blob_meta;
    create table if not exists blob_meta.migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const { rows } = await client.query("select name from blob_meta.migrations");
  const applied = new Set(rows.map((row) => row.name));
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log(`[migrate] database is up to date (${files.length} migrations)`);
  }

  for (const file of pending) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    process.stdout.write(`[migrate] applying ${file} ... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into blob_meta.migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log("done");
    } catch (error) {
      await client.query("rollback");
      console.log("failed");
      throw error;
    }
  }

  // Ask PostgREST to pick up schema changes right away.
  if (pending.length > 0) await client.query("notify pgrst, 'reload schema'");
} catch (error) {
  console.error("[migrate] error:", error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
