// Öğretmen: kendisine atanan sorular ve kendi bildirimleri.
// Görünürlük kuralı: öğretmen yalnızca KENDİ atamalarını, kayıtlarını ve bildirimlerini görür; başkasının
// atamasına erişim denemesi "bulunamadı" (404) döner (varlığı bile belli edilmez).
// Öğretmene cevap anahtarı gösterilmez (varsayım, README'de); sorunun kazanımları gösterilir.
import { Router } from 'express';
import multer from 'multer';
import type { AssignmentStatus, Branch, OutcomeInfo, TeacherAssignment } from '@app/shared';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';
import { notifyAdmins } from '../notifications.js';
import { loadImage, questionImageUrl } from '../questionImages.js';
import { BadUploadError, renderFromUpload } from '../render/renderFromUpload.js';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getFfmpegPath } from '../render/renderVideo.js';
import { currentRecordingFile, deleteRecording, recordingInfo, saveRecording } from '../recordings.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const teacherRouter = Router();
teacherRouter.use(requireAuth('teacher'));

type AssignmentRow = {
  id: string;
  status: AssignmentStatus;
  return_note: string | null;
  assigned_at: Date;
  question_id: string;
  branch: Branch;
  question_number: number | null;
  rec_id: string | null;
  rec_duration: string | null;
  rec_updated: Date | null;
  outcomes: { id: number; code: string; description: string; branch: Branch | null }[];
};

// Öğretmenin atamaları (tek sorgu): soru bilgisi, kazanımlar ve kayıt var mı.
const SELECT = `
  select a.id, a.status, a.return_note, a.assigned_at, q.id as question_id, q.branch, q.question_number,
         r.id as rec_id, r.duration_seconds as rec_duration, r.updated_at as rec_updated,
         coalesce((select json_agg(json_build_object('id', o.id, 'code', o.code, 'description', o.description, 'branch', o.branch) order by o.code)
                   from question_outcomes qo join learning_outcomes o on o.id = qo.outcome_id where qo.question_id = q.id), '[]'::json) as outcomes
  from assignments a join questions q on q.id = a.question_id
  left join recordings r on r.assignment_id = a.id and r.deleted_at is null and r.status = 'ready'
  where a.teacher_id = $1`;

const toAssignment = (r: AssignmentRow): TeacherAssignment => ({
  id: r.id,
  status: r.status,
  returnNote: r.return_note,
  assignedAt: r.assigned_at.toISOString(),
  recording: r.rec_id && r.rec_updated ? recordingInfo({ id: r.rec_id, duration_seconds: r.rec_duration, updated_at: r.rec_updated }) : null,
  question: {
    id: r.question_id,
    branch: r.branch,
    questionNumber: r.question_number,
    imageUrl: questionImageUrl(r.question_id),
    outcomes: r.outcomes as OutcomeInfo[],
  },
});

teacherRouter.get('/assignments', async (req, res) => {
  try {
    const { rows } = await pool.query<AssignmentRow>(`${SELECT} order by a.assigned_at desc`, [req.user?.id]);
    res.json({ assignments: rows.map(toAssignment) });
  } catch (err) {
    console.error('Atamalar listelenemedi:', err);
    res.status(500).json({ error: 'Sorular yüklenemedi.' });
  }
});

teacherRouter.get('/assignments/:id', async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(404).json({ error: 'Soru bulunamadı.' });
    return;
  }
  try {
    const { rows } = await pool.query<AssignmentRow>(`${SELECT} and a.id = $2`, [req.user?.id, req.params.id]);
    if (!rows[0]) {
      res.status(404).json({ error: 'Soru bulunamadı veya size atanmamış.' });
      return;
    }
    res.json({ assignment: toAssignment(rows[0]) });
  } catch (err) {
    console.error('Atama alınamadı:', err);
    res.status(500).json({ error: 'Soru yüklenemedi.' });
  }
});

