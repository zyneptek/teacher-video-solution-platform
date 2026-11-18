import { useEffect, useRef, useState } from 'react';
import { VIDEO, type DrawingEvent, type Tool } from '@app/shared';
import { Board } from './Board';
import { renderOnServer } from './api';
import { StudioControls } from './StudioControls';
import { useCamera } from './useCamera';
import { CameraPreview } from './CameraPreview';
import { useRecorder } from './useRecorder';
import { VideoPreview } from './VideoPreview';

type Phase = 'recording' | 'rendering' | 'done';

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Geçici stüdyo sayfası: kayıt akışını denemek için. Gerçek ekranlar giriş ve yönlendirme eklenince gelecek.
function StudioPage() {
  const recorder = useRecorder();
  const camera = useCamera();
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
      const { audio, camera: cameraClip, durationMs } = await recorder.finish();
      if (!imageFile) return;
      setPhase('rendering');
      const { videoUrl, sizeKb, renderMs } = await renderOnServer({
        image: imageFile,
        audio,
        camera: cameraClip,
        events: eventsRef.current,
        durationMs,
      });
      camera.stop();
      setVideo({ url: videoUrl, sizeKb, renderMs });
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

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <input
          type="file"
          accept="image/jpeg,image/png"
          disabled={active || phase !== 'recording'}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <StudioControls
          tool={tool}
          onToolChange={setTool}
          status={status}
          startDisabled={!imageUrl || phase !== 'recording'}
          onStart={() => void recorder.start(camera.stream)}
          onPause={recorder.pause}
          onResume={recorder.resume}
          onFinish={() => void handleFinish()}
          cameraOn={camera.stream !== null}
          cameraDisabled={active || phase !== 'recording'}
          onToggleCamera={() => void camera.toggle()}
        />
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
      {camera.notice && (
        <p role="status" data-testid="camera-notice" style={{ margin: '4px 0' }}>
          {camera.notice}
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
          <VideoPreview src={video.url} />
          <p style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Geçici: sisteme kaydetme atama sistemiyle gelecek; şimdilik MP4 bilgisayara indirilir. */}
            <a
              data-testid="save"
              href={video.url}
              download="cozum-videosu.mp4"
              style={{ padding: '4px 12px', border: '1px solid #767676', borderRadius: 4, color: 'inherit', textDecoration: 'none' }}
            >
              Kaydet (MP4 indir)
            </a>
            <button onClick={handleNewRecording}>Yeni kayıt</button>
          </p>
        </section>
      ) : (
        <div style={{ position: 'relative', maxWidth: 1280 }}>
        <Board
          key={boardKey}
          imageUrl={imageUrl}
          tool={tool}
          getTimeMs={recorder.getTimeMs}
          onEvent={(event) => eventsRef.current.push(event)}
          // Kayıt başlamadan da çizilebilir: bu çizimler videonun ilk karesinden itibaren görünür.
          disabled={!imageUrl || phase !== 'recording'}
        />
        {camera.stream && <CameraPreview stream={camera.stream} />}
        </div>
      )}
    </main>
  );
}

export default StudioPage;
