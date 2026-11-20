// Yönetici: tüm atamalar, durum süzgeci ve yeni atama.
import { useCallback, useEffect, useState } from 'react';
import { ASSIGNMENT_STATUS_LABEL, type AssignmentInfo, type AssignmentStatus, type QuestionInfo } from '@app/shared';
import { api } from '../auth/session';
import { AssignForm } from './AssignForm';
import { AssignmentsTable } from './AssignmentsTable';

const isStatus = (v?: string): v is AssignmentStatus => !!v && v in ASSIGNMENT_STATUS_LABEL;

// initialStatus: panel kartından gelinen adres (#/atamalar/<durum>) listeyi o duruma süzer.
export function AssignmentsPage({ initialStatus }: { initialStatus?: string }) {
  const [assignments, setAssignments] = useState<AssignmentInfo[] | null>(null);
  const [questions, setQuestions] = useState<QuestionInfo[]>([]);
  const [version, setVersion] = useState(0); // atama geri alınınca atama formundaki "zaten atandı" listesini yenilemek için
  const [status, setStatus] = useState<AssignmentStatus | ''>(isStatus(initialStatus) ? initialStatus : '');
  useEffect(() => {
    setStatus(isStatus(initialStatus) ? initialStatus : '');
  }, [initialStatus]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ assignments: AssignmentInfo[] }>(`/api/admin/assignments${status ? `?status=${status}` : ''}`);
      setAssignments(r.assignments);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Atamalar yüklenemedi.');
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    api<{ questions: QuestionInfo[] }>('/api/admin/questions').then((r) => setQuestions(r.questions)).catch(() => undefined);
  }, []);

  return (
    <div>
      <h2>Atamalar</h2>
      <div className="card">
        <strong>Yeni atama</strong>
        <AssignForm questions={questions} onAssigned={() => void load()} refreshKey={version} />
      </div>
      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value as AssignmentStatus | '')} data-testid="status-filter">
          <option value="">Tüm durumlar</option>
          {(Object.keys(ASSIGNMENT_STATUS_LABEL) as AssignmentStatus[]).map((s) => (
            <option key={s} value={s}>
              {ASSIGNMENT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      {!assignments && !error && <p>Yükleniyor…</p>}
      {assignments && <AssignmentsTable assignments={assignments} showQuestion onChanged={() => { void load(); setVersion((v) => v + 1); }} />}
    </div>
  );
}