// ---- Çözüm kaydı: yükleme (sunucuda MP4'e çevrilir ve kaydedilir), silme ve onaya gönderme ----

// Dosya başına sınır (ses ve kamera klipleri) ve çizim günlüğü (metin alanı) sınırı. Çizim günlüğü en fazla
// 200.000 nokta taşıyabildiğinden alan sınırı varsayılan 1 MB'tan yükseltilmiştir.
const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;
const MAX_EVENTS_FIELD_BYTES = 16 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 12, fieldSize: MAX_EVENTS_FIELD_BYTES } });

type OwnRow = { id: string; status: AssignmentStatus; question_id: string };

// Atama bu öğretmene aitse döndürür (başkasınınkine erişim yok).
async function ownAssignment(userId: string | undefined, id: string): Promise<OwnRow | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const { rows } = await pool.query<OwnRow>('select id, status, question_id from assignments where id = $1 and teacher_id = $2', [id, userId]);
  return rows[0] ?? null;
}

// Kayıt değişince onay durumu güncellenir (görev: "düzenleme önceki onay durumunu değiştirir; yeniden onaya gönderilmeli").
// Onaya gönderilmiş veya onaylanmış atama taslağa (Atandı) döner; geri gönderilmiş atama "Geri gönderildi" kalır
// (yönetici notu görünmeye devam eder, öğretmen düzeltip yeniden gönderir).
async function resetReviewState(assignmentId: string): Promise<void> {
  await pool.query("update assignments set status = 'assigned', submitted_at = null, reviewed_at = null where id = $1 and status in ('submitted', 'approved')", [assignmentId]);
}

async function respondWithAssignment(res: import('express').Response, userId: string | undefined, id: string, status = 200): Promise<void> {
  const { rows } = await pool.query<AssignmentRow>(`${SELECT} and a.id = $2`, [userId, id]);
  res.status(status).json({ assignment: rows[0] ? toAssignment(rows[0]) : null });
}

teacherRouter.post(
  '/assignments/:id/recording',
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'camera', maxCount: 10 },
  ]),
  async (req, res) => {
    const own = await ownAssignment(req.user?.id, req.params.id);
    if (!own) {
      res.status(404).json({ error: 'Soru bulunamadı veya size atanmamış.' });
      return;
    }
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const body = (req.body ?? {}) as Record<string, unknown>;
    let cleanup: (() => Promise<void>) | null = null;
    try {
      const image = await loadImage(own.question_id);
      if (!image) {
        res.status(500).json({ error: 'Soru görseli bulunamadı.' });
        return;
      }
      const rendered = await renderFromUpload({
        image,
        audio: files?.audio?.[0],
        cameraClips: files?.camera ?? [],
        eventsText: body.events,
        durationText: body.durationMs,
      });
      cleanup = rendered.cleanup;
      await saveRecording(own.id, rendered.mp4Path, rendered.durationMs / 1000);
      await resetReviewState(own.id);
      await respondWithAssignment(res, req.user?.id, own.id, 201);
    } catch (err) {
      if (err instanceof BadUploadError) {
        res.status(400).json({ error: err.message });
        return;
      }
      console.error('Kayıt oluşturulamadı:', err);
      res.status(500).json({ error: 'Video oluşturulamadı veya kaydedilemedi.' });
    } finally {
      await cleanup?.();
    }
  },
);

teacherRouter.delete('/assignments/:id/recording', async (req, res) => {
  const own = await ownAssignment(req.user?.id, req.params.id);
  if (!own) {
    res.status(404).json({ error: 'Soru bulunamadı veya size atanmamış.' });
    return;
  }
  try {
    if (!(await deleteRecording(own.id))) {
      res.status(404).json({ error: 'Silinecek kayıt yok.' });
      return;
    }
    await resetReviewState(own.id);
    await respondWithAssignment(res, req.user?.id, own.id);
  } catch (err) {
    console.error('Kayıt silinemedi:', err);
    res.status(500).json({ error: 'Kayıt silinemedi.' });
  }
});

