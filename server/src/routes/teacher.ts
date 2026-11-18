// Öğretmen: kendisine atanan sorular ve kendi bildirimleri.
// Görünürlük kuralı: öğretmen yalnızca KENDİ atamalarını, kayıtlarını ve bildirimlerini görür; başkasının
// atamasına erişim denemesi "bulunamadı" (404) döner (varlığı bile belli edilmez).
// Öğretmene cevap anahtarı gösterilmez (varsayım, README'de); sorunun kazanımları gösterilir.
import { Router } from 'express';
import multer from 'multer';
import type { AssignmentStatus, Branch, NotificationInfo, OutcomeInfo, TeacherAssignment } from '@app/shared';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';
import { loadImage, questionImageUrl } from '../questionImages.js';
import { BadUploadError, renderFromUpload } from '../render/renderFromUpload.js';
import { deleteRecording, recordingInfo, saveRecording } from '../recordings.js';

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

type NotificationRow = { id: string; assignment_id: string; type: NotificationInfo['type']; read_at: Date | null; created_at: Date; branch: string; question_number: number | null };

// Bildirim metni saklanmaz; türden ve atamanın sorusundan üretilir.
function notificationText(row: NotificationRow): string {
  const label = `${row.branch} - ${row.question_number ? `Soru ${row.question_number}` : 'Soru'}`;
  if (row.type === 'recording_approved') return `Videonuz onaylandı: ${label}`;
  if (row.type === 'recording_returned') return `Videonuz geri gönderildi: ${label}`;
  return `Size yeni bir soru atandı: ${label}`;
}

teacherRouter.get('/notifications', async (req, res) => {
  try {
    const { rows } = await pool.query<NotificationRow>(
      `select n.id, n.assignment_id, n.type, n.read_at, n.created_at, q.branch, q.question_number
       from notifications n join assignments a on a.id = n.assignment_id join questions q on q.id = a.question_id
       where n.recipient_id = $1 order by n.created_at desc limit 100`,
      [req.user?.id],
    );
    const notifications: NotificationInfo[] = rows.map((r) => ({
      id: r.id,
      assignmentId: r.assignment_id,
      type: r.type,
      text: notificationText(r),
      readAt: r.read_at?.toISOString() ?? null,
      createdAt: r.created_at.toISOString(),
    }));
    res.json({ notifications, unread: notifications.filter((n) => !n.readAt).length });
  } catch (err) {
    console.error('Bildirimler listelenemedi:', err);
    res.status(500).json({ error: 'Bildirimler yüklenemedi.' });
  }
});

// Bildirimi okundu yapar (yalnızca kendi bildirimi).
teacherRouter.post('/notifications/:id/read', async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(404).json({ error: 'Bildirim bulunamadı.' });
    return;
  }
  try {
    const result = await pool.query('update notifications set read_at = coalesce(read_at, now()) where id = $1 and recipient_id = $2', [req.params.id, req.user?.id]);
    if (!result.rowCount) {
      res.status(404).json({ error: 'Bildirim bulunamadı.' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Bildirim güncellenemedi:', err);
    res.status(500).json({ error: 'Bildirim güncellenemedi.' });
  }
});

teacherRouter.post('/notifications/read-all', async (req, res) => {
  try {
    await pool.query('update notifications set read_at = now() where recipient_id = $1 and read_at is null', [req.user?.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Bildirimler güncellenemedi:', err);
    res.status(500).json({ error: 'Bildirimler güncellenemedi.' });
  }
});

// ---- Çözüm kaydı: yükleme (sunucuda MP4'e çevrilir ve kaydedilir), silme ve onaya gönderme ----

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 12 } });

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
    await respondWithAssignment(res, req.user?.id, own.id);
  } catch (err) {
    console.error('Onaya gönderilemedi:', err);
    res.status(500).json({ error: 'Onaya gönderilemedi.' });
  }
});
