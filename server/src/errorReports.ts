// Hata bildirimleri: öğretmen bir soru için hata bildirir (tür, açıklama, görselde işaret, isteğe bağlı ek: ekran görüntüsü
// veya en fazla 1 dakikalık video); yönetici bildirimi ilgili sorunun üzerinde ve ayrı sayfada, gönderen öğretmenle görür.
// Ekler özel "error-attachments" bucket'ında saklanır ve imzalı, süreli adresle sunulur (video için Range destekli).
import { spawn } from 'node:child_process';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, mkdtemp, open, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { ERROR_REPORT_LIMITS, ERROR_REPORT_TYPES, type ErrorReportInfo, type ErrorReportType } from '@app/shared';
import { requireAuth } from './auth.js';
import { notifyAdmins } from './notifications.js';
import { config } from './config.js';
import { pool } from './db.js';
import { getFfmpegPath } from './render/renderVideo.js';
import { supabase } from './supabase.js';

const BUCKET = 'error-attachments';
const CACHE_DIR = path.join(tmpdir(), 'attachment-cache');
const URL_WINDOW_S = 60 * 60;
const secret = createHash('sha256').update(`${config.supabaseSecretKey}:error-attachments`).digest();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TYPE_VALUES = ERROR_REPORT_TYPES.map((t) => t.value) as string[];

const sign = (id: string, exp: number) => createHmac('sha256', secret).update(`${id}.${exp}`).digest('hex');
function attachmentUrl(id: string): string {
  const exp = (Math.floor(Date.now() / 1000 / URL_WINDOW_S) + 2) * URL_WINDOW_S;
  return `/api/error-attachments/${id}?exp=${exp}&sig=${sign(id, exp)}`;
}

let bucketReady = false;
async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  bucketReady = true;
}

// Videonun süresini ffmpeg çıktısından okur (saniye). Okunamazsa (bazı tarayıcı kayıtlarında süre yazılmaz) null döner.
async function videoSeconds(buffer: Buffer): Promise<number | null> {
  const dir = await mkdtemp(path.join(tmpdir(), 'probe-'));
  try {
    const file = path.join(dir, 'in.bin');
    await writeFile(file, buffer);
    const output = await new Promise<string>((resolve) => {
      const child = spawn(getFfmpegPath(), ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
      let text = '';
      child.stderr.on('data', (chunk: Buffer) => (text += chunk.toString()));
      child.on('close', () => resolve(text));
      child.on('error', () => resolve(''));
    });
    const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(output);
    return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

type ReportRow = {
  id: string;
  question_id: string;
  branch: string;
  question_number: number | null;
  first_name: string;
  last_name: string;
  type: ErrorReportType;
  description: string;
  marker_x: string | null;
  marker_y: string | null;
  attachment_path: string | null;
  attachment_type: 'image' | 'video' | null;
  created_at: Date;
};

const SELECT = `select e.id, e.question_id, q.branch, q.question_number, p.first_name, p.last_name, e.type, e.description,
                       e.marker_x, e.marker_y, e.attachment_path, e.attachment_type, e.created_at
                from error_reports e join questions q on q.id = e.question_id join profiles p on p.id = e.reporter_id`;

const toInfo = (r: ReportRow): ErrorReportInfo => ({
  id: r.id,
  questionId: r.question_id,
  questionLabel: `${r.branch} — ${r.question_number ? `Soru ${r.question_number}` : 'Soru'}`,
  reporterName: `${r.first_name} ${r.last_name}`,
  type: r.type,
  description: r.description,
  marker: r.marker_x !== null && r.marker_y !== null ? { x: Number(r.marker_x), y: Number(r.marker_y) } : null,
  attachment: r.attachment_path && r.attachment_type ? { url: attachmentUrl(r.id), type: r.attachment_type } : null,
  createdAt: r.created_at.toISOString(),
});

// ---- Öğretmen: bildirim gönder ve kendi bildirimlerini gör ----

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: ERROR_REPORT_LIMITS.videoBytes, files: 1 } });

export const teacherErrorReportsRouter = Router();
teacherErrorReportsRouter.use(requireAuth('teacher'));

