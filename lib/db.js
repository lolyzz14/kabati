// One small wrapper so the same code runs on Neon (online) and PGlite (on a computer, for testing).
const fs = require('fs');
const path = require('path');

let backend = null;

async function getBackend() {
  if (backend) return backend;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(url);
    backend = { kind: 'neon', query: (text, params) => sql.query(text, params || []) };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = process.env.PGLITE_DIR || path.join(process.cwd(), '.data', 'pg');
    if (dir !== 'memory://') fs.mkdirSync(dir, { recursive: true });
    const db = new PGlite(dir === 'memory://' ? undefined : dir);
    await db.waitReady;
    backend = {
      kind: 'pglite',
      query: async (text, params) => (await db.query(text, params || [])).rows,
      exec: (text) => db.exec(text),
    };
  }
  return backend;
}

async function q(text, params) {
  const b = await getBackend();
  return b.query(text, params);
}

async function one(text, params) {
  const rows = await q(text, params);
  return rows[0] || null;
}

let migrated = false;
async function migrate() {
  if (migrated) return;
  const b = await getBackend();
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  const statements = schema
    .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    .split(';').map((s) => s.trim()).filter(Boolean);
  for (const s of statements) await b.query(s);
  migrated = true;
}

module.exports = { q, one, migrate, getBackend };
