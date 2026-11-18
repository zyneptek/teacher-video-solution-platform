// Öğretmenin soru listesi: branş, soru bilgisi ve çözüm durumu. Panel ve "Sorularım" sayfası ortak kullanır.
import { ASSIGNMENT_STATUS_LABEL, type TeacherAssignment } from '@app/shared';
import { StatusBadge } from '../admin/AssignmentsTable';

export function solutionLabel(a: TeacherAssignment): string {
  if (a.status === 'assigned') return a.recording ? 'Kayıt hazır, onaya gönderilmedi' : 'Kayıt bekleniyor';
  if (a.status === 'returned') return a.recording ? 'Düzeltip yeniden gönderin' : 'Yeni kayıt gerekli';
  return ASSIGNMENT_STATUS_LABEL[a.status];
}

export function AssignmentCards({ assignments }: { assignments: TeacherAssignment[] }) {
  if (assignments.length === 0) {
    return (
      <div className="empty" data-testid="empty-questions">
        <strong>Henüz size atanmış soru yok.</strong>
        <p style={{ margin: '6px 0 0' }}>Yönetici size bir soru atadığında burada görünür ve bildirim alırsınız.</p>
      </div>
    );
  }
  return (
    <div className="t-list" data-testid="assignment-list">
      {assignments.map((a) => (
        <a key={a.id} href={`#/sorularim/${a.id}`} className="t-card" data-testid="assignment-card">
          <img src={a.question.imageUrl} alt="" loading="lazy" />
          <div className="t-info">
            <div>
              <span className="badge">{a.question.branch}</span> <strong>{a.question.questionNumber ? `Soru ${a.question.questionNumber}` : 'Soru'}</strong>
            </div>
            <div className="muted small">{a.question.outcomes.map((o) => o.code).join(', ')}</div>
            <div className="muted small">Atanma: {new Date(a.assignedAt).toLocaleDateString('tr-TR')}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <StatusBadge status={a.status} />
            <div className="muted small" style={{ marginTop: 4 }}>{solutionLabel(a)}</div>
          </div>
        </a>
      ))}
    </div>
  );
}
