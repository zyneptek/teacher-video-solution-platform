// Yönetici: soru listesi/detayı, cevap anahtarı ve soruya kazanım ekleme/çıkarma; kazanım arama ve güncelleme.
// Her değişiklik anında veritabanına yazılır. Soru görselleri özel bucket'tadır; yönetici ekranına süreli imzalı adresle verilir.
import { Router } from 'express';
import { ANSWER_KEYS, BRANCHES, type Branch, type OutcomeInfo, type QuestionInfo } from '@app/shared';
import { requireAuth } from '../auth.js';
import { BUCKETS } from '../buckets.js';
import { pool } from '../db.js';
import { supabase } from '../supabase.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IMAGE_URL_SECONDS = 60 * 60;

type OutcomeRow = { id: string; code: string; description: string; branch: Branch | null };
type QuestionRow = { id: string; branch: Branch; answer_key: QuestionInfo['answerKey']; question_number: number | null; image_path: string };

const toOutcome = (row: OutcomeRow): OutcomeInfo => ({ id: Number(row.id), code: row.code, description: row.description, branch: row.branch });

// Sorulara kazanımlarını ve görsel adreslerini ekleyerek istemci biçimine çevirir.
async function loadQuestions(where: string, params: unknown[]): Promise<QuestionInfo[]> {
  const { rows } = await pool.query<QuestionRow>(
    `select id, branch, answer_key, question_number, image_path from questions ${where} order by branch, question_number nulls last, created_at`,
    params,
  );
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [links, signed] = await Promise.all([
    pool.query<OutcomeRow & { question_id: string }>(
      `select qo.question_id, o.id, o.code, o.description, o.branch
       from question_outcomes qo join learning_outcomes o on o.id = qo.outcome_id
       where qo.question_id = any($1::uuid[]) order by o.code`,
      [ids],
    ),
    supabase.storage.from(BUCKETS.questionImages).createSignedUrls(rows.map((r) => r.image_path), IMAGE_URL_SECONDS),
  ]);
  const urlByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    branch: r.branch,
    answerKey: r.answer_key,
    questionNumber: r.question_number,
    imageUrl: urlByPath.get(r.image_path) ?? null,
    outcomes: links.rows.filter((l) => l.question_id === r.id).map(toOutcome),
  }));
}

export const adminQuestionsRouter = Router();
adminQuestionsRouter.use(requireAuth('admin'));

adminQuestionsRouter.get('/', async (_req, res) => {
  try {
    res.json({ questions: await loadQuestions('', []) });
  } catch (err) {
    console.error('Sorular listelenemedi:', err);
    res.status(500).json({ error: 'Sorular listelenemedi.' });
  }
});

adminQuestionsRouter.get('/:id', async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(400).json({ error: 'Geçersiz soru.' });
    return;
  }
  try {
    const [question] = await loadQuestions('where id = $1', [req.params.id]);
    if (!question) {
      res.status(404).json({ error: 'Soru bulunamadı.' });
      return;
    }
    res.json({ question });
  } catch (err) {
    console.error('Soru alınamadı:', err);
    res.status(500).json({ error: 'Soru alınamadı.' });
  }
});

