// Yönetici: atama listesi ve yeni atama.
// Kurallar: soru yalnızca kendi branşındaki aktif öğretmene atanır; aynı soru aynı öğretmene ikinci kez atanamaz;
// aynı soru farklı öğretmenlere atanabilir (her öğretmen kendi kaydını üretir).
// Atama kaydedilince aynı işlemde bildirim satırı yazılır; ardından e-posta ve push gönderilir.
import { Router } from 'express';
import type { AssignmentDelivery, AssignmentInfo, AssignmentStatus } from '@app/shared';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';
import { sendAssignmentEmail } from '../mail.js';
import { sendPush } from '../push.js';

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
};

const SELECT = `select a.id, a.question_id, q.question_number, q.branch, a.teacher_id, p.first_name, p.last_name,
                       a.status, a.return_note, a.assigned_at
                from assignments a join questions q on q.id = a.question_id join profiles p on p.id = a.teacher_id`;

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
       order by a.assigned_at desc`,
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
