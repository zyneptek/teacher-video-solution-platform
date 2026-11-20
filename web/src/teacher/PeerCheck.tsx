// Çapraz kontrol (öğretmen): aynı soruya atanmış başka bir öğretmenin çözümünü "Hatasız" veya "Hatalı" diye değerlendirir.
// Not isteğe bağlıdır. Değerlendirme yalnızca yöneticiye görünür; videonun sahibi görmez. Aynı video için tekrar seçilirse güncellenir.
import { useState } from 'react';
import { PEER_NOTE_MAX, PEER_VERDICT_LABEL, type MyPeerCheck, type PeerVerdict } from '@app/shared';
import { api } from '../auth/session';

type Props = { assignmentId: string; recordingId: string; initial: MyPeerCheck | null };

export function PeerCheck({ assignmentId, recordingId, initial }: Props) {
  const [check, setCheck] = useState<MyPeerCheck | null>(initial);
  const [note, setNote] = useState(initial?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(verdict: PeerVerdict) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ check: MyPeerCheck }>(`/api/teacher/assignments/${assignmentId}/peer-check`, { method: 'PUT', body: { recordingId, verdict, note } });
      setCheck(r.check);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Değerlendirme kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="peer-box" data-testid="peer-box">
      <strong className="small">Bu çözümü değerlendirin</strong>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={PEER_NOTE_MAX} rows={2} placeholder="Not (isteğe bağlı)" aria-label="Not" data-testid="peer-note" />
      <div className="btn-row">
        <button type="button" className="accent-btn" aria-pressed={check?.verdict === 'correct'} disabled={busy} onClick={() => void save('correct')} data-testid="peer-correct">
          {PEER_VERDICT_LABEL.correct}
        </button>
        <button type="button" className="accent-btn" aria-pressed={check?.verdict === 'faulty'} disabled={busy} onClick={() => void save('faulty')} data-testid="peer-faulty">
          {PEER_VERDICT_LABEL.faulty}
        </button>
      </div>
      {check && <p className="muted small" style={{ margin: 0 }} data-testid="peer-saved">Değerlendirmeniz kaydedildi: {PEER_VERDICT_LABEL[check.verdict]}</p>}
      {error && <p role="alert" className="error" data-testid="peer-error">{error}</p>}
    </div>
  );
}
