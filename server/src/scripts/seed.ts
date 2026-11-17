// Örnek veriyi yükler: kazanımlar, sorular (görselleriyle), yönetici ve örnek öğretmenler.
// Tekrar çalıştırmak güvenlidir: var olan kayıtlara dokunulmaz (yöneticinin yaptığı değişiklikler korunur).
import { readFile } from 'node:fs/promises';
import { branchFromOutcomeCode, type Branch } from '@app/shared';
import { pool } from '../db.js';
import { supabase } from '../supabase.js';
import { BUCKETS } from '../buckets.js';

const dataDir = new URL('../../../Örnek sorular/', import.meta.url);

type SourceQuestion = {
  id: string;
  answerKey: string;
  outcomeKeys: string[];
  questionNumber: number;
  page_num: number;
};

const ADMIN_PASSWORD = 'Admin12345!';
const TEACHER_PASSWORD = 'Ogretmen12345!';

const accounts: {
  email: string;
  password: string;
  role: 'admin' | 'teacher';
  firstName: string;
  lastName: string;
  branch: Branch | null;
}[] = [
  { email: 'admin@example.com', password: ADMIN_PASSWORD, role: 'admin', firstName: 'Yönetici', lastName: 'Hesabı', branch: null },
  { email: 'turkce@example.com', password: TEACHER_PASSWORD, role: 'teacher', firstName: 'Elif', lastName: 'Kaya', branch: 'Türkçe' },
  { email: 'matematik@example.com', password: TEACHER_PASSWORD, role: 'teacher', firstName: 'Mehmet', lastName: 'Demir', branch: 'Matematik' },
  { email: 'fizik@example.com', password: TEACHER_PASSWORD, role: 'teacher', firstName: 'Ahmet', lastName: 'Şahin', branch: 'Fizik' },
  { email: 'kimya@example.com', password: TEACHER_PASSWORD, role: 'teacher', firstName: 'Zeynep', lastName: 'Arslan', branch: 'Kimya' },
  { email: 'biyoloji@example.com', password: TEACHER_PASSWORD, role: 'teacher', firstName: 'Can', lastName: 'Öztürk', branch: 'Biyoloji' },
];

async function readJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(new URL(name, dataDir), 'utf8')) as T;
}

async function seedOutcomes(): Promise<void> {
  const outcomes = await readJson<Record<string, string>>('course_tree_Lise_key_description.json');
  const codes = Object.keys(outcomes);
  const descriptions = codes.map((code) => outcomes[code] as string);
  const branches = codes.map((code) => branchFromOutcomeCode(code));

  const { rowCount } = await pool.query(
    `insert into learning_outcomes (code, description, branch)
     select * from unnest($1::text[], $2::text[], $3::text[])
     on conflict (code) do nothing`,
    [codes, descriptions, branches],
  );
  console.log(`Kazanımlar: ${codes.length} kayıt okundu, ${rowCount} yeni eklendi`);
}

async function ensureBucket(): Promise<void> {
  const { data } = await supabase.storage.getBucket(BUCKETS.questionImages);
  if (data) return;
  const { error } = await supabase.storage.createBucket(BUCKETS.questionImages, { public: false });
  if (error) throw error;
}

async function seedQuestions(): Promise<void> {
  await ensureBucket();
  const questions = await readJson<SourceQuestion[]>('sample-10-tyt-ayt-questions.json');
  let added = 0;

  for (const q of questions) {
    const imagePath = `${q.id}.jpg`;
    const image = await readFile(new URL(imagePath, dataDir));
    const { error: uploadError } = await supabase.storage
      .from(BUCKETS.questionImages)
      .upload(imagePath, image, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;

    // Sorunun branşı, ilk kazanımın ön ekinden belirlenir.
    const branch = q.outcomeKeys.map(branchFromOutcomeCode).find((b) => b !== null);
    if (!branch) throw new Error(`Soru ${q.id}: kazanımlarından branş belirlenemedi`);

    const inserted = await pool.query<{ id: string }>(
      `insert into questions (source_id, branch, answer_key, image_path, question_number, page_num)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (source_id) do nothing
       returning id`,
      [q.id, branch, q.answerKey, imagePath, q.questionNumber, q.page_num],
    );
    const questionId = inserted.rows[0]?.id;
    if (!questionId) continue; // soru zaten vardı, dokunma

    const linked = await pool.query(
      `insert into question_outcomes (question_id, outcome_id)
       select $1, id from learning_outcomes where code = any($2::text[])`,
      [questionId, q.outcomeKeys],
    );
    if (linked.rowCount !== q.outcomeKeys.length) {
      throw new Error(`Soru ${q.id}: kazanımlardan bazıları veritabanında bulunamadı`);
    }
    added++;
  }
  console.log(`Sorular: ${questions.length} soru okundu, ${added} yeni eklendi (görseller yüklendi)`);
}

async function findAuthUserId(email: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((user) => user.email?.toLowerCase() === email)?.id ?? null;
}

async function seedAccounts(): Promise<void> {
  let added = 0;
  for (const account of accounts) {
    const existing = await pool.query(
      'select 1 from profiles where lower(email) = $1 and deleted_at is null',
      [account.email],
    );
    if (existing.rowCount) continue;

    let authUserId = await findAuthUserId(account.email);
    if (!authUserId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error(`${account.email} oluşturulamadı`);
      authUserId = data.user.id;
    }

    await pool.query(
      `insert into profiles (auth_user_id, role, first_name, last_name, email, branch)
       values ($1, $2, $3, $4, $5, $6)`,
      [authUserId, account.role, account.firstName, account.lastName, account.email, account.branch],
    );
    added++;
  }
  console.log(`Hesaplar: ${accounts.length} hesap tanımlı, ${added} yeni oluşturuldu`);
}

await seedOutcomes();
await seedQuestions();
await seedAccounts();
await pool.end();
