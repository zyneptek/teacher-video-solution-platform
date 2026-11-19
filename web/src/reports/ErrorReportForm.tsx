// Öğretmen: soru için hata bildirimi formu. Tür seçilir (altı hazır tür + serbest metin), kısa açıklama yazılır,
// isteğe bağlı olarak sorunun görseli üzerinde hata yeri işaretlenir ve bir ekran görüntüsü veya en fazla 1 dakikalık video eklenir.
import { useState, type FormEvent } from 'react';
import { ERROR_REPORT_LIMITS, ERROR_REPORT_TYPES, type ErrorReportInfo, type ErrorReportType } from '@app/shared';
import { api } from '../auth/session';
import type { Marker } from './MarkedImage';

const MB = 1024 * 1024;

// Videonun süresini tarayıcıda okur; süre okunamazsa null (sunucu ayrıca denetler).
function readVideoSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

type Props = {
  assignmentId: string;
  marker: Marker | null;
  picking: boolean;
  onPickingChange: (picking: boolean) => void;
  onClearMarker: () => void;
  onSent: (report: ErrorReportInfo) => void;
  onClose: () => void;
};

export function ErrorReportForm({ assignmentId, marker, picking, onPickingChange, onClearMarker, onSent, onClose }: Props) {
  const [type, setType] = useState<ErrorReportType | ''>('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pickFile(selected: File | null) {
    setFileError(null);
    setFile(null);
    if (!selected) return;
    if ((ERROR_REPORT_LIMITS.imageTypes as readonly string[]).includes(selected.type)) {
      if (selected.size > ERROR_REPORT_LIMITS.imageBytes) return setFileError('Ekran görüntüsü en fazla 5 MB olabilir.');
    } else if ((ERROR_REPORT_LIMITS.videoTypes as readonly string[]).includes(selected.type)) {
      if (selected.size > ERROR_REPORT_LIMITS.videoBytes) return setFileError(`Video en fazla ${ERROR_REPORT_LIMITS.videoBytes / MB} MB olabilir.`);
      const seconds = await readVideoSeconds(selected);
      if (seconds !== null && seconds > ERROR_REPORT_LIMITS.videoSeconds + 1) return setFileError('Ek video en fazla 1 dakika olabilir.');
    } else {
      return setFileError('Yalnızca ekran görüntüsü (JPEG, PNG, WebP) veya video (MP4, WebM, MOV) eklenebilir.');
    }
    setFile(selected);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!type) return;
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append('type', type);
      form.append('description', description);
      if (marker) {
        form.append('markerX', String(marker.x));
        form.append('markerY', String(marker.y));
      }
      if (file) form.append('attachment', file);
      const { report } = await api<{ report: ErrorReportInfo }>(`/api/teacher/assignments/${assignmentId}/error-reports`, { method: 'POST', body: form });
      onSent(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata bildirimi gönderilemedi.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="report-form" data-testid="report-form">
      <label>
        Hata türü
        <select value={type} onChange={(e) => setType(e.target.value as ErrorReportType)} required data-testid="report-type">
          <option value="">Seçin…</option>
          {ERROR_REPORT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </label>
      <label>
        Kısa açıklama {type === 'other' ? '(zorunlu)' : ''}
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={ERROR_REPORT_LIMITS.descriptionMax} rows={3} required={type === 'other'} data-testid="report-description-input" />
      </label>
      <div className="marker-row">
        <button type="button" className={picking ? 'primary' : 'ghost-btn'} onClick={() => onPickingChange(!picking)} data-testid="pick-marker">
          {picking ? 'Soru görseline tıklayın…' : marker ? 'İşareti değiştir' : 'Görselde hatayı işaretle'}
        </button>
        {marker && (
          <button type="button" className="link danger" onClick={onClearMarker} data-testid="clear-marker">İşareti kaldır</button>
        )}
      </div>
      <label>
        Ek (ekran görüntüsü veya en fazla 1 dakikalık video)
        <input type="file" accept={[...ERROR_REPORT_LIMITS.imageTypes, ...ERROR_REPORT_LIMITS.videoTypes].join(',')} onChange={(e) => void pickFile(e.target.files?.[0] ?? null)} data-testid="report-file" />
      </label>
      {fileError && <p role="alert" className="error" data-testid="file-error">{fileError}</p>}
      {error && <p role="alert" className="error" data-testid="report-error">{error}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="primary" disabled={busy || !type} data-testid="report-submit">{busy ? 'Gönderiliyor…' : 'Gönder'}</button>
        <button type="button" className="link" onClick={onClose}>Vazgeç</button>
      </div>
    </form>
  );
}
