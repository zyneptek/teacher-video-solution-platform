// Çözüm kayıtları: üretilen MP4'ler özel "recordings" bucket'ında saklanır, kayıt bilgisi `recordings` tablosundadır.
// Atama başına tek güncel kayıt vardır (yeniden çekilince yenisi eskisinin yerine geçer; silinen kayıt satırı ve dosyası tamamen kaldırılır).
// Videolar tarayıcıya, kimlik doğrulaması olmadan çalışan <video> etiketi için HMAC imzalı, süreli bir adresle sunulur;
// adres yalnızca yetkili kullanıcıya (kaydın sahibi öğretmen veya yönetici) üretilir. Dosyalar sunucu diskinde önbelleğe
// alınır ve aralıklı istekle (Range) sunulur, böylece tarayıcı videoda ileri-geri sarabilir.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import type { RecordingInfo } from '@app/shared';
import { BUCKETS } from './buckets.js';
import { config } from './config.js';
import { pool } from './db.js';
import { supabase } from './supabase.js';

const CACHE_DIR = path.join(tmpdir(), 'recording-cache');
const URL_WINDOW_S = 60 * 60;
const secret = createHash('sha256').update(`${config.supabaseSecretKey}:recording-videos`).digest();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const sign = (id: string, version: number, exp: number) => createHmac('sha256', secret).update(`${id}.${version}.${exp}`).digest('hex');

export type RecordingRow = { id: string; duration_seconds: string | number | null; updated_at: Date };

// Kayıt için (göreli) imzalı video adresi; `v` sürümü, yeniden çekilen videonun tarayıcı önbelleğinde eski kalmasını önler.
export function recordingInfo(row: RecordingRow): RecordingInfo {
  const version = row.updated_at.getTime();
  const exp = (Math.floor(Date.now() / 1000 / URL_WINDOW_S) + 2) * URL_WINDOW_S;
  return {
    id: row.id,
    videoUrl: `/api/recording-videos/${row.id}?v=${version}&exp=${exp}&sig=${sign(row.id, version, exp)}`,
    durationSeconds: Number(row.duration_seconds ?? 0),
    updatedAt: row.updated_at.toISOString(),
  };
}

let bucketReady = false;
async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  const { data } = await supabase.storage.getBucket(BUCKETS.recordings);
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKETS.recordings, { public: false });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  bucketReady = true;
}

const cachePath = (id: string, version: number) => path.join(CACHE_DIR, `${id}-${version}.mp4`);

// Video, yöneticinin/diğer öğretmenlerin görmüş olabileceği bir aşamadan sonra (onaya gönderildi, onaylandı, geri gönderildi)
// ya da daha önce bir kez bu şekilde değiştirildikten sonra yeniden değişirse anı atamada saklar. Henüz hiç gönderilmemiş
// taslak videonun ilk düzenlemeleri işaretlenmez. Durum, çağıran tarafından sıfırlanmadan ÖNCE okunur (saveRecording/silme sonrası sıfırlanır).
async function markVideoReplaced(assignmentId: string): Promise<void> {
  await pool.query(
    "update assignments set video_replaced_at = now() where id = $1 and (video_replaced_at is not null or status in ('submitted', 'approved', 'returned'))",
    [assignmentId],
  );
}

// Üretilen MP4'ü Storage'a yükler ve atamanın kaydını oluşturur/günceller. Eski dosya silinir.
// keepPrevious: düzenleme (kırpma/silme) için eski sürüm "Geri al" geçmişine konur; yeniden çekimde geçmiş temizlenir.
export async function saveRecording(assignmentId: string, mp4Path: string, durationSeconds: number, keepPrevious = false): Promise<RecordingRow> {
  await ensureBucket();
  await markVideoReplaced(assignmentId);
  const old = await pool.query<{ id: string; video_path: string | null; duration_seconds: string | null }>('select id, video_path, duration_seconds from recordings where assignment_id = $1', [assignmentId]);
  const videoPath = `${assignmentId}/${Date.now()}.mp4`;
  const { error } = await supabase.storage.from(BUCKETS.recordings).upload(videoPath, await readFile(mp4Path), { contentType: 'video/mp4', upsert: true });
  if (error) throw error;

  const { rows } = await pool.query<RecordingRow>(
    `insert into recordings (assignment_id, video_path, duration_seconds, status)
     values ($1, $2, $3, 'ready')
     on conflict (assignment_id) do update
       set video_path = excluded.video_path, duration_seconds = excluded.duration_seconds, status = 'ready', deleted_at = null, updated_at = now()
     returning id, duration_seconds, updated_at`,
    [assignmentId, videoPath, durationSeconds],
  );
  const row = rows[0] as RecordingRow;
  // Video değişti (ilk kayıt, yeniden çekme veya düzenleme): eski videoya verilmiş çapraz kontrol değerlendirmeleri geçersizdir.
  await pool.query('delete from peer_checks where recording_id = $1', [row.id]);
  // Yeni dosya yerel önbelleğe de konur (ilk izleme Storage'a gitmeden açılır).
  await mkdir(CACHE_DIR, { recursive: true });
  await copyFile(mp4Path, cachePath(row.id, row.updated_at.getTime())).catch(() => undefined);
  const prev = old.rows[0];
  if (keepPrevious && prev?.video_path) {
    await pool.query('insert into recording_history (recording_id, video_path, duration_seconds) values ($1, $2, $3)', [prev.id, prev.video_path, prev.duration_seconds ?? 0]);
  } else {
    if (prev) await clearHistory(prev.id);
    if (prev?.video_path) await supabase.storage.from(BUCKETS.recordings).remove([prev.video_path]).catch(() => undefined);
  }
  return row;
}

