// Supabase bağlantısını üç yerden dener: veritabanı, Auth ve Storage.
// Geçici kayıtlar oluşturur ve hemen siler. Anahtar ve şifre yazdırılmaz.
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { supabase } from '../supabase.js';

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function step(name: string, run: () => Promise<void>): Promise<boolean> {
  try {
    await run();
    console.log(`[OK]    ${name}`);
    return true;
  } catch (err) {
    console.log(`[HATA]  ${name}: ${describe(err)}`);
    return false;
  }
}

const results: boolean[] = [];

results.push(
  await step('Veritabanı bağlantısı (Postgres)', async () => {
    const { rows } = await pool.query('select current_database() as db');
    if (!rows[0]?.db) throw new Error('Beklenen sonuç gelmedi');
  }),
);

results.push(
  await step('Auth: kullanıcı oluştur ve sil', async () => {
    const email = `baglanti-testi-${randomUUID()}@example.com`;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: randomUUID(),
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error('Kullanıcı oluşturulamadı');
    const { error: delError } = await supabase.auth.admin.deleteUser(data.user.id);
    if (delError) throw delError;
  }),
);

results.push(
  await step('Storage: bucket aç, dosya yükle, sil', async () => {
    const bucket = `baglanti-testi-${randomUUID().slice(0, 8)}`;
    const { error: createError } = await supabase.storage.createBucket(bucket, { public: false });
    if (createError) throw createError;
    try {
      const { error: upError } = await supabase.storage
        .from(bucket)
        .upload('test.txt', Buffer.from('merhaba'), { contentType: 'text/plain' });
      if (upError) throw upError;
      const { error: rmError } = await supabase.storage.from(bucket).remove(['test.txt']);
      if (rmError) throw rmError;
    } finally {
      await supabase.storage.deleteBucket(bucket);
    }
  }),
);

await pool.end();
process.exit(results.every(Boolean) ? 0 : 1);
