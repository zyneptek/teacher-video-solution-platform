// Yönetici: atama listesi ve yeni atama.
// Kurallar: soru yalnızca kendi branşındaki aktif öğretmene atanır; aynı soru aynı öğretmene ikinci kez atanamaz;
// aynı soru farklı öğretmenlere atanabilir (her öğretmen kendi kaydını üretir).
// Atama kaydedilince aynı işlemde bildirim satırı yazılır; ardından e-posta ve push gönderilir.
import { Router } from 'express';
import type { AssignmentDelivery, AssignmentInfo, AssignmentStatus, PeerCheckInfo } from '@app/shared';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';
import { sendAssignmentEmail } from '../mail.js';
import { sendPush } from '../push.js';
import { deleteRecording, recordingInfo } from '../recordings.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STATUSES: AssignmentStatus[] = ['assigned', 'submitted', 'approved', 'returned'];

type Row = {
  id: string;
  question_id: string;
  question_number: number | null;
  branch: AssignmentInfo['branch'];
  teacher_id: string;
  first_name: string;
  last_name: string;
  status: AssignmentStatus;
  return_note: string | null;
  assigned_at: Date;
  submitted_at: Date | null;
  video_replaced_at: Date | null;
  rec_id: string | null;
  rec_duration: string | null;
  rec_updated: Date | null;
  peer_checks: PeerCheckInfo[];
};

const SELECT = `select a.id, a.question_id, q.question_number, q.branch, a.teacher_id, p.first_name, p.last_name,
                       a.status, a.return_note, a.assigned_at, a.submitted_at, a.video_replaced_at,
                       r.id as rec_id, r.duration_seconds as rec_duration, r.updated_at as rec_updated,
                       coalesce((select json_agg(json_build_object('checkerName', pc.first_name || ' ' || pc.last_name, 'verdict', c.verdict, 'note', c.note, 'updatedAt', c.updated_at) order by c.updated_at)
                                 from peer_checks c join profiles pc on pc.id = c.reviewer_id where c.recording_id = r.id), '[]'::json) as peer_checks
                from assignments a join questions q on q.id = a.question_id join profiles p on p.id = a.teacher_id
                left join recordings r on r.assignment_id = a.id and r.deleted_at is null and r.status = 'ready'`;

const toInfo = (r: Row): AssignmentInfo => ({
  id: r.id,
  questionId: r.question_id,
  questionNumber: r.question_number,
  branch: r.branch,
  teacherId: r.teacher_id,
  teacherName: `${r.first_name} ${r.last_name}`,
  status: r.status,
  returnNote: r.return_note,
  assignedAt: r.assigned_at.toISOString(),
  submittedAt: r.submitted_at?.toISOString() ?? null,
  recording: r.rec_id && r.rec_updated ? recordingInfo({ id: r.rec_id, duration_seconds: r.rec_duration, updated_at: r.rec_updated }) : null,
  peerChecks: r.peer_checks,
  videoReplacedAt: r.video_replaced_at?.toISOString() ?? null,
});

export const adminAssignmentsRouter = Router();
adminAssignmentsRouter.use(requireAuth('admin'));

// İsteğe bağlı süzgeçler: ?questionId=, ?teacherId=, ?status=
adminAssignmentsRouter.get('/', async (req, res) => {
  const { questionId, teacherId, status } = req.query as Record<string, string | undefined>;
  if ((questionId && !UUID_PATTERN.test(questionId)) || (teacherId && !UUID_PATTERN.test(teacherId)) || (status && !STATUSES.includes(status as AssignmentStatus))) {
    res.status(400).json({ error: 'Geçersiz süzgeç.' });
    return;
  }
  try {
    const { rows } = await pool.query<Row>(
      `${SELECT} where ($1::uuid is null or a.question_id = $1) and ($2::uuid is null or a.teacher_id = $2) and ($3::text is null or a.status = $3)
       order by coalesce(a.submitted_at, a.assigned_at) desc`,
      [questionId ?? null, teacherId ?? null, status ?? null],
    );
    res.json({ assignments: rows.map(toInfo) });
  } catch (err) {
    console.error('Atamalar listelenemedi:', err);
    res.status(500).json({ error: 'Atamalar listelenemedi.' });
  }
});