// Cevap anahtarını günceller.
adminQuestionsRouter.patch('/:id', async (req, res) => {
  const answerKey = (req.body as { answerKey?: unknown } | undefined)?.answerKey;
  if (!UUID_PATTERN.test(req.params.id) || typeof answerKey !== 'string' || !(ANSWER_KEYS as readonly string[]).includes(answerKey)) {
    res.status(400).json({ error: 'Cevap anahtarı A, B, C, D veya E olmalı.' });
    return;
  }
  try {
    const result = await pool.query('update questions set answer_key = $1, updated_at = now() where id = $2', [answerKey, req.params.id]);
    if (!result.rowCount) {
      res.status(404).json({ error: 'Soru bulunamadı.' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Cevap anahtarı güncellenemedi:', err);
    res.status(500).json({ error: 'Cevap anahtarı güncellenemedi.' });
  }
});

// Soruya kazanım ekler (zaten ekliyse sessizce geçer).
adminQuestionsRouter.post('/:id/outcomes', async (req, res) => {
  const outcomeId = Number((req.body as { outcomeId?: unknown } | undefined)?.outcomeId);
  if (!UUID_PATTERN.test(req.params.id) || !Number.isInteger(outcomeId)) {
    res.status(400).json({ error: 'Geçersiz istek.' });
    return;
  }
  try {
    await pool.query('insert into question_outcomes (question_id, outcome_id) values ($1, $2) on conflict do nothing', [req.params.id, outcomeId]);
    res.status(201).json({ ok: true });
  } catch (err) {
    // Soru veya kazanım yoksa yabancı anahtar hatası (23503) gelir.
    if ((err as { code?: string }).code === '23503') {
      res.status(404).json({ error: 'Soru veya kazanım bulunamadı.' });
      return;
    }
    console.error('Kazanım eklenemedi:', err);
    res.status(500).json({ error: 'Kazanım eklenemedi.' });
  }
});

// Sorudan kazanım çıkarır; her soruda en az bir kazanım kalmalıdır.
adminQuestionsRouter.delete('/:id/outcomes/:outcomeId', async (req, res) => {
  const outcomeId = Number(req.params.outcomeId);
  if (!UUID_PATTERN.test(req.params.id) || !Number.isInteger(outcomeId)) {
    res.status(400).json({ error: 'Geçersiz istek.' });
    return;
  }
  try {
    const count = await pool.query<{ n: string }>('select count(*) as n from question_outcomes where question_id = $1', [req.params.id]);
    if (Number(count.rows[0]?.n ?? 0) <= 1) {
      res.status(409).json({ error: 'Bir sorunun en az bir kazanımı olmalı; son kazanım çıkarılamaz.' });
      return;
    }
    await pool.query('delete from question_outcomes where question_id = $1 and outcome_id = $2', [req.params.id, outcomeId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Kazanım çıkarılamadı:', err);
    res.status(500).json({ error: 'Kazanım çıkarılamadı.' });
  }
});

export const adminOutcomesRouter = Router();
adminOutcomesRouter.use(requireAuth('admin'));

const SEARCH_LIMIT = 30;

// Arama: kodda veya açıklamada geçen metin (içerir araması, büyük/küçük harf duyarsız);
// isteğe bağlı branş filtresi. İstemci her tuşta (kısa gecikmeyle) çağırır; sonuçlar veritabanından süzülür.
adminOutcomesRouter.get('/', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const branch = typeof req.query.branch === 'string' ? req.query.branch : '';
  if (branch && !(BRANCHES as readonly string[]).includes(branch)) {
    res.status(400).json({ error: 'Geçersiz branş.' });
    return;
  }
  try {
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const { rows } = await pool.query<OutcomeRow>(
      `select id, code, description, branch from learning_outcomes
       where ($1 = '' or code ilike $2 or description ilike $2) and ($3 = '' or branch = $3)
       order by code limit ${SEARCH_LIMIT}`,
      [q, pattern, branch],
    );
    res.json({ outcomes: rows.map(toOutcome), limit: SEARCH_LIMIT });
  } catch (err) {
    console.error('Kazanım araması başarısız:', err);
    res.status(500).json({ error: 'Kazanımlar aranamadı.' });
  }
});

// Kazanım kaydını günceller (açıklama ve branş; kod değişmez).
adminOutcomesRouter.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const body = (req.body ?? {}) as { description?: unknown; branch?: unknown };
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const branch = body.branch === null || body.branch === '' ? null : body.branch;
  if (!Number.isInteger(id) || !description || (branch !== null && !(BRANCHES as readonly unknown[]).includes(branch))) {
    res.status(400).json({ error: 'Açıklama boş olamaz; branş geçerli bir branş olmalı veya boş bırakılmalı.' });
    return;
  }
  try {
    const { rows } = await pool.query<OutcomeRow>(
      'update learning_outcomes set description = $1, branch = $2 where id = $3 returning id, code, description, branch',
      [description, branch, id],
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'Kazanım bulunamadı.' });
      return;
    }
    res.json({ outcome: toOutcome(rows[0]) });
  } catch (err) {
    console.error('Kazanım güncellenemedi:', err);
    res.status(500).json({ error: 'Kazanım güncellenemedi.' });
  }
});
