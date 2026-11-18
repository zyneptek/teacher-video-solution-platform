// Stüdyo kontrolleri: mobildeki ile aynı küçük yuvarlak düğmeler.
// Kalem, silgi ve kamera emoji; kayıt düğmeleri kendi çizdiğimiz simgelerdir.
import type { CSSProperties, ReactNode } from 'react';
import type { Tool } from '@app/shared';
import type { RecorderStatus } from './useRecorder';

function RoundButton({ label, selected, disabled, onClick, testId, children }: { label: string; selected?: boolean; disabled?: boolean; onClick: () => void; testId?: string; children: ReactNode }) {
  const style: CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.92)',
    border: selected ? '3px solid #2563eb' : '1px solid #d4d4d8',
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    padding: 0,
    fontSize: 20,
  };
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={selected} disabled={disabled} onClick={onClick} data-testid={testId} style={style}>
      {children}
    </button>
  );
}

const icon = { display: 'block' } as const;
const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" style={icon}><polygon points="4,1 18,10 4,19" fill="#18181b" /></svg>
);
const PauseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" style={icon}><rect x="3" y="1" width="5" height="18" rx="1.5" fill="#18181b" /><rect x="12" y="1" width="5" height="18" rx="1.5" fill="#18181b" /></svg>
);
const StopIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" style={icon}><rect x="2" y="2" width="16" height="16" rx="3" fill="#18181b" /></svg>
);
const RecordIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" style={icon}><circle cx="10" cy="10" r="9" fill="#dc2626" /></svg>
);

type Props = {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  status: RecorderStatus;
  startDisabled?: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  cameraOn: boolean;
  cameraDisabled?: boolean;
  onToggleCamera: () => void;
};

// Kayıt düğmeleri duruma göre değişir:
// bekleme: kayıt (kırmızı daire) | kayıt sürüyor: duraklat, dur | duraklatıldı: devam et (üçgen), dur.
export function StudioControls({ tool, onToolChange, status, startDisabled, onStart, onPause, onResume, onFinish, cameraOn, cameraDisabled, onToggleCamera }: Props) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <RoundButton label="Kalem" selected={tool === 'pen'} onClick={() => onToolChange('pen')} testId="tool-pen">✏️</RoundButton>
      <RoundButton label="Silgi" selected={tool === 'eraser'} onClick={() => onToolChange('eraser')} testId="tool-eraser">🧽</RoundButton>
      <RoundButton label={cameraOn ? 'Kamerayı kapat' : 'Kamerayı aç'} selected={cameraOn} disabled={cameraDisabled} onClick={onToggleCamera} testId="camera-toggle">📷</RoundButton>
      <div style={{ width: 1, height: 28, background: '#d4d4d8' }} />
      {status === 'idle' && <RoundButton label="Kaydı başlat" disabled={startDisabled} onClick={onStart} testId="rec-start"><RecordIcon /></RoundButton>}
      {status === 'starting' && <RoundButton label="Kaydı başlat" disabled onClick={onStart}><RecordIcon /></RoundButton>}
      {status === 'recording' && <RoundButton label="Duraklat" onClick={onPause} testId="rec-pause"><PauseIcon /></RoundButton>}
      {status === 'paused' && <RoundButton label="Devam et" onClick={onResume} testId="rec-resume"><PlayIcon /></RoundButton>}
      {(status === 'recording' || status === 'paused') && <RoundButton label="Kaydı bitir" onClick={onFinish} testId="rec-finish"><StopIcon /></RoundButton>}
    </div>
  );
}