adminAssignmentsRouter.post('/', async (req, res) => {
  const { questionId, teacherId } = (req.body ?? {}) as { questionId?: unknown; teacherId?: unknown };
  if (typeof questionId !== 'string' || typeof teacherId !== 'string' || !UUID_PATTERN.test(questionId) || !UUID_PATTERN.test(teacherId)) {
    res.status(400).json({ error: 'Soru ve öğretmen seçin.' });
    return;
  }

  const client = await pool.connect();
  let assignmentId: string;
  let teacher: { first_name: string; last_name: string; email: string };
  let question: { branch: string; question_number: number | null };
  try {
    const q = await client.query<{ branch: string; question_number: number | null }>('select branch, question_number from questions where id = $1', [questionId]);
    const t = await client.query<{ first_name: string; last_name: string; email: string; branch: string }>(
      "select first_name, last_name, email, branch from profiles where id = $1 and role = 'teacher' and deleted_at is null",
      [teacherId],
    );
    if (!q.rows[0] || !t.rows[0]) {
      res.status(404).json({ error: 'Soru veya öğretmen bulunamadı.' });
      return;
    }
    if (q.rows[0].branch !== t.rows[0].branch) {
      res.status(409).json({ error: `Soru yalnızca ${q.rows[0].branch} branşındaki bir öğretmene atanabilir.` });
      return;
    }
    question = q.rows[0];
    teacher = t.rows[0];

    await client.query('begin');
    const inserted = await client.query<{ id: string }>('insert into assignments (question_id, teacher_id) values ($1, $2) returning id', [questionId, teacherId]);
    assignmentId = (inserted.rows[0] as { id: string }).id;
    await client.query("insert into notifications (recipient_id, assignment_id, type) values ($1, $2, 'assignment_created')", [teacherId, assignmentId]);
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Bu soru bu öğretmene zaten atanmış.' });
      return;
    }
    console.error('Atama yapılamadı:', err);
    res.status(500).json({ error: 'Atama yapılamadı.' });
    return;
  } finally {
    client.release();
  }

  // Atama kaydedildi; bildirimler ayrıca denenir ve hataları atamayı geri almaz.
  const label = question.question_number ? `Soru ${question.question_number}` : 'Soru';
  const teacherName = `${teacher.first_name} ${teacher.last_name}`;
  const outcomes = await pool
    .query<{ code: string }>('select o.code from question_outcomes qo join learning_outcomes o on o.id = qo.outcome_id where qo.question_id = $1 order by o.code', [questionId])
    .then((r) => r.rows.map((x) => x.code))
    .catch(() => []);
  const [email, pushDevices] = await Promise.all([
    sendAssignmentEmail({ to: teacher.email, teacherName, branch: question.branch, questionLabel: label, outcomes }),
    sendPush(teacherId, 'Yeni soru atandı', `${question.branch} - ${label}`, { type: 'assignment_created', assignmentId, questionId }),
  ]);
  const delivery: AssignmentDelivery = { email, pushDevices };

  const { rows } = await pool.query<Row>(`${SELECT} where a.id = $1`, [assignmentId]);
  res.status(201).json({ assignment: toInfo(rows[0] as Row), delivery });
});

// ---- Onay: yönetici onaya gönderilmiş bir kaydı onaylar veya notla geri gönderir ----

const MAX_NOTE_LENGTH = 500;

type ReviewRow = { id: string; teacher_id: string; status: AssignmentStatus; branch: string; question_number: number | null };

async function loadForReview(id: string): Promise<ReviewRow | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const { rows } = await pool.query<ReviewRow>(
    'select a.id, a.teacher_id, a.status, q.branch, q.question_number from assignments a join questions q on q.id = a.question_id where a.id = $1',
    [id],
  );
  return rows[0] ?? null;
}