// Yalnızca kendisine atanmış soru için bildirim gönderilebilir.
async function ownQuestionId(userId: string | undefined, assignmentId: string): Promise<string | null> {
  if (!UUID_PATTERN.test(assignmentId)) return null;
  const { rows } = await pool.query<{ question_id: string }>('select question_id from assignments where id = $1 and teacher_id = $2', [assignmentId, userId]);
  return rows[0]?.question_id ?? null;
}

teacherErrorReportsRouter.get('/:assignmentId/error-reports', async (req, res) => {
  try {
    const questionId = await ownQuestionId(req.user?.id, req.params.assignmentId);
    if (!questionId) {
      res.status(404).json({ error: 'Soru bulunamadı veya size atanmamış.' });
      return;
    }
    const { rows } = await pool.query<ReportRow>(`${SELECT} where e.question_id = $1 and e.reporter_id = $2 order by e.created_at desc`, [questionId, req.user?.id]);
    res.json({ reports: rows.map(toInfo) });
  } catch (err) {
    console.error('Bildirimler listelenemedi:', err);
    res.status(500).json({ error: 'Bildirimler yüklenemedi.' });
  }
});

teacherErrorReportsRouter.post('/:assignmentId/error-reports', upload.single('attachment'), async (req, res) => {
  const questionId = await ownQuestionId(req.user?.id, req.params.assignmentId);
  if (!questionId) {
    res.status(404).json({ error: 'Soru bulunamadı veya size atanmamış.' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const type = typeof body.type === 'string' ? body.type : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const markerX = body.markerX === undefined || body.markerX === '' ? null : Number(body.markerX);
  const markerY = body.markerY === undefined || body.markerY === '' ? null : Number(body.markerY);
  const file = req.file;

  if (!TYPE_VALUES.includes(type)) {
    res.status(400).json({ error: 'Hata türünü seçin.' });
    return;
  }
  if (type === 'other' && !description) {
    res.status(400).json({ error: 'Serbest bildirimde hatayı kısaca açıklamanız gerekir.' });
    return;
  }
  if (description.length > ERROR_REPORT_LIMITS.descriptionMax) {
    res.status(400).json({ error: `Açıklama en fazla ${ERROR_REPORT_LIMITS.descriptionMax} karakter olabilir.` });
    return;
  }
  const hasMarker = markerX !== null && markerY !== null;
  if ((markerX === null) !== (markerY === null) || (hasMarker && !(markerX >= 0 && markerX <= 1 && markerY >= 0 && markerY <= 1))) {
    res.status(400).json({ error: 'Geçersiz işaret konumu.' });
    return;
  }

  let attachmentType: 'image' | 'video' | null = null;
  if (file) {
    // Bazı istemciler (mobil) dosya türünü bildirmeyebilir: tür genel ise ilk baytlardan belirlenir.
    const mime = file.mimetype && file.mimetype !== 'application/octet-stream' ? file.mimetype : sniffBuffer(file.buffer);
    if ((ERROR_REPORT_LIMITS.imageTypes as readonly string[]).includes(mime)) {
      attachmentType = 'image';
      if (file.size > ERROR_REPORT_LIMITS.imageBytes) {
        res.status(400).json({ error: 'Ekran görüntüsü en fazla 5 MB olabilir.' });
        return;
      }
    } else if ((ERROR_REPORT_LIMITS.videoTypes as readonly string[]).includes(mime)) {
      attachmentType = 'video';
      const seconds = await videoSeconds(file.buffer);
      if (seconds !== null && seconds > ERROR_REPORT_LIMITS.videoSeconds + 1) {
        res.status(400).json({ error: 'Ek video en fazla 1 dakika olabilir.' });
        return;
      }
    } else {
      res.status(400).json({ error: 'Ek olarak yalnızca ekran görüntüsü (JPEG, PNG, WebP) veya video (MP4, WebM, MOV) eklenebilir.' });
      return;
    }
  }

  try {
    const id = randomUUID();
    let attachmentPath: string | null = null;
    if (file && attachmentType) {
      await ensureBucket();
      attachmentPath = `${id}`;
      const { error } = await supabase.storage.from(BUCKET).upload(attachmentPath, file.buffer, { contentType: file.mimetype, upsert: true });
      if (error) throw error;
    }
    await pool.query(
      `insert into error_reports (id, question_id, reporter_id, type, description, attachment_path, attachment_type, marker_x, marker_y)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, questionId, req.user?.id, type, description, attachmentPath, attachmentType, markerX, markerY],
    );
    await notifyAdmins({ type: 'error_reported', errorReportId: id }).catch((err) => console.error('Yönetici bildirimi yazılamadı:', err));
    const { rows } = await pool.query<ReportRow>(`${SELECT} where e.id = $1`, [id]);
    res.status(201).json({ report: toInfo(rows[0] as ReportRow) });
  } catch (err) {
    console.error('Hata bildirimi kaydedilemedi:', err);
    res.status(500).json({ error: 'Hata bildirimi gönderilemedi.' });
  }
});

// ---- Yönetici: bildirimleri gör (ilgili soruya göre süzülebilir) ----

export const adminErrorReportsRouter = Router();
adminErrorReportsRouter.use(requireAuth('admin'));

adminErrorReportsRouter.get('/', async (req, res) => {
  const questionId = typeof req.query.questionId === 'string' ? req.query.questionId : null;
  if (questionId && !UUID_PATTERN.test(questionId)) {
    res.status(400).json({ error: 'Geçersiz soru.' });
    return;
  }
  try {
    const { rows } = await pool.query<ReportRow>(`${SELECT} where ($1::uuid is null or e.question_id = $1) order by e.created_at desc`, [questionId]);
    res.json({ reports: rows.map(toInfo) });
  } catch (err) {
    console.error('Hata bildirimleri listelenemedi:', err);
    res.status(500).json({ error: 'Hata bildirimleri yüklenemedi.' });
  }
});

function sniffBuffer(head: Buffer): string {
  if (head[0] === 0x89 && head.toString('latin1', 1, 4) === 'PNG') return 'image/png';
  if (head[0] === 0xff && head[1] === 0xd8) return 'image/jpeg';
  if (head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'video/webm';
  if (head.toString('latin1', 4, 8) === 'ftyp') return head.toString('latin1', 8, 10) === 'qt' ? 'video/quicktime' : 'video/mp4';
  return 'application/octet-stream';
}

// Dosyanın ilk baytlarından içerik türünü belirler (yüklenirken tür ayrıca saklanmadığı için).
async function sniffContentType(file: string): Promise<string> {
  const handle = await open(file, 'r');
  try {
    const head = Buffer.alloc(12);
    await handle.read(head, 0, 12, 0);
    if (head[0] === 0x89 && head.toString('latin1', 1, 4) === 'PNG') return 'image/png';
    if (head[0] === 0xff && head[1] === 0xd8) return 'image/jpeg';
    if (head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
    if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'video/webm';
    if (head.toString('latin1', 4, 8) === 'ftyp') return head.toString('latin1', 8, 10) === 'qt' ? 'video/quicktime' : 'video/mp4';
    return 'application/octet-stream';
  } finally {
    await handle.close();
  }
}

// ---- Ek dosyaların sunumu (imzalı adres; video için Range destekli) ----

export const errorAttachmentsRouter = Router();

errorAttachmentsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  const exp = Number(req.query.exp);
  const sig = typeof req.query.sig === 'string' ? req.query.sig : '';
  const expected = UUID_PATTERN.test(id) && Number.isFinite(exp) ? sign(id, exp) : '';
  if (!expected || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) || exp < Date.now() / 1000) {
    res.status(403).json({ error: 'Ek adresi geçersiz veya süresi dolmuş.' });
    return;
  }
  try {
    const { rows } = await pool.query<{ attachment_path: string | null; attachment_type: 'image' | 'video' | null }>('select attachment_path, attachment_type from error_reports where id = $1', [id]);
    const row = rows[0];
    if (!row?.attachment_path) {
      res.status(404).json({ error: 'Ek bulunamadı.' });
      return;
    }
    const file = path.join(CACHE_DIR, id);
    if (!(await stat(file).then(() => true, () => false))) {
      const { data, error } = await supabase.storage.from(BUCKET).download(row.attachment_path);
      if (error || !data) {
        res.status(404).json({ error: 'Ek bulunamadı.' });
        return;
      }
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(file, Buffer.from(await data.arrayBuffer()));
    }
    res.set('Cache-Control', 'private, max-age=3600');
    res.sendFile(file, { headers: { 'Content-Type': await sniffContentType(file) } }, (err) => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Ek sunulamadı.' });
    });
  } catch (err) {
    console.error('Ek sunulamadı:', err);
    res.status(500).json({ error: 'Ek sunulamadı.' });
  }
});
