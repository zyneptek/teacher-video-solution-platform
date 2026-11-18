// Yönetici: soru listesi ve soru detayı (görsel, branş, cevap anahtarı, kazanımlar).
// Cevap anahtarı ve kazanım değişiklikleri anında veritabanına yazılır.
import { useCallback, useEffect, useState } from 'react';
import { ANSWER_KEYS, BRANCHES, type AssignmentInfo, type ErrorReportInfo, type Branch, type OutcomeInfo, type QuestionInfo } from '@app/shared';
import { api } from '../auth/session';
import { AssignForm } from './AssignForm';
import { AssignmentsTable } from './AssignmentsTable';
import { ReportCard } from '../reports/ReportViews';
import { OutcomePicker } from './OutcomePicker';

// Son okunan soru listesi: liste ve detay sayfaları arasında geçişte ekran hemen dolar, arkada yenilenir.
let listCache: QuestionInfo[] | null = null;

export function QuestionsPage({ id }: { id?: string }) {
  return id ? <QuestionDetail id={id} /> : <QuestionList />;
}

function QuestionList() {
  const [questions, setQuestions] = useState<QuestionInfo[] | null>(listCache);
  const [error, setError] = useState<string | null>(null);
  const [branch, setBranch] = useState<Branch | ''>('');
  const [answerKey, setAnswerKey] = useState('');
  const [assigned, setAssigned] = useState<'' | 'yes' | 'no'>('');
  const [text, setText] = useState('');

  useEffect(() => {
    api<{ questions: QuestionInfo[] }>('/api/admin/questions')
      .then((r) => {
        listCache = r.questions;
        setQuestions(r.questions);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Sorular yüklenemedi.'));
  }, []);

  if (error) return <p role="alert" className="error">{error}</p>;
  if (!questions) return <p>Yükleniyor…</p>;

  // Süzgeçler: branş, cevap anahtarı, atanma durumu ve metin (soru no, kazanım kodu/açıklaması).
  const needle = text.trim().toLocaleLowerCase('tr');
  const visible = questions.filter(
    (q) =>
      (!branch || q.branch === branch) &&
      (!answerKey || q.answerKey === answerKey) &&
      (!assigned || (assigned === 'yes') === q.assignmentCount > 0) &&
      (!needle ||
        `soru ${q.questionNumber ?? ''}`.toLocaleLowerCase('tr').includes(needle) ||
        q.outcomes.some((o) => `${o.code} ${o.description}`.toLocaleLowerCase('tr').includes(needle))),
  );

  return (
    <div>
      <h2>Sorular</h2>
      <div className="filters" data-testid="question-filters">
        <input type="search" placeholder="Soru no, kazanım kodu veya açıklama…" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} data-testid="q-text" />
        <select value={branch} onChange={(e) => setBranch(e.target.value as Branch | '')} data-testid="q-branch">
          <option value="">Tüm branşlar</option>
          {BRANCHES.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select value={answerKey} onChange={(e) => setAnswerKey(e.target.value)} data-testid="q-key">
          <option value="">Tüm cevaplar</option>
          {ANSWER_KEYS.map((k) => (
            <option key={k} value={k}>Cevap {k}</option>
          ))}
        </select>
        <select value={assigned} onChange={(e) => setAssigned(e.target.value as '' | 'yes' | 'no')} data-testid="q-assigned">
          <option value="">Atama: hepsi</option>
          <option value="yes">Atanmış</option>
          <option value="no">Atanmamış</option>
        </select>
      </div>
      <p className="muted small" data-testid="q-count">{visible.length} / {questions.length} soru</p>
      {visible.length === 0 && <p className="muted">Süzgece uyan soru yok.</p>}
      <div className="q-grid" data-testid="question-list">
        {visible.map((q) => (
          <a key={q.id} href={`#/sorular/${q.id}`} className="q-card" data-testid="question-card">
            {q.imageUrl ? <img src={q.imageUrl} alt="" loading="lazy" /> : <div className="q-noimg">Görsel yok</div>}
            <div className="q-meta">
              <span className="badge">{q.branch}</span>
              <span>Cevap: <strong>{q.answerKey}</strong></span>
            </div>
            <div className="muted small">
              {q.outcomes.length} kazanım{q.questionNumber ? ` · Soru ${q.questionNumber}` : ''} · {q.assignmentCount > 0 ? `${q.assignmentCount} atama` : 'atanmamış'}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function QuestionDetail({ id }: { id: string }) {
  const [question, setQuestion] = useState<QuestionInfo | null>(() => listCache?.find((q) => q.id === id) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentInfo[]>([]);
  const [reports, setReports] = useState<ErrorReportInfo[]>([]);

  const loadAssignments = useCallback(async () => {
    try {
      const r = await api<{ assignments: AssignmentInfo[] }>(`/api/admin/assignments?questionId=${id}`);
      setAssignments(r.assignments);
    } catch {
      // atama listesi alınamazsa sayfanın geri kalanı çalışmaya devam eder
    }
  }, [id]);

  const load = useCallback(async () => {
    try {
      const r = await api<{ question: QuestionInfo }>(`/api/admin/questions/${id}`);
      setQuestion(r.question);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Soru yüklenemedi.');
    }
  }, [id]);

  useEffect(() => {
    void load();
    void loadAssignments();
    api<{ reports: ErrorReportInfo[] }>(`/api/admin/error-reports?questionId=${id}`).then((r) => setReports(r.reports)).catch(() => undefined);
  }, [load, loadAssignments, id]);

  // Her değişiklik veritabanına yazılır, ardından soru yeniden okunur (ekranda görünen = kayıtlı olan).
  async function change(action: () => Promise<unknown>, message: string) {
    setError(null);
    setSaved(null);
    try {
      await action();
      await load();
      setSaved(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.');
    }
  }

  if (!question) return error ? <p role="alert" className="error">{error}</p> : <p>Yükleniyor…</p>;

  return (
    <div>
      <p><a href="#/sorular">← Sorular</a></p>
      <h2>
        {question.branch} sorusu{question.questionNumber ? ` (Soru ${question.questionNumber})` : ''}
      </h2>
      {saved && <p className="notice" data-testid="saved">{saved}</p>}
      {error && <p role="alert" className="error" data-testid="q-error">{error}</p>}

      <div className="q-detail">
        <div className="q-image">{question.imageUrl ? <img src={question.imageUrl} alt="Soru görseli" /> : <p className="muted">Görsel bulunamadı.</p>}</div>

        <div>
          <div className="card">
            <label>
              Cevap anahtarı
              <select
                value={question.answerKey}
                onChange={(e) => void change(() => api(`/api/admin/questions/${id}`, { method: 'PATCH', body: { answerKey: e.target.value } }), 'Cevap anahtarı kaydedildi.')}
                data-testid="answer-key"
              >
                {ANSWER_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="card">
            <strong>Atamalar</strong>
            <AssignmentsTable assignments={assignments} showQuestion={false} />
            <AssignForm
              questions={[{ id: question.id, branch: question.branch, questionNumber: question.questionNumber }]}
              fixedQuestionId={question.id}
              onAssigned={() => void loadAssignments()}
            />
          </div>

          <div className="card" data-testid="question-reports">
            <strong>Hata bildirimleri ({reports.length})</strong>
            {reports.length === 0 ? <p className="muted" style={{ margin: 0 }}>Bu soru için hata bildirimi yok.</p> : (
              <div className="t-list">
                {reports.map((r) => (
                  <ReportCard key={r.id} report={r} imageUrl={question.imageUrl ?? undefined} />
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <strong>Kazanımlar</strong>
            <ul className="outcomes" data-testid="outcome-list">
              {question.outcomes.map((o: OutcomeInfo) => (
                <li key={o.id}>
                  <span>
                    <strong>{o.code}</strong> {o.description}
                  </span>
                  <button
                    type="button"
                    className="link danger"
                    onClick={() => void change(() => api(`/api/admin/questions/${id}/outcomes/${o.id}`, { method: 'DELETE' }), 'Kazanım çıkarıldı.')}
                    data-testid={`remove-${o.code}`}
                  >
                    Çıkar
                  </button>
                </li>
              ))}
            </ul>
            <OutcomePicker
              branch={question.branch}
              excludeIds={question.outcomes.map((o) => o.id)}
              onSelect={(o) => void change(() => api(`/api/admin/questions/${id}/outcomes`, { method: 'POST', body: { outcomeId: o.id } }), `${o.code} soruya eklendi.`)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
