// Öğretmen sayfaları: Panel, Sorularım (liste + soru sayfası) ve Bildirimler.
import { useCallback, useEffect, useState } from 'react';
import { ASSIGNMENT_STATUS_LABEL, type AssignmentStatus, type NotificationInfo, type TeacherAssignment } from '@app/shared';
import { StatusBadge } from '../admin/AssignmentsTable';
import { api } from '../auth/session';
import StudioPage from '../studio/StudioPage';
import { AssignmentCards } from './AssignmentCards';
import { NotificationList } from './NotificationList';

type Notifs = { notifications: NotificationInfo[] | null; refresh: () => void };

function useAssignments() {
  const [assignments, setAssignments] = useState<TeacherAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await api<{ assignments: TeacherAssignment[] }>('/api/teacher/assignments');
      setAssignments(r.assignments);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sorular yüklenemedi.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { assignments, error, load };
}

export function TeacherDashboard({ notifs }: { notifs: Notifs }) {
  const { assignments, error } = useAssignments();
  const unread = (notifs.notifications ?? []).filter((n) => !n.readAt);
  const counts: Record<AssignmentStatus, number> = { assigned: 0, submitted: 0, approved: 0, returned: 0 };
  for (const a of assignments ?? []) counts[a.status]++;

  return (
    <div>
      <h2>Panel</h2>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="stats">
        {(Object.keys(ASSIGNMENT_STATUS_LABEL) as AssignmentStatus[]).map((s) => (
          <div key={s} className="stat">
            <div className={`stat-value ${s === 'submitted' ? 'tone-brand' : s === 'returned' ? 'tone-warn' : ''}`} data-testid={`count-${s}`}>
              {counts[s]}
            </div>
            <div className="stat-label">{ASSIGNMENT_STATUS_LABEL[s]}</div>
          </div>
        ))}
      </div>

      <h3>Okunmamış bildirimler</h3>
      {unread.length === 0 ? <p className="muted">Okunmamış bildiriminiz yok.</p> : <NotificationList notifications={unread} onChanged={notifs.refresh} />}

      <h3>Sorularım</h3>
      {!assignments && !error && <p>Yükleniyor…</p>}
      {assignments && <AssignmentCards assignments={assignments} />}
    </div>
  );
}

export function MyQuestionsPage({ id, sub }: { id?: string; sub?: string }) {
  if (id) return sub === 'kayit' ? <RecordPage id={id} /> : <QuestionPage id={id} />;
  return <QuestionList />;
}

function QuestionList() {
  const { assignments, error } = useAssignments();
  return (
    <div>
      <h2>Sorularım</h2>
      {error && <p role="alert" className="error">{error}</p>}
      {!assignments && !error && <p>Yükleniyor…</p>}
      {assignments && <AssignmentCards assignments={assignments} />}
    </div>
  );
}

function useAssignment(id: string) {
  const [assignment, setAssignment] = useState<TeacherAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ assignment: TeacherAssignment }>(`/api/teacher/assignments/${id}`)
      .then((r) => setAssignment(r.assignment))
      .catch((err) => setError(err instanceof Error ? err.message : 'Soru yüklenemedi.'));
  }, [id]);
  return { assignment, error };
}

function QuestionPage({ id }: { id: string }) {
  const { assignment, error } = useAssignment(id);
  if (error) return (<div><p><a href="#/sorularim">← Sorularım</a></p><p role="alert" className="error" data-testid="q-error">{error}</p></div>);
  if (!assignment) return <p>Yükleniyor…</p>;
  const q = assignment.question;

  return (
    <div>
      <p><a href="#/sorularim">← Sorularım</a></p>
      <h2>{q.branch} sorusu{q.questionNumber ? ` (Soru ${q.questionNumber})` : ''}</h2>
      <div className="q-detail">
        <div className="q-image"><img src={q.imageUrl} alt="Soru görseli" /></div>
        <div>
          <div className="card">
            <div className="row" style={{ marginBottom: 0 }}>
              <strong>Durum</strong>
              <StatusBadge status={assignment.status} />
            </div>
            {assignment.status === 'returned' && assignment.returnNote && (
              <div className="return-note" data-testid="return-note"><strong>Yöneticinin notu:</strong> {assignment.returnNote}</div>
            )}
            <div className="muted small">Atanma: {new Date(assignment.assignedAt).toLocaleString('tr-TR')}</div>
          </div>

          <div className="card">
            <strong>Çözüm kaydı</strong>
            {assignment.hasRecording ? (
              <p className="muted" style={{ margin: 0 }}>Kaydınız var.</p>
            ) : (
              <p className="muted" style={{ margin: 0 }}>Bu soru için henüz kayıt oluşturmadınız.</p>
            )}
            <a href={`#/sorularim/${assignment.id}/kayit`} className="primary" style={{ textAlign: 'center', textDecoration: 'none' }} data-testid="start-recording">
              {assignment.hasRecording ? 'Yeniden kaydet' : 'Kayıt oluştur'}
            </a>
            <span className="muted small">Kaydı sisteme kaydetme, izleme, silme, kırpma ve onaya gönderme sonraki adımda bu ekrana eklenecek.</span>
          </div>

          <div className="card">
            <strong>Kazanımlar</strong>
            <ul className="outcomes">
              {q.outcomes.map((o) => (
                <li key={o.id}><span><strong>{o.code}</strong> {o.description}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecordPage({ id }: { id: string }) {
  const { assignment, error } = useAssignment(id);
  if (error) return <p role="alert" className="error">{error}</p>;
  if (!assignment) return <p>Yükleniyor…</p>;
  return (
    <div>
      <p><a href={`#/sorularim/${id}`}>← Soruya dön</a></p>
      <StudioPage questionImageUrl={assignment.question.imageUrl} />
    </div>
  );
}

export function NotificationsPage({ notifs }: { notifs: Notifs }) {
  async function readAll() {
    await api('/api/teacher/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    notifs.refresh();
  }
  const hasUnread = (notifs.notifications ?? []).some((n) => !n.readAt);
  return (
    <div>
      <div className="row">
        <h2 style={{ margin: 0 }}>Bildirimler</h2>
        {hasUnread && <button type="button" className="link" onClick={() => void readAll()} data-testid="read-all">Tümünü okundu yap</button>}
      </div>
      {!notifs.notifications ? <p>Yükleniyor…</p> : <NotificationList notifications={notifs.notifications} onChanged={notifs.refresh} />}
    </div>
  );
}
