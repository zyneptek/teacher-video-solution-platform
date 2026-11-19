// Kayıt düzenleme: videoda bir aralık seçilir; "Yalnızca bu aralığı tut" (baştan/sondan kırpma) veya "Bu aralığı sil"
// (ortadan kesme). Sunucu düzenlenmiş MP4'ü kaydın yerine koyar; arka arkaya birden fazla düzenleme yapılabilir
// ve "Geri al" son düzenlemeyi geri getirir (her düzenlemenin öncesi sunucuda saklanır).
import { useRef, useState } from 'react';
import type { RecordingInfo, TeacherAssignment } from '@app/shared';
import { api } from '../auth/session';

const MIN_RANGE = 0.1;
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

// notice: son düzenlemenin onay mesajı; panel her düzenlemeden sonra yeni videoyla yeniden kurulduğu için üst bileşende tutulur.
export function EditPanel({ assignmentId, recording, notice, onEdited, onClose }: { assignmentId: string; recording: RecordingInfo; notice: string | null; onEdited: (a: TeacherAssignment, message: string) => void; onClose: () => void }) {
  const total = Math.max(recording.durationSeconds, MIN_RANGE * 2);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(Math.min(total, Math.max(MIN_RANGE, total / 2)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeStart(value: number) {
    const v = Math.max(0, Math.min(value, end - MIN_RANGE));
    setStart(v);
    if (videoRef.current) videoRef.current.currentTime = v;
  }
  function changeEnd(value: number) {
    const v = Math.min(total, Math.max(value, start + MIN_RANGE));
    setEnd(v);
    if (videoRef.current) videoRef.current.currentTime = v;
  }
  const current = () => videoRef.current?.currentTime ?? 0;

  async function apply(op: 'keep' | 'cut') {
    setBusy(true);
    setError(null);
    try {
      const { assignment } = await api<{ assignment: TeacherAssignment }>(`/api/teacher/assignments/${assignmentId}/recording/edit`, { method: 'POST', body: { op, start, end } });
      // Video değişince panel yeni sürümle yeniden kurulur (kaydırıcılar sıfırlanır).
      onEdited(assignment, op === 'keep' ? 'Seçilen aralık tutuldu, kalan kısım kırpıldı.' : 'Seçilen aralık videodan silindi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt düzenlenemedi.');
      setBusy(false);
    }
  }

  async function undo() {
    setBusy(true);
    setError(null);
    try {
      const { assignment } = await api<{ assignment: TeacherAssignment }>(`/api/teacher/assignments/${assignmentId}/recording/undo`, { method: 'POST' });
      onEdited(assignment, 'Son düzenleme geri alındı.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Düzenleme geri alınamadı.');
      setBusy(false);
    }
  }

  const keepSeconds = end - start;
  const cutSeconds = total - (end - start);

  return (
    <div className="trim" data-testid="edit-panel">
      <video ref={videoRef} src={recording.videoUrl} controls className="trim-video" />
      <div className="trim-controls">
      <label>
        Aralık başlangıcı: <strong>{fmt(start)}</strong>
        <input type="range" min={0} max={total} step={0.1} value={start} onChange={(e) => changeStart(Number(e.target.value))} data-testid="edit-start" />
        <button type="button" className="primary" onClick={() => changeStart(current())} data-testid="edit-start-here">Mevcut konumu başlangıç yap</button>
      </label>
      <label>
        Aralık bitişi: <strong>{fmt(end)}</strong>
        <input type="range" min={0} max={total} step={0.1} value={end} onChange={(e) => changeEnd(Number(e.target.value))} data-testid="edit-end" />
        <button type="button" className="primary" onClick={() => changeEnd(current())} data-testid="edit-end-here">Mevcut konumu bitiş yap</button>
      </label>
      <div className="muted small">
        Seçili aralık: {keepSeconds.toFixed(1)} sn · Toplam: {total.toFixed(1)} sn
      </div>
      {notice && <p className="notice" data-testid="edit-done" style={{ margin: 0 }}>{notice}</p>}
      {error && <p role="alert" className="error" data-testid="edit-error">{error}</p>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="primary" disabled={busy || keepSeconds < 1} onClick={() => void apply('keep')} data-testid="edit-keep" title="Seçili aralık dışındaki baş ve son kısımlar silinir">
          Yalnızca bu aralığı tut ({keepSeconds.toFixed(1)} sn)
        </button>
        <button type="button" className="primary" disabled={busy || cutSeconds < 1} onClick={() => void apply('cut')} data-testid="edit-cut" title="Seçili aralık videodan çıkarılır, kalan parçalar birleştirilir">
          Bu aralığı sil
        </button>
        <button type="button" className="primary" disabled={busy || !recording.canUndo} onClick={() => void undo()} data-testid="edit-undo">
          ↶ Geri al
        </button>
        <button type="button" className="primary" onClick={onClose} data-testid="edit-close">Kapat</button>
      </div>
      </div>
    </div>
  );
}
