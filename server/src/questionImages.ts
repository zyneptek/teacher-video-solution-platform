// Soru görselleri: özel Storage bucket'ındadır, ama istemciye Supabase adresi yerine kendi sunucumuzun
// imzalı adresi verilir. Sunucu görseli bir kez Storage'dan alıp bellekte tutur (açılışta ısıtılır) ve
// tarayıcıya önbellek başlığıyla sunar; böylece görseller ilk istekte bile Storage gecikmesini yaşamaz.
// Adres, yetkili kullanıcıya verilir ve HMAC imzalı + süreli olduğundan tahmin edilip paylaşılamaz.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { BUCKETS } from './buckets.js';
import { config } from './config.js';
import { pool } from './db.js';
import { supabase } from './supabase.js';

const URL_WINDOW_S = 60 * 60; // imza ömrü ~1-2 saat; aynı saat içinde adres sabit kalır (tarayıcı önbelleği işe yarar)
const secret = createHash('sha256').update(`${config.supabaseSecretKey}:question-images`).digest();
const cache = new Map<string, Buffer>(); // soru kimliği → JPEG baytları

const sign = (questionId: string, exp: number) => createHmac('sha256', secret).update(`${questionId}.${exp}`).digest('hex');

// Soru görseli için (göreli) imzalı adres.
export function questionImageUrl(questionId: string): string {
  const exp = (Math.floor(Date.now() / 1000 / URL_WINDOW_S) + 2) * URL_WINDOW_S;
  return `/api/question-images/${questionId}?exp=${exp}&sig=${sign(questionId, exp)}`;
}

async function loadImage(questionId: string): Promise<Buffer | null> {
  const cached = cache.get(questionId);
  if (cached) return cached;
  const { rows } = await pool.query<{ image_path: string }>('select image_path from questions where id = $1', [questionId]);
  const path = rows[0]?.image_path;
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKETS.questionImages).download(path);
  if (error || !data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  cache.set(questionId, bytes);
  return bytes;
}

// Sunucu açılırken tüm görselleri önceden belleğe alır (arka planda, hata olursa sessizce geçer).
export async function warmQuestionImages(): Promise<void> {
  try {
    const { rows } = await pool.query<{ id: string }>('select id from questions');
    await Promise.all(rows.map((r) => loadImage(r.id).catch(() => null)));
    console.log(`Soru görselleri belleğe alındı (${cache.size})`);
  } catch (err) {
    console.error('Soru görselleri ısıtılamadı:', err instanceof Error ? err.message : err);
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const questionImagesRouter = Router();

questionImagesRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  const exp = Number(req.query.exp);
  const sig = typeof req.query.sig === 'string' ? req.query.sig : '';
  const expected = UUID_PATTERN.test(id) && Number.isFinite(exp) ? sign(id, exp) : '';
  const valid = expected.length > 0 && sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!valid || exp < Date.now() / 1000) {
    res.status(403).json({ error: 'Görsel adresi geçersiz veya süresi dolmuş.' });
    return;
  }
  try {
    const bytes = await loadImage(id);
    if (!bytes) {
      res.status(404).json({ error: 'Görsel bulunamadı.' });
      return;
    }
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' });
    res.send(bytes);
  } catch (err) {
    console.error('Görsel sunulamadı:', err);
    res.status(500).json({ error: 'Görsel sunulamadı.' });
  }
});