// Onaya gönder: yalnızca hazır bir kaydı olan, "Atandı" veya "Geri gönderildi" durumundaki atama gönderilebilir.
teacherRouter.post('/assignments/:id/submit', async (req, res) => {
  const own = await ownAssignment(req.user?.id, req.params.id);
  if (!own) {
    res.status(404).json({ error: 'Soru bulunamadı veya size atanmamış.' });
    return;
  }
  if (own.status !== 'assigned' && own.status !== 'returned') {
    res.status(409).json({ error: 'Bu kayıt zaten onaya gönderilmiş veya onaylanmış.' });
    return;
  }
  try {
    const rec = await pool.query("select 1 from recordings where assignment_id = $1 and deleted_at is null and status = 'ready'", [own.id]);
    if (!rec.rowCount) {
      res.status(409).json({ error: 'Onaya göndermek için önce bir çözüm kaydı oluşturun.' });
      return;
    }
    await pool.query("update assignments set status = 'submitted', submitted_at = now(), reviewed_at = null, return_note = null where id = $1", [own.id]);
    await notifyAdmins({ type: 'recording_submitted', assignmentId: own.id }).catch((err) => console.error('Yönetici bildirimi yazılamadı:', err));
    await respondWithAssignment(res, req.user?.id, own.id);
  } catch (err) {
    console.error('Onaya gönderilemedi:', err);
    res.status(500).json({ error: 'Onaya gönderilemedi.' });
  }
});

// ---- Kırpma: kaydın başından ve/veya sonundan kesilir; kırpılmış MP4 kaydın yerine geçer (yönetici kırpılmış videoyu izler) ----

const MIN_TRIM_SECONDS = 1;

// ffmpeg ile [start, end] aralığını yeniden kodlayarak keser (kare hassasiyeti için yeniden kodlama; kayıtlar kısa olduğundan hızlıdır).
function trimFile(input: string, output: string, start: number, end: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['-y', '-i', input, '-ss', start.toFixed(3), '-to', end.toFixed(3), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', output];
    const child = spawn(getFfmpegPath(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => (stderr = (stderr + chunk.toString()).slice(-1500)));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${stderr.trim().split('\n').slice(-2).join(' | ')}`))));
  });
}

teacherRouter.post('/assignments/:id/recording/trim', async (req, res) => {
  const own = await ownAssignment(req.user?.id, req.params.id);
  if (!own) {
    res.status(404).json({ error: 'Soru bulunamadı veya size atanmamış.' });
    return;
  }
  const { start, end } = (req.body ?? {}) as { start?: unknown; end?: unknown };
  const current = await currentRecordingFile(own.id);
  if (!current) {
    res.status(404).json({ error: 'Kırpılacak kayıt yok.' });
    return;
  }
  const startS = Number(start);
  const endS = Number(end);
  if (!Number.isFinite(startS) || !Number.isFinite(endS) || startS < 0 || endS > current.durationSeconds + 0.5 || endS - startS < MIN_TRIM_SECONDS) {
    res.status(400).json({ error: `Geçersiz aralık: başlangıç 0 veya daha büyük, bitiş kayıt süresinden küçük ve aradaki süre en az ${MIN_TRIM_SECONDS} sn olmalı.` });
    return;
  }
  const dir = await mkdtemp(path.join(tmpdir(), 'trim-'));
  try {
    const output = path.join(dir, 'trimmed.mp4');
    await trimFile(current.file, output, startS, Math.min(endS, current.durationSeconds));
    await saveRecording(own.id, output, Math.min(endS, current.durationSeconds) - startS);
    await resetReviewState(own.id);
    await respondWithAssignment(res, req.user?.id, own.id);
  } catch (err) {
    console.error('Kırpılamadı:', err);
    res.status(500).json({ error: 'Kayıt kırpılamadı.' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
