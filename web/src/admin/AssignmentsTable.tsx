import { Fragment, useState } from 'react';
import { ASSIGNMENT_STATUS_LABEL, type AssignmentInfo } from '@app/shared';
import { api } from '../auth/session';
import { VideoPreview } from '../studio/VideoPreview';
import { PeerChecks } from './PeerChecks';
import { VideoReplacedNote } from './VideoReplacedNote';

// Turuncu = o rolün aksiyon alması gereken durum. Yönetici için "Onaya gönderildi", öğretmen için "Atandı" ve "Geri gönderildi".
export function StatusBadge({ status, forTeacher }: { status: AssignmentInfo['status']; forTeacher?: boolean }) {
  const tone = forTeacher ? (status === 'assigned' || status === 'returned' ? 'action' : status === 'approved' ? 'approved' : 'wait') : status;
  return <span className={`status status-${tone}`}>{ASSIGNMENT_STATUS_LABEL[status]}</span>;
}

// onChanged verilirse her satırda "Atamayı geri al" görünür; atama kaldırılınca üst sayfa listeyi yeniler.
export function AssignmentsTable({ assignments, showQuestion, onChanged }: { assignments: AssignmentInfo[]; showQuestion: boolean; onChanged?: () => void }) {
  const [watching, setWatching] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (assignments.length === 0) return <p className="muted">Henüz atama yok.</p>;

  async function revoke(a: AssignmentInfo) {
    const parts = [`${a.teacherName} öğretmenin atamasını geri almak istiyor musunuz?`];
    parts.push(a.recording ? `Öğretmenin kaydettiği video (${ASSIGNMENT_STATUS_LABEL[a.status]}) kalıcı olarak silinir.` : 'Öğretmen soruyu artık görmez.');
    parts.push('Bu işlem geri alınamaz.');
    if (!window.confirm(parts.join('\n\n'))) return;
    setRevoking(a.id);
    setError(null);
    try {
      await api(`/api/admin/assignments/${a.id}`, { method: 'DELETE' });
      if (watching === a.id) setWatching(null);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Atama geri alınamadı.');
    } finally {
      setRevoking(null);
    }
  }

  const cols = showQuestion ? 5 : 4;
  return (
    <>
      {error && <p role="alert" className="error" data-testid="revoke-error">{error}</p>}
    <table data-testid="assignments-table">
      <thead>
        <tr>
          {showQuestion && <th>Soru</th>}
          <th>Öğretmen</th>
          <th>Durum</th>
          <th>Atanma</th>
          <th>{onChanged ? 'İşlem' : 'Video'}</th>
        </tr>
      </thead>
      <tbody>
        {assignments.map((a) => (
          <Fragment key={a.id}>
            <tr>
              {showQuestion && (
                <td>
                  <a href={`#/sorular/${a.questionId}`}>
                    {a.branch} — {a.questionNumber ? `Soru ${a.questionNumber}` : 'Soru'}
                  </a>
                </td>
              )}
              <td>{a.teacherName}</td>
              <td>
                <StatusBadge status={a.status} />
                {a.status === 'returned' && a.returnNote && <div className="muted small">Not: {a.returnNote}</div>}
              </td>
              <td>{new Date(a.assignedAt).toLocaleString('tr-TR')}</td>
              <td>
                <div className="cell-actions">
                  {a.recording ? (
                    <button type="button" className="accent-btn sm" onClick={() => setWatching(watching === a.id ? null : a.id)} data-testid={`watch-${a.id}`}>
                      {watching === a.id ? 'Kapat' : 'İzle'}
                    </button>
                  ) : (
                    !onChanged && <span className="muted small">—</span>
                  )}
                  {onChanged && (
                    <button type="button" className="accent-btn sm" disabled={revoking === a.id} onClick={() => void revoke(a)} data-testid={`revoke-${a.id}`}>
                      Atamayı geri al
                    </button>
                  )}
                </div>
              </td>
            </tr>
            {a.videoReplacedAt && (
              <tr>
                <td colSpan={cols}>
                  <VideoReplacedNote assignment={a} />
                </td>
              </tr>
            )}
            {a.peerChecks.length > 0 && (
              <tr>
                <td colSpan={cols}>
                  <PeerChecks checks={a.peerChecks} />
                </td>
              </tr>
            )}
            {watching === a.id && a.recording && (
              <tr>
                <td colSpan={cols}>
                  <div style={{ maxWidth: 640 }}>
                    <VideoPreview src={a.recording.videoUrl} />
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
    </>
  );
}
