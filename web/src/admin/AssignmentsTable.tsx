import { Fragment, useState } from 'react';
import { ASSIGNMENT_STATUS_LABEL, type AssignmentInfo } from '@app/shared';
import { VideoPreview } from '../studio/VideoPreview';
import { PeerChecks } from './PeerChecks';
import { VideoReplacedNote } from './VideoReplacedNote';

// Turuncu = o rolün aksiyon alması gereken durum. Yönetici için "Onaya gönderildi", öğretmen için "Atandı" ve "Geri gönderildi".
export function StatusBadge({ status, forTeacher }: { status: AssignmentInfo['status']; forTeacher?: boolean }) {
  const tone = forTeacher ? (status === 'assigned' || status === 'returned' ? 'action' : status === 'approved' ? 'approved' : 'wait') : status;
  return <span className={`status status-${tone}`}>{ASSIGNMENT_STATUS_LABEL[status]}</span>;
}

export function AssignmentsTable({ assignments, showQuestion }: { assignments: AssignmentInfo[]; showQuestion: boolean }) {
  const [watching, setWatching] = useState<string | null>(null);
  if (assignments.length === 0) return <p className="muted">Henüz atama yok.</p>;
  return (
    <table data-testid="assignments-table">
      <thead>
        <tr>
          {showQuestion && <th>Soru</th>}
          <th>Öğretmen</th>
          <th>Durum</th>
          <th>Atanma</th>
          <th>Video</th>
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
                {a.recording ? (
                  <button type="button" className="accent-btn sm" onClick={() => setWatching(watching === a.id ? null : a.id)} data-testid={`watch-${a.id}`}>
                    {watching === a.id ? 'Kapat' : 'İzle'}
                  </button>
                ) : (
                  <span className="muted small">—</span>
                )}
              </td>
            </tr>
            {a.videoReplacedAt && (
              <tr>
                <td colSpan={showQuestion ? 5 : 4}>
                  <VideoReplacedNote assignment={a} />
                </td>
              </tr>
            )}
            {a.peerChecks.length > 0 && (
              <tr>
                <td colSpan={showQuestion ? 5 : 4}>
                  <PeerChecks checks={a.peerChecks} />
                </td>
              </tr>
            )}
            {watching === a.id && a.recording && (
              <tr>
                <td colSpan={showQuestion ? 5 : 4}>
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
  );
}
