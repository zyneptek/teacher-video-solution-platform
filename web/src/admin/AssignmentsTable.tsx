import { ASSIGNMENT_STATUS_LABEL, type AssignmentInfo } from '@app/shared';

export function StatusBadge({ status }: { status: AssignmentInfo['status'] }) {
  return <span className={`status status-${status}`}>{ASSIGNMENT_STATUS_LABEL[status]}</span>;
}

export function AssignmentsTable({ assignments, showQuestion }: { assignments: AssignmentInfo[]; showQuestion: boolean }) {
  if (assignments.length === 0) return <p className="muted">Henüz atama yok.</p>;
  return (
    <table data-testid="assignments-table">
      <thead>
        <tr>
          {showQuestion && <th>Soru</th>}
          <th>Öğretmen</th>
          <th>Durum</th>
          <th>Atanma</th>
        </tr>
      </thead>
      <tbody>
        {assignments.map((a) => (
          <tr key={a.id}>
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
          </tr>
        ))}
      </tbody>
    </table>
  );
}
