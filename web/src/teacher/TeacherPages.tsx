// Öğretmen sayfaları: Panel, Sorularım (liste + soru sayfası) ve Bildirimler.
import { useCallback, useEffect, useState } from 'react';
import { ASSIGNMENT_STATUS_LABEL, type AssignmentStatus, type ErrorReportInfo, type TeacherAssignment } from '@app/shared';
import { StatusBadge } from '../admin/AssignmentsTable';
import { api } from '../auth/session';
import StudioPage from '../studio/StudioPage';
import { VideoPreview } from '../studio/VideoPreview';
import { ErrorReportForm } from '../reports/ErrorReportForm';
import { MarkedImage, type Marker } from '../reports/MarkedImage';
import { ReportCard } from '../reports/ReportViews';
import { AssignmentCards } from './AssignmentCards';
import { EditPanel } from './EditPanel';

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

export function TeacherDashboard() {
  const { assignments, error } = useAssignments();
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

      <h3>Sorularım</h3>
      {!assignments && !error && <p>Yükleniyor…</p>}
      {assignments && <AssignmentCards assignments={assignments} />}
    </div>
  );
}

export function MyQuestionsPage({ id, sub }: { id?: string; sub?: string }) {
  if (id) return sub === 'kayit' ? <RecordPage id={id} /> : <QuestionPage id={id} startEditing={sub === 'duzenle'} />;
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
  return { assignment, setAssignment, error };
}

function QuestionPage({ id, startEditing }: { id: string; startEditing?: boolean }) {
  const { assignment, setAssignment, error } = useAssignment(id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Hata bildirimi: form açık mı, görselde işaret konumu ve gönderilen bildirimler
  const [reporting, setReporting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [marker, setMarker] = useState<Marker | null>(null);
  const [reports, setReports] = useState<ErrorReportInfo[]>([]);
  const [reportSent, setReportSent] = useState(false);
  const [editing, setEditing] = useState(!!startEditing);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  useEffect(() => {
    api<{ reports: ErrorReportInfo[] }>(`/api/teacher/assignments/${id}/error-reports`).then((r) => setReports(r.reports)).catch(() => undefined);
  }, [id]);
  if (error) return (<div><p><a href="#/sorularim">← Sorularım</a></p><p role="alert" className="error" data-testid="q-error">{error}</p></div>);
  if (!assignment) return <p>Yükleniyor…</p>;
  const q = assignment.question;

  async function act(path: string, method: 'POST' | 'DELETE', confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setActionError(null);
    try {
      const r = await api<{ assignment: TeacherAssignment }>(`/api/teacher/assignments/${id}${path}`, { method });
      setAssignment(r.assignment);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'İşlem yapılamadı.');
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !!assignment.recording && (assignment.status === 'assigned' || assignment.status === 'returned');
  const locked = assignment.status === 'submitted';

  return (
    <div>
      <p><a href="#/sorularim">← Sorularım</a></p>
      <h2>{q.branch} sorusu{q.questionNumber ? ` (Soru ${q.questionNumber})` : ''}</h2>
      <div className="q-detail" style={editing ? { display: 'block' } : undefined}>
        {!editing && <div className="q-image">
          <MarkedImage
            src={q.imageUrl}
            alt="Soru görseli"
            marker={marker}
            onPick={picking ? (m) => { setMarker(m); setPicking(false); } : undefined}
          />
        </div>}
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
            {actionError && <p role="alert" className="error" data-testid="action-error">{actionError}</p>}
            {assignment.recording ? (
              <>
                {editing ? (
                  <EditPanel
                    key={assignment.recording.videoUrl}
                    assignmentId={assignment.id}
                    recording={assignment.recording}
                    notice={editNotice}
                    onEdited={(a, message) => { setAssignment(a); setEditNotice(message); }}
                    onClose={() => { setEditing(false); setEditNotice(null); }}
                  />
                ) : (
                  <VideoPreview key={assignment.recording.videoUrl} src={assignment.recording.videoUrl} />
                )}
                <div className="muted small">Süre: {Math.round(assignment.recording.durationSeconds)} sn · Kaydedilme: {new Date(assignment.recording.updatedAt).toLocaleString('tr-TR')}</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {canSubmit && (
                    <button type="button" className="primary" disabled={busy} onClick={() => void act('/submit', 'POST')} data-testid="submit-review">
                      {assignment.status === 'returned' ? 'Yeniden onaya gönder' : 'Onaya gönder'}
                    </button>
                  )}
                  {locked && <span className="muted small" data-testid="locked">Onaya gönderildi; yönetici değerlendirmesini bekliyor.</span>}
                  {!editing && <button type="button" className="ghost-btn" disabled={busy} onClick={() => setEditing(true)} data-testid="edit-open" title="Kırp veya videodan bölüm sil">Düzenle (kırp / bölüm sil)</button>}
                  <a href={`#/sorularim/${assignment.id}/kayit`} className="link" data-testid="re-record">Yeniden kaydet</a>
                  <button type="button" className="link danger" disabled={busy} onClick={() => void act('/recording', 'DELETE', 'Kayıt silinsin mi? Onaya gönderilmişse yönetici de artık izleyemez.')} data-testid="delete-recording">
                    Kaydı sil
                  </button>
                </div>
                {assignment.status === 'approved' && <span className="muted small">Yeniden kaydederseniz, kırparsanız veya silerseniz onay durumu sıfırlanır; yeniden onaya göndermeniz gerekir.</span>}
              </>
            ) : (
              <>
                <p className="muted" style={{ margin: 0 }}>Bu soru için henüz kayıt oluşturmadınız.</p>
                <a href={`#/sorularim/${assignment.id}/kayit`} className="primary" style={{ textAlign: 'center', textDecoration: 'none' }} data-testid="start-recording">
                  Kayıt oluştur
                </a>
              </>
            )}
          </div>

          <div className="card">
            <strong>Kazanımlar</strong>
            <ul className="outcomes">
              {q.outcomes.map((o) => (
                <li key={o.id}><span><strong>{o.code}</strong> {o.description}</span></li>
              ))}
            </ul>
          </div>

          <div className="card" data-testid="report-card-area">
            <div className="row" style={{ marginBottom: 0 }}>
              <strong>Soruda hata mı var?</strong>
              {!reporting && <button type="button" className="link" onClick={() => { setReporting(true); setReportSent(false); }} data-testid="open-report">Hata bildir</button>}
            </div>
            {reportSent && <p className="notice" style={{ margin: 0 }} data-testid="report-sent">Hata bildiriminiz yöneticiye gönderildi.</p>}
            {reporting && (
              <ErrorReportForm
                assignmentId={assignment.id}
                marker={marker}
                picking={picking}
                onPickingChange={setPicking}
                onClearMarker={() => setMarker(null)}
                onSent={(report) => {
                  setReports((list) => [report, ...list]);
                  setReporting(false);
                  setPicking(false);
                  setMarker(null);
                  setReportSent(true);
                }}
                onClose={() => { setReporting(false); setPicking(false); setMarker(null); }}
              />
            )}
            {reports.length > 0 && (
              <>
                <strong className="small">Gönderdiğiniz bildirimler</strong>
                <div className="t-list" data-testid="my-reports">
                  {reports.map((r) => (
                    <ReportCard key={r.id} report={r} imageUrl={q.imageUrl} />
                  ))}
                </div>
              </>
            )}
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
      <StudioPage questionImageUrl={assignment.question.imageUrl} assignmentId={assignment.id} />
    </div>
  );
}
