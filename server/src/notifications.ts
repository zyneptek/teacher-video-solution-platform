// Bildirimler (öğretmen ve yönetici ortak): listeleme, okundu işaretleme ve yöneticilere bildirim üretme.
// Bildirim metni saklanmaz; türden ve bağlı atama/hata bildiriminden gösterilirken üretilir.
import { Router } from 'express';
import { ERROR_REPORT_TYPES, PEER_VERDICT_LABEL, type NotificationInfo, type PeerVerdict } from '@app/shared';
import { requireAuth } from './auth.js';
import { pool } from './db.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Tüm aktif yöneticilere bildirim yazar (öğretmen videoyu onaya gönderince veya hata bildirince).
export async function notifyAdmins(
  input: { type: 'recording_submitted'; assignmentId: string } | { type: 'error_reported'; errorReportId: string } | { type: 'peer_checked'; assignmentId: string; checkerId: string; verdict: PeerVerdict },
): Promise<void> {
  const assignmentId = 'assignmentId' in input ? input.assignmentId : null;
  const errorReportId = 'errorReportId' in input ? input.errorReportId : null;
  const checkerId = input.type === 'peer_checked' ? input.checkerId : null;
  const verdict = input.type === 'peer_checked' ? input.verdict : null;
  await pool.query(
    `insert into notifications (recipient_id, assignment_id, error_report_id, type, checker_id, check_verdict)
     select id, $1, $2, $3, $4, $5 from profiles where role = 'admin' and deleted_at is null`,
    [assignmentId, errorReportId, input.type, checkerId, verdict],
  );
}

type Row = {
  id: string;
  type: NotificationInfo['type'];
  read_at: Date | null;
  created_at: Date;
  assignment_id: string | null;
  branch: string;
  question_number: number | null;
  question_id: string;
  person: string | null;
  report_type: string | null;
  checker: string | null;
  check_verdict: PeerVerdict | null;
};

function toInfo(r: Row): NotificationInfo {
  const label = `${r.branch} - ${r.question_number ? `Soru ${r.question_number}` : 'Soru'}`;
  const person = r.person ?? 'Bir öğretmen';
  let text: string;
  let href: string;
  switch (r.type) {
    case 'recording_approved':
      text = `Videonuz onaylandı: ${label}`;
      href = `#/sorularim/${r.assignment_id}`;
      break;
    case 'recording_returned':
      text = `Videonuz geri gönderildi: ${label}`;
      href = `#/sorularim/${r.assignment_id}`;
      break;
    case 'recording_submitted':
      text = `${person} videoyu onaya gönderdi: ${label}`;
      href = '#/onay-kuyrugu';
      break;
    case 'error_reported':
      text = `${person} hata bildirdi (${ERROR_REPORT_TYPES.find((t) => t.value === r.report_type)?.label ?? 'Hata'}): ${label}`;
      href = `#/sorular/${r.question_id}`;
      break;
    case 'peer_checked':
      text = `${r.checker ?? 'Bir öğretmen'}, ${person} öğretmenin çözümünü ${r.check_verdict ? PEER_VERDICT_LABEL[r.check_verdict].toLocaleLowerCase('tr') : ''} buldu: ${label}`;
      href = `#/sorular/${r.question_id}`;
      break;
    default:
      text = `Size yeni bir soru atandı: ${label}`;
      href = `#/sorularim/${r.assignment_id}`;
  }
  return { id: r.id, type: r.type, text, href, readAt: r.read_at?.toISOString() ?? null, createdAt: r.created_at.toISOString() };
}

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth());

notificationsRouter.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query<Row>(
      `select n.id, n.type, n.read_at, n.created_at, n.assignment_id, e.type as report_type,
              coalesce(qa.branch, qe.branch) as branch,
              coalesce(qa.question_number, qe.question_number) as question_number,
              coalesce(qa.id, qe.id) as question_id,
              coalesce(pt.first_name || ' ' || pt.last_name, pr.first_name || ' ' || pr.last_name) as person,
              pc.first_name || ' ' || pc.last_name as checker, n.check_verdict
       from notifications n
       left join assignments a on a.id = n.assignment_id
       left join questions qa on qa.id = a.question_id
       left join profiles pt on pt.id = a.teacher_id
       left join error_reports e on e.id = n.error_report_id
       left join questions qe on qe.id = e.question_id
       left join profiles pr on pr.id = e.reporter_id
       left join profiles pc on pc.id = n.checker_id
       where n.recipient_id = $1 order by n.created_at desc limit 100`,
      [req.user?.id],
    );
    const notifications = rows.map(toInfo);
    res.json({ notifications, unread: notifications.filter((n) => !n.readAt).length });
  } catch (err) {
    console.error('Bildirimler listelenemedi:', err);
    res.status(500).json({ error: 'Bildirimler yüklenemedi.' });
  }
});

// Yalnızca kendi bildirimini okundu yapabilir.
notificationsRouter.post('/read-all', async (req, res) => {
  try {
    await pool.query('update notifications set read_at = now() where recipient_id = $1 and read_at is null', [req.user?.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Bildirimler güncellenemedi:', err);
    res.status(500).json({ error: 'Bildirimler güncellenemedi.' });
  }
});

notificationsRouter.post('/:id/read', async (req, res) => {
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
