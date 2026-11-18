// Kayıt kırpma: videonun başından ve/veya sonundan kesilecek aralık seçilir; sunucu kırpılmış MP4'ü kaydın yerine koyar.
import { useRef, useState } from 'react';
import type { RecordingInfo, TeacherAssignment } from '@app/shared';
import { api } from '../auth/session';

const MIN_SECONDS = 1;
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

export function TrimPanel({ assignmentId, recording, onTrimmed, onClose }: { assignmentId: string; recording: RecordingInfo; onTrimmed: (a: TeacherAssignment) => void; onClose: () => void }) {
  const total = Math.max(recording.durationSeconds, MIN_SECONDS);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(total);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Başlangıç ve bitiş, aralarında en az MIN_SECONDS kalacak şekilde sınırlanır; ayarlanan ana videoda gidilir.
  function changeStart(value: number) {
    const v = Math.min(value, end - MIN_SECONDS);
    setStart(Math.max(0, v));
    if (videoRef.current) videoRef.current.currentTime = Math.max(0, v);
  }
  function changeEnd(value: number) {
    const v = Math.max(value, start + MIN_SECONDS);
    setEnd(Math.min(total, v));
    if (videoRef.current) videoRef.current.currentTime = Math.min(total, v);
  }
  const current = () => videoRef.current?.currentTime ?? 0;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const { assignment } = await api<{ assignment: TeacherAssignment }>(`/api/teacher/assignments/${assignmentId}/recording/trim`, { method: 'POST', body: { start, end } });
      onTrimmed(assignment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt kırpılamadı.');
      setBusy(false);
    }
  }

  const unchanged = start <= 0.05 && end >= total - 0.05;

  return (
    <div className="trim" data-testid="trim-panel">
      <video ref={videoRef} src={recording.videoUrl} controls className="trim-video" />
      <label>
        Başlangıç: <strong>{fmt(start)}</strong>
        <input type="range" min={0} max={total} step={0.1} value={start} onChange={(e) => changeStart(Number(e.target.value))} data-testid="trim-start" />
        <button type="button" className="link" onClick={() => changeStart(current())}>Mevcut konumu başlangıç yap</button>
      </label>
      <label>
        Bitiş: <strong>{fmt(end)}</strong>
        <input type="range" min={0} max={total} step={0.1} value={end} onChange={(e) => changeEnd(Number(e.target.value))} data-testid="trim-end" />
        <button type="button" className="link" onClick={() => changeEnd(current())}>Mevcut konumu bitiş yap</button>
      </label>
      <div className="muted small">Kırpılmış süre: {(end - start).toFixed(1)} sn (özgün: {total.toFixed(1)} sn). Kırpma kaydın yerine geçer ve geri alınamaz.</div>
      {error && <p role="alert" className="error" data-testid="trim-error">{error}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="primary" disabled={busy || unchanged} onClick={() => void save()} data-testid="trim-save">{busy ? 'Kırpılıyor…' : 'Kırp ve kaydet'}</button>
        <button type="button" className="link" onClick={onClose}>Vazgeç</button>
      </div>
    </div>
  );
}
