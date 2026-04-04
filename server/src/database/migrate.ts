import fs from 'fs';
import path from 'path';
import { pool, query } from './connection';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await query('SELECT name FROM _migrations ORDER BY id');
  return result.rows.map((r: any) => r.name);
}

async function runMigrations() {
  console.log('[MIGRATE] Starting database migrations...');

  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let ranCount = 0;

  for (const file of files) {
    if (executed.includes(file)) {
      continue;
    }

    console.log(`[MIGRATE] Running: ${file}`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[MIGRATE] Completed: ${file}`);
      ranCount++;
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(`[MIGRATE] Failed: ${file}`, err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  if (ranCount === 0) {
    console.log('[MIGRATE] Database is up to date.');
  } else {
    console.log(`[MIGRATE] Ran ${ranCount} migration(s) successfully.`);
  }
}

// Run if called directly (not when imported by app.ts)
const isDirectRun = process.argv[1]?.includes('migrate');
if (isDirectRun) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[MIGRATE] Fatal error:', err);
      process.exit(1);
    });
}

export { runMigrations };
