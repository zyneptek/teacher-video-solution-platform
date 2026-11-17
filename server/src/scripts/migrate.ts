// server/db/migrations altındaki SQL dosyalarını sırayla uygular.
// Uygulanan dosyalar schema_migrations tablosunda tutulur; tekrar çalıştırmak zararsızdır.
import { readdir, readFile } from 'node:fs/promises';
import { pool } from '../db.js';

const dir = new URL('../../db/migrations/', import.meta.url);

await pool.query(`
  create table if not exists schema_migrations (
    name       text primary key,
    applied_at timestamptz not null default now()
  );
  alter table schema_migrations enable row level security;
`);

const { rows } = await pool.query<{ name: string }>('select name from schema_migrations');
const applied = new Set(rows.map((row) => row.name));
const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();

for (const file of files) {
  if (applied.has(file)) {
    console.log(`[atlandı]    ${file}`);
    continue;
  }
  const sql = await readFile(new URL(file, dir), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into schema_migrations (name) values ($1)', [file]);
    await client.query('commit');
    console.log(`[uygulandı]  ${file}`);
  } catch (err) {
    await client.query('rollback');
    console.error(`[HATA]       ${file}: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
    break;
  } finally {
    client.release();
  }
}

await pool.end();