// Durumu günceller ve öğretmene bildirim (+ push) gönderir. Yalnızca "Onaya gönderildi" durumundaki kayıt değerlendirilir.
async function review(id: string, outcome: 'approved' | 'returned', note: string | null): Promise<{ ok: true; assignment: AssignmentInfo } | { ok: false; status: number; error: string }> {
  const row = await loadForReview(id);
  if (!row) return { ok: false, status: 404, error: 'Atama bulunamadı.' };
  if (row.status !== 'submitted') return { ok: false, status: 409, error: 'Yalnızca onaya gönderilmiş kayıtlar değerlendirilebilir.' };

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('update assignments set status = $1, return_note = $2, reviewed_at = now() where id = $3', [outcome, note, id]);
    await client.query('insert into notifications (recipient_id, assignment_id, type) values ($1, $2, $3)', [row.teacher_id, id, outcome === 'approved' ? 'recording_approved' : 'recording_returned']);
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
  const label = `${row.branch} - ${row.question_number ? `Soru ${row.question_number}` : 'Soru'}`;
  void sendPush(row.teacher_id, outcome === 'approved' ? 'Videonuz onaylandı' : 'Videonuz geri gönderildi', label, { type: outcome === 'approved' ? 'recording_approved' : 'recording_returned', assignmentId: id });
  const { rows } = await pool.query<Row>(`${SELECT} where a.id = $1`, [id]);
  return { ok: true, assignment: toInfo(rows[0] as Row) };
}

adminAssignmentsRouter.post('/:id/approve', async (req, res) => {
  try {
    const result = await review(req.params.id, 'approved', null);
    if (!result.ok) res.status(result.status).json({ error: result.error });
    else res.json({ assignment: result.assignment });
  } catch (err) {
    console.error('Onaylanamadı:', err);
    res.status(500).json({ error: 'Onaylanamadı.' });
  }
});

adminAssignmentsRouter.post('/:id/return', async (req, res) => {
  const note = typeof (req.body as { note?: unknown } | undefined)?.note === 'string' ? ((req.body as { note: string }).note).trim() : '';
  if (!note) {
    res.status(400).json({ error: 'Geri göndermek için öğretmene görünecek kısa bir not yazın.' });
    return;
  }
  if (note.length > MAX_NOTE_LENGTH) {
    res.status(400).json({ error: `Not en fazla ${MAX_NOTE_LENGTH} karakter olabilir.` });
    return;
  }
  try {
    const result = await review(req.params.id, 'returned', note);
    if (!result.ok) res.status(result.status).json({ error: result.error });
    else res.json({ assignment: result.assignment });
  } catch (err) {
    console.error('Geri gönderilemedi:', err);
    res.status(500).json({ error: 'Geri gönderilemedi.' });
  }
});

// ---- Atamayı geri alma: yanlışlıkla yapılmış ya da vazgeçilen atama kalıcı olarak kaldırılır ----
// Atamayla birlikte şunlar da silinir: öğretmenin kaydı/videosu (dosya, düzenleme geçmişi ve o videoya verilmiş çapraz kontroller),
// atamaya bağlı tüm bildirimler (öğretmenin "yeni soru atandı" bildirimi, yöneticiye gitmiş "onaya gönderdi"/çapraz kontrol bildirimleri) ve
// bu öğretmenin AYNI soruda başkalarının videolarına verdiği çapraz kontroller (kontrol etme yetkisi atamadan geliyordu).
// Hata bildirimleri soruya ve gönderene bağlıdır, silinmez. Geri alınınca aynı soru aynı öğretmene yeniden atanabilir.
adminAssignmentsRouter.delete('/:id', async (req, res) => {
  const row = await loadForReview(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Atama bulunamadı.' });
    return;
  }
  try {
    const owner = await pool.query<{ question_id: string }>('select question_id from assignments where id = $1', [row.id]);
    const questionId = (owner.rows[0] as { question_id: string }).question_id;
    await deleteRecording(row.id); // dosya + kayıt + düzenleme geçmişi + (cascade) bu videoya verilmiş çapraz kontroller
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        "delete from notifications where type = 'peer_checked' and checker_id = $1 and assignment_id in (select id from assignments where question_id = $2)",
        [row.teacher_id, questionId],
      );
      await client.query(
        'delete from peer_checks where reviewer_id = $1 and recording_id in (select r.id from recordings r join assignments a on a.id = r.assignment_id where a.question_id = $2)',
        [row.teacher_id, questionId],
      );
      await client.query('delete from notifications where assignment_id = $1', [row.id]);
      await client.query('delete from assignments where id = $1', [row.id]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Atama geri alınamadı:', err);
    res.status(500).json({ error: 'Atama geri alınamadı.' });
  }
});
