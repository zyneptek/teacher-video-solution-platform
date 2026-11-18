// Öğretmen: kendisine atanan sorular ve kendi bildirimleri.
// Görünürlük kuralı: öğretmen yalnızca KENDİ atamalarını, kayıtlarını ve bildirimlerini görür; başkasının
// atamasına erişim denemesi "bulunamadı" (404) döner (varlığı bile belli edilmez).
// Öğretmene cevap anahtarı gösterilmez (varsayım, README'de); sorunun kazanımları gösterilir.
import { Router } from 'express';
import type { AssignmentStatus, Branch, NotificationInfo, OutcomeInfo, TeacherAssignment } from '@app/shared';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';
import { questionImageUrl } from '../questionImages.js';

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
  has_recording: boolean;
  outcomes: { id: number; code: string; description: string; branch: Branch | null }[];
};

// Öğretmenin atamaları (tek sorgu): soru bilgisi, kazanımlar ve kayıt var mı.
const SELECT = `
  select a.id, a.status, a.return_note, a.assigned_at, q.id as question_id, q.branch, q.question_number,
         exists (select 1 from recordings r where r.assignment_id = a.id and r.deleted_at is null and r.status = 'ready') as has_recording,
         coalesce((select json_agg(json_build_object('id', o.id, 'code', o.code, 'description', o.description, 'branch', o.branch) order by o.code)
                   from question_outcomes qo join learning_outcomes o on o.id = qo.outcome_id where qo.question_id = q.id), '[]'::json) as outcomes
  from assignments a join questions q on q.id = a.question_id
  where a.teacher_id = $1`;

const toAssignment = (r: AssignmentRow): TeacherAssignment => ({
  id: r.id,
  status: r.status,
  returnNote: r.return_note,
  assignedAt: r.assigned_at.toISOString(),
  hasRecording: r.has_recording,
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

type NotificationRow = { id: string; assignment_id: string; type: 'assignment_created'; read_at: Date | null; created_at: Date; branch: string; question_number: number | null };

// Bildirim metni saklanmaz; türden ve atamanın sorusundan üretilir.
function notificationText(row: NotificationRow): string {
  const label = `${row.branch} - ${row.question_number ? `Soru ${row.question_number}` : 'Soru'}`;
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
