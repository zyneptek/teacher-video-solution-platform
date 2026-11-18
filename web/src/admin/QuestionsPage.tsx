// Yönetici: soru listesi ve soru detayı (görsel, branş, cevap anahtarı, kazanımlar).
// Cevap anahtarı ve kazanım değişiklikleri anında veritabanına yazılır.
import { useCallback, useEffect, useState } from 'react';
import { ANSWER_KEYS, type OutcomeInfo, type QuestionInfo } from '@app/shared';
import { api } from '../auth/session';
import { OutcomePicker } from './OutcomePicker';

export function QuestionsPage({ id }: { id?: string }) {
  return id ? <QuestionDetail id={id} /> : <QuestionList />;
}

function QuestionList() {
  const [questions, setQuestions] = useState<QuestionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ questions: QuestionInfo[] }>('/api/admin/questions')
      .then((r) => setQuestions(r.questions))
      .catch((err) => setError(err instanceof Error ? err.message : 'Sorular yüklenemedi.'));
  }, []);

  if (error) return <p role="alert" className="error">{error}</p>;
  if (!questions) return <p>Yükleniyor…</p>;

  return (
    <div>
      <h2>Sorular</h2>
      <div className="q-grid" data-testid="question-list">
        {questions.map((q) => (
          <a key={q.id} href={`#/sorular/${q.id}`} className="q-card" data-testid="question-card">
            {q.imageUrl ? <img src={q.imageUrl} alt="" loading="lazy" /> : <div className="q-noimg">Görsel yok</div>}
            <div className="q-meta">
              <span className="badge">{q.branch}</span>
              <span>Cevap: <strong>{q.answerKey}</strong></span>
            </div>
            <div className="muted small">{q.outcomes.length} kazanım{q.questionNumber ? ` · Soru ${q.questionNumber}` : ''}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

function QuestionDetail({ id }: { id: string }) {
  const [question, setQuestion] = useState<QuestionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

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
  }, [load]);

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
