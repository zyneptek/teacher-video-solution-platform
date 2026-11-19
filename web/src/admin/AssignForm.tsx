// Atama formu: soru + aynı branştaki öğretmen seçilir. Soru sabit verilirse (soru detayı) yalnızca öğretmen seçilir.
// E-posta ve push sunucuda atama kaydedilirken gönderilir; yöneticiye yalnızca atamanın yapıldığı bildirilir.
import { useEffect, useState, type FormEvent } from 'react';
import type { AssignmentInfo, QuestionInfo, TeacherInfo } from '@app/shared';
import { api } from '../auth/session';

type Props = {
  questions: Pick<QuestionInfo, 'id' | 'branch' | 'questionNumber'>[];
  fixedQuestionId?: string;
  onAssigned: () => void;
};

export function AssignForm({ questions, fixedQuestionId, onAssigned }: Props) {
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [questionId, setQuestionId] = useState(fixedQuestionId ?? '');
  const [teacherId, setTeacherId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    api<{ teachers: TeacherInfo[] }>('/api/admin/teachers').then((r) => setTeachers(r.teachers)).catch(() => undefined);
  }, []);

  const question = questions.find((q) => q.id === (fixedQuestionId ?? questionId));
  // Yalnızca sorunun branşındaki öğretmenler seçilebilir.
  const eligible = question ? teachers.filter((t) => t.branch === question.branch) : [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const r = await api<{ assignment: AssignmentInfo }>('/api/admin/assignments', {
        method: 'POST',
        body: { questionId: fixedQuestionId ?? questionId, teacherId },
      });
      setResult(`${r.assignment.teacherName} öğretmene atandı.`);
      setTeacherId('');
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Atama yapılamadı.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="assign-form" data-testid="assign-form">
      {!fixedQuestionId && (
        <label>
          Soru
          <select value={questionId} onChange={(e) => { setQuestionId(e.target.value); setTeacherId(''); }} required data-testid="assign-question">
            <option value="">Seçin…</option>
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.branch} — {q.questionNumber ? `Soru ${q.questionNumber}` : q.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Öğretmen {question ? `(${question.branch})` : ''}
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required disabled={!question} data-testid="assign-teacher">
          <option value="">{question ? (eligible.length ? 'Seçin…' : 'Bu branşta öğretmen yok') : 'Önce soru seçin'}</option>
          {eligible.map((t) => (
            <option key={t.id} value={t.id}>
              {t.firstName} {t.lastName}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="primary" disabled={busy || !teacherId} data-testid="assign-submit">
        {busy ? 'Atanıyor…' : 'Ata'}
      </button>
      {error && <p role="alert" className="error" data-testid="assign-error" style={{ gridColumn: '1 / -1' }}>{error}</p>}
      {result && <p className="notice" data-testid="assign-result" style={{ gridColumn: '1 / -1', margin: 0 }}>{result}</p>}
    </form>
  );
}