// Kaydın düzenleme geçmişini (dosyalar ve satırlar) siler.
async function clearHistory(recordingId: string): Promise<void> {
  const { rows } = await pool.query<{ video_path: string }>('delete from recording_history where recording_id = $1 returning video_path', [recordingId]);
  if (rows.length > 0) await supabase.storage.from(BUCKETS.recordings).remove(rows.map((r) => r.video_path)).catch(() => undefined);
}

// Son düzenlemeyi geri alır: güncel video atılır, geçmişteki son sürüm güncel olur. Geri alınacak bir şey yoksa false döner.
export async function undoLastEdit(assignmentId: string): Promise<boolean> {
  const cur = await pool.query<{ id: string; video_path: string | null; updated_at: Date }>(
    "select id, video_path, updated_at from recordings where assignment_id = $1 and deleted_at is null and status = 'ready'",
    [assignmentId],
  );
  const current = cur.rows[0];
  if (!current) return false;
  const last = await pool.query<{ id: string; video_path: string; duration_seconds: string }>(
    'delete from recording_history where id = (select id from recording_history where recording_id = $1 order by created_at desc limit 1) returning id, video_path, duration_seconds',
    [current.id],
  );
  const prev = last.rows[0];
  if (!prev) return false;
  await markVideoReplaced(assignmentId);
  await pool.query('update recordings set video_path = $2, duration_seconds = $3, updated_at = now() where id = $1', [current.id, prev.video_path, prev.duration_seconds]);
  await pool.query('delete from peer_checks where recording_id = $1', [current.id]); // video değişti: eski değerlendirmeler geçersiz
  await rm(cachePath(current.id, current.updated_at.getTime()), { force: true });
  if (current.video_path) await supabase.storage.from(BUCKETS.recordings).remove([current.video_path]).catch(() => undefined);
  return true;
}

// Kaydı kalıcı siler: video dosyası Storage'dan, kayıt satırı (ve düzenleme geçmişi) veritabanından kaldırılır; silinen kayıt artık izlenemez.
export async function deleteRecording(assignmentId: string): Promise<boolean> {
  const current = await pool.query<{ id: string; video_path: string | null; updated_at: Date }>('select id, video_path, updated_at from recordings where assignment_id = $1', [assignmentId]);
  const old = current.rows[0];
  if (!old) return false;
  await markVideoReplaced(assignmentId);
  await clearHistory(old.id);
  await pool.query('delete from recordings where id = $1', [old.id]);
  await rm(cachePath(old.id, old.updated_at.getTime()), { force: true });
  if (old.video_path) await supabase.storage.from(BUCKETS.recordings).remove([old.video_path]).catch(() => undefined);
  return true;
}

// Her istekte önce veritabanına bakılır: silinmiş veya yeniden çekilerek değişmiş kayıt, diskte dosyası kalsa bile sunulmaz.
export async function fileFor(id: string, version: number): Promise<string | null> {
  const { rows } = await pool.query<{ video_path: string | null; updated_at: Date }>(
    "select video_path, updated_at from recordings where id = $1 and deleted_at is null and status = 'ready'",
    [id],
  );
  const row = rows[0];
  if (!row?.video_path || row.updated_at.getTime() !== version) return null;
  const file = cachePath(id, version);
  if (await stat(file).then(() => true, () => false)) return file;
  const { data, error } = await supabase.storage.from(BUCKETS.recordings).download(row.video_path);
  if (error || !data) return null;
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, Buffer.from(await data.arrayBuffer()));
  return file;
}

export const recordingVideosRouter = Router();

recordingVideosRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  const version = Number(req.query.v);
  const exp = Number(req.query.exp);
  const sig = typeof req.query.sig === 'string' ? req.query.sig : '';
  const expected = UUID_PATTERN.test(id) && Number.isFinite(version) && Number.isFinite(exp) ? sign(id, version, exp) : '';
  const valid = expected.length > 0 && sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!valid || exp < Date.now() / 1000) {
    res.status(403).json({ error: 'Video adresi geçersiz veya süresi dolmuş.' });
    return;
  }
  try {
    const file = await fileFor(id, version);
    if (!file) {
      res.status(404).json({ error: 'Video bulunamadı (silinmiş olabilir).' });
      return;
    }
    res.type('video/mp4');
    res.set('Cache-Control', 'private, max-age=3600');
    res.sendFile(file, (err) => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Video sunulamadı.' });
    });
  } catch (err) {
    console.error('Video sunulamadı:', err);
    res.status(500).json({ error: 'Video sunulamadı.' });
  }
});

// Atamanın güncel (silinmemiş, hazır) kaydı ve yerel dosyası; kırpma gibi işlemler için.
export async function currentRecordingFile(assignmentId: string): Promise<{ id: string; durationSeconds: number; file: string } | null> {
  const { rows } = await pool.query<{ id: string; duration_seconds: string | null; updated_at: Date }>(
    "select id, duration_seconds, updated_at from recordings where assignment_id = $1 and deleted_at is null and status = 'ready'",
    [assignmentId],
  );
  const row = rows[0];
  if (!row) return null;
  const file = await fileFor(row.id, row.updated_at.getTime());
  return file ? { id: row.id, durationSeconds: Number(row.duration_seconds ?? 0), file } : null;
}
