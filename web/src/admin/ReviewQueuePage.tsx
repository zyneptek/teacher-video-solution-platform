// Yönetici: onaya gönderilen videolar. Video tarayıcı içinde izlenir; yönetici onaylar veya öğretmene görünecek bir notla geri gönderir.
import { useCallback, useEffect, useState } from 'react';
import type { AssignmentInfo } from '@app/shared';
import { api } from '../auth/session';
import { VideoPreview } from '../studio/VideoPreview';

const MAX_NOTE = 500;

export function ReviewQueuePage() {
  const [items, setItems] = useState<AssignmentInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ assignments: AssignmentInfo[] }>('/api/admin/assignments?status=submitted');
      setItems(r.assignments);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onay bekleyenler yüklenemedi.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h2>Onay bekleyenler</h2>
      {message && <p className="notice" data-testid="review-message">{message}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {!items && !error && <p>Yükleniyor…</p>}
      {items && items.length === 0 && <div className="empty" data-testid="queue-empty">Onay bekleyen video yok.</div>}
      {items?.map((a) => (
        <ReviewCard
          key={a.id}
          assignment={a}
          onDone={(text) => {
            setMessage(text);
            void load();
          }}
        />
      ))}
    </div>
  );
}

function ReviewCard({ assignment: a, onDone }: { assignment: AssignmentInfo; onDone: (message: string) => void }) {
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = `${a.branch} — ${a.questionNumber ? `Soru ${a.questionNumber}` : 'Soru'}`;

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/assignments/${a.id}/approve`, { method: 'POST' });
      onDone(`${label} (${a.teacherName}) onaylandı.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onaylanamadı.');
      setBusy(false);
    }
  }

  async function sendBack() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/assignments/${a.id}/return`, { method: 'POST', body: { note } });
      onDone(`${label} (${a.teacherName}) notla geri gönderildi.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Geri gönderilemedi.');
      setBusy(false);
    }
  }

  return (
    <div className="card" data-testid="review-card">
      <div className="row" style={{ marginBottom: 0 }}>
        <div>
          <a href={`#/sorular/${a.questionId}`}><strong>{label}</strong></a> · {a.teacherName}
          <div className="muted small">Gönderilme: {a.submittedAt ? new Date(a.submittedAt).toLocaleString('tr-TR') : '—'}</div>
        </div>
      </div>
      {a.recording ? <div style={{ maxWidth: 720 }}><VideoPreview src={a.recording.videoUrl} /></div> : <p className="muted">Video bulunamadı.</p>}
      {error && <p role="alert" className="error" data-testid="review-error">{error}</p>}
      {returning ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label>
            Öğretmene görünecek not (zorunlu, en fazla {MAX_NOTE} karakter)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={MAX_NOTE} rows={3} data-testid="return-note-input" style={{ padding: 8, border: '1px solid var(--sage)', borderRadius: 8, font: 'inherit' }} />
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="primary" disabled={busy || !note.trim()} onClick={() => void sendBack()} data-testid="return-submit">Geri gönder</button>
            <button type="button" className="link" onClick={() => setReturning(false)}>Vazgeç</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="primary" disabled={busy} onClick={() => void approve()} data-testid="approve">Onayla</button>
          <button type="button" className="link danger" disabled={busy} onClick={() => setReturning(true)} data-testid="return-open">Geri gönder</button>
        </div>
      )}
    </div>
  );
}
