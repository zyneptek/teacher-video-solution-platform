// Atama formu: soru + aynı branştaki öğretmen(ler) seçilir. Soru sabit verilirse (soru detayı) yalnızca öğretmenler seçilir.
// Toplu atama: onay kutularıyla birden çok öğretmen seçilip tek işlemde atanır. Her öğretmen için ayrı atama kaydı oluşur
// (kendi durumu, videosu, bildirimi ve e-postası olur); biri başarısız olursa diğerleri geri alınmaz.
// E-posta ve push sunucuda atama kaydedilirken gönderilir; yöneticiye yalnızca atamanın yapıldığı bildirilir.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AssignmentInfo, QuestionInfo, TeacherInfo } from '@app/shared';
import { api } from '../auth/session';

type Props = {
  questions: Pick<QuestionInfo, 'id' | 'branch' | 'questionNumber'>[];
  fixedQuestionId?: string;
  onAssigned: () => void;
  refreshKey?: number; // değişince "zaten atandı" listesi yeniden okunur (atama geri alındığında)
};

const fullName = (t: Pick<TeacherInfo, 'firstName' | 'lastName'>) => `${t.firstName} ${t.lastName}`;

export function AssignForm({ questions, fixedQuestionId, onAssigned, refreshKey = 0 }: Props) {
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [questionId, setQuestionId] = useState(fixedQuestionId ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [taken, setTaken] = useState<Set<string>>(new Set()); // bu soruya zaten atanmış öğretmenler
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const currentQuestionId = fixedQuestionId ?? questionId;

  useEffect(() => {
    api<{ teachers: TeacherInfo[] }>('/api/admin/teachers').then((r) => setTeachers(r.teachers)).catch(() => undefined);
  }, []);

  // Zaten atanmış öğretmenler seçilemez (aynı soru aynı öğretmene ikinci kez atanmaz).
  const loadTaken = useCallback(async () => {
    if (!currentQuestionId) {
      setTaken(new Set());
      return;
    }
    const r = await api<{ assignments: AssignmentInfo[] }>(`/api/admin/assignments?questionId=${currentQuestionId}`);
    setTaken(new Set(r.assignments.map((a) => a.teacherId)));
  }, [currentQuestionId, refreshKey]);

  useEffect(() => {
    void loadTaken().catch(() => undefined);
  }, [loadTaken]);

  const question = questions.find((q) => q.id === currentQuestionId);
  // Yalnızca sorunun branşındaki öğretmenler seçilebilir.
  const eligible = question ? teachers.filter((t) => t.branch === question.branch) : [];

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    const chosen = eligible.filter((t) => selected.has(t.id));
    try {
      const outcomes = await Promise.allSettled(
        chosen.map((t) => api<{ assignment: AssignmentInfo }>('/api/admin/assignments', { method: 'POST', body: { questionId: currentQuestionId, teacherId: t.id } })),
      );
      const done = chosen.filter((_, i) => outcomes[i]?.status === 'fulfilled');
      const failed = chosen.flatMap((t, i) => {
        const o = outcomes[i];
        return o?.status === 'rejected' ? [{ teacher: t, message: o.reason instanceof Error ? o.reason.message : 'Atama yapılamadı.' }] : [];
      });
      if (done.length === 1 && done[0]) setResult(`${fullName(done[0])} öğretmene atandı.`);
      else if (done.length > 1) setResult(`${done.length} öğretmene atandı: ${done.map(fullName).join(', ')}.`);
      if (failed.length) setError(failed.map((f) => `${fullName(f.teacher)}: ${f.message}`).join(' '));
      setSelected(new Set(failed.map((f) => f.teacher.id))); // başarısız olanlar seçili kalır, yeniden denenebilir
      onAssigned();
      await loadTaken().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="assign-form" data-testid="assign-form">
      {!fixedQuestionId && (
        <label>
          Soru
          <select value={questionId} onChange={(e) => { setQuestionId(e.target.value); setSelected(new Set()); setResult(null); setError(null); }} required data-testid="assign-question">
            <option value="">Seçin…</option>
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.branch} — {q.questionNumber ? `Soru ${q.questionNumber}` : q.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
      )}
      <fieldset className="teacher-picks" data-testid="assign-teachers">
        <legend>Öğretmenler {question ? `(${question.branch})` : ''}</legend>
        {!question && <span className="muted small">Önce soru seçin</span>}
        {question && eligible.length === 0 && <span className="muted small">Bu branşta öğretmen yok</span>}
        {eligible.map((t) => {
          const already = taken.has(t.id);
          return (
            <label key={t.id} className="check">
              <input type="checkbox" checked={selected.has(t.id)} disabled={already || busy} onChange={() => toggle(t.id)} data-testid="assign-teacher-opt" value={t.id} />
              {fullName(t)}
              {already && <span className="muted small">zaten atandı</span>}
            </label>
          );
        })}
      </fieldset>
      <button type="submit" className="primary" disabled={busy || selected.size === 0} data-testid="assign-submit">
        {busy ? 'Atanıyor…' : selected.size > 1 ? `Ata (${selected.size} öğretmen)` : 'Ata'}
      </button>
      {error && <p role="alert" className="error" data-testid="assign-error">{error}</p>}
      {result && <p className="notice" data-testid="assign-result" style={{ margin: 0 }}>{result}</p>}
    </form>
  );
}
