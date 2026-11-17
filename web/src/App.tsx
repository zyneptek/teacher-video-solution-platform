import { useEffect, useRef, useState } from 'react';
import { VIDEO, type DrawingEvent, type Tool } from '@app/shared';
import { Board } from './studio/Board';
import { renderOnServer } from './studio/api';
import { useRecorder } from './studio/useRecorder';

type Phase = 'recording' | 'rendering' | 'done';

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Geçici stüdyo sayfası: kayıt akışını denemek için. Gerçek ekranlar giriş ve yönlendirme eklenince gelecek.
function App() {
  const recorder = useRecorder();
  const [tool, setTool] = useState<Tool>('pen');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('recording');
  const [boardKey, setBoardKey] = useState(0);
  const [video, setVideo] = useState<{ url: string; sizeKb: number; renderMs: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const eventsRef = useRef<DrawingEvent[]>([]);

  const { status, elapsedMs } = recorder;
  const active = status === 'recording' || status === 'paused';

  function handleFile(file: File | undefined) {
    if (!file) return;
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    eventsRef.current = [];
    setBoardKey((k) => k + 1);
  }

  async function handleFinish() {
    setMessage(null);
    try {
      const { audio, durationMs } = await recorder.finish();
      if (!imageFile) return;
      setPhase('rendering');
      const { video: blob, renderMs } = await renderOnServer({
        image: imageFile,
        audio,
        events: eventsRef.current,
        durationMs,
      });
      setVideo({ url: URL.createObjectURL(blob), sizeKb: Math.round(blob.size / 1024), renderMs });
      setPhase('done');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Kayıt bitirilemedi.');
      setPhase('recording');
    }
  }

  function handleNewRecording() {
    setVideo(null);
    setPhase('recording');
    setMessage(null);
    eventsRef.current = [];
    recorder.reset();
    setBoardKey((k) => k + 1);
  }

  // Kayıt süre sınırına gelince otomatik bitir.
  useEffect(() => {
    if (active && elapsedMs >= VIDEO.maxSeconds * 1000) void handleFinish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedMs, active]);

  return (
    <main style={{ padding: 16, maxWidth: 1312, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20 }}>Stüdyo denemesi</h1>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <input
          type="file"
          accept="image/jpeg,image/png"
          disabled={active || phase !== 'recording'}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button onClick={() => setTool('pen')} aria-pressed={tool === 'pen'}>
          Kalem {tool === 'pen' ? '✓' : ''}
        </button>
        <button onClick={() => setTool('eraser')} aria-pressed={tool === 'eraser'}>
          Silgi {tool === 'eraser' ? '✓' : ''}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <button onClick={() => void recorder.start()} disabled={status !== 'idle' || !imageUrl || phase !== 'recording'}>
          Başlat
        </button>
        <button onClick={recorder.pause} disabled={status !== 'recording'}>
          Duraklat
        </button>
        <button onClick={recorder.resume} disabled={status !== 'paused'}>
          Devam et
        </button>
        <button onClick={() => void handleFinish()} disabled={!active}>
          Bitir
        </button>
        <span data-testid="timer" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(elapsedMs)} / {formatTime(VIDEO.maxSeconds * 1000)}
        </span>
        <span data-testid="status">
          {status === 'starting' && 'Mikrofon açılıyor…'}
          {status === 'recording' && '● Kayıt sürüyor'}
          {status === 'paused' && '❚❚ Duraklatıldı (çizebilirsiniz)'}
        </span>
      </div>

      {!imageUrl && <p style={{ margin: '4px 0' }}>Kayıt başlatmak için önce soru görselini seçin.</p>}
      {recorder.error && (
        <p role="alert" data-testid="error" style={{ color: '#b91c1c', margin: '4px 0' }}>
          {recorder.error}
        </p>
      )}
      {message && (
        <p role="alert" data-testid="error" style={{ color: '#b91c1c', margin: '4px 0' }}>
          {message}
        </p>
      )}
      {phase === 'rendering' && <p data-testid="rendering">Video hazırlanıyor…</p>}

      {phase === 'done' && video ? (
        <section>
          <p data-testid="done">
            Önizleme (MP4, {video.sizeKb} KB, sunucuda {(video.renderMs / 1000).toFixed(1)} sn’de üretildi)
          </p>
          <video data-testid="preview" src={video.url} controls style={{ width: '100%', maxWidth: 1280 }} />
          <p>
            <button onClick={handleNewRecording}>Yeni kayıt</button>
          </p>
        </section>
      ) : (
        <Board
          key={boardKey}
          imageUrl={imageUrl}
          tool={tool}
          getTimeMs={recorder.getTimeMs}
          onEvent={(event) => eventsRef.current.push(event)}
          disabled={!active}
        />
      )}
    </main>
  );
}

export default App;
