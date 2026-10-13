// Deployment-only database tool. Never imported into the application bundle.
require('@next/env').loadEnvConfig(process.cwd());
const { Client } = require('pg');
const { readFileSync, readdirSync } = require('node:fs');
const { createHash } = require('node:crypto');
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required in an ignored environment file');
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 12000,
    ssl: { rejectUnauthorized: true, ...(process.env.DATABASE_CA_PATH ? { ca: readFileSync(process.env.DATABASE_CA_PATH, 'utf8') } : {}) } });
  try {
    await client.connect();
    const tables = await client.query("select tablename from pg_tables where schemaname='public' order by tablename");
    console.log(`Connected. Public tables: ${tables.rows.map(r => r.tablename).join(', ') || '(empty)'}`);
    if (process.argv.includes('--check')) return;
    const exists = await client.query("select to_regclass('edge_deploy.migrations') present");
    const applied = exists.rows[0].present ? (await client.query('select name, checksum from edge_deploy.migrations')).rows : [];
    if (!exists.rows[0].present && tables.rows.length) throw new Error('Untracked public schema detected. Reconcile existing migrations before applying; no changes made.');
    const migrations = readdirSync('supabase/migrations').filter(n => n.endsWith('.sql')).sort().map(name => {
      const sql = readFileSync(`supabase/migrations/${name}`, 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    });
    for (const migration of applied) {
      if (migrations.find(m => m.name === migration.name)?.checksum !== migration.checksum) throw new Error(`Applied migration changed or missing: ${migration.name}`);
    }
    const pending = migrations.filter(m => !applied.some(a => a.name === m.name));
    console.log(`Pending migrations: ${pending.map(m => m.name).join(', ') || '(none)'}`);
    if (!process.argv.includes('--apply')) { console.log('Dry run only. Use npm run db:migrate to apply this plan. Development seed is excluded.'); return; }
    await client.query('BEGIN');
    try {
      await client.query("select pg_advisory_xact_lock(hashtext('edgedirect2u-migrations'))");
      await client.query('create schema if not exists edge_deploy; revoke all on schema edge_deploy from public, anon, authenticated; create table if not exists edge_deploy.migrations(name text primary key, checksum text not null, applied_at timestamptz not null default now())');
      // Re-read under the lock to tolerate another deployment completing first.
      const locked = (await client.query('select name, checksum from edge_deploy.migrations')).rows;
      for (const m of pending) {
        const prior = locked.find(a => a.name === m.name);
        if (prior) { if (prior.checksum !== m.checksum) throw new Error(`Migration checksum mismatch: ${m.name}`); continue; }
        await client.query(m.sql);
        await client.query('insert into edge_deploy.migrations(name,checksum) values($1,$2)', [m.name,m.checksum]);
        console.log(`Applied ${m.name}`);
      }
      await client.query("NOTIFY pgrst, 'reload schema'");
      await client.query('COMMIT');
      console.log('Migrations committed. No development fixtures were inserted.');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } finally { await client.end(); }
}
main().catch(error => { console.error(`Database operation failed (${error.code || 'configuration'}): ${error.message}`); process.exitCode = 1; });
