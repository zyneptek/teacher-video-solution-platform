import { useEffect, useRef, useState } from 'react';
import { VIDEO, type DrawingEvent, type Tool } from '@app/shared';
import { Board } from './Board';
import { api } from '../auth/session';
import { uploadRecording } from './api';
import { StudioControls } from './StudioControls';
import { useCamera } from './useCamera';
import { CameraPreview } from './CameraPreview';
import { useRecorder } from './useRecorder';
import { VideoPreview } from './VideoPreview';

type Phase = 'recording' | 'rendering' | 'failed' | 'done';

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Geçici stüdyo sayfası: kayıt akışını denemek için. Gerçek ekranlar giriş ve yönlendirme eklenince gelecek.
// Öğretmenin soru sayfasından açılır: soru görseli otomatik yüklenir, kayıt sisteme kaydedilir.
function StudioPage({ questionImageUrl, assignmentId }: { questionImageUrl: string; assignmentId: string }) {
  const recorder = useRecorder();
  const camera = useCamera();
  const [tool, setTool] = useState<Tool>('pen');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('recording');
  const [boardKey, setBoardKey] = useState(0);
  const [video, setVideo] = useState<{ url: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const eventsRef = useRef<DrawingEvent[]>([]);
  // Yüklenmeyi bekleyen kayıt: yükleme başarısız olursa "Tekrar dene" ile yeniden gönderilir (kayıt kaybolmaz).
  const pendingRef = useRef<{ audio: Blob; camera: Blob | null; durationMs: number } | null>(null);
  const [sending, setSending] = useState(false);

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
      pendingRef.current = { audio, camera: cameraClip, durationMs };
      camera.stop();
      await upload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Kayıt bitirilemedi.');
      setPhase('recording');
    }
  }

  // Bekleyen kaydı sunucuya gönderir; sunucu MP4'ü üretir. Atama modunda sisteme kaydedilir.
  async function upload() {
    const pending = pendingRef.current;
    if (!pending || !imageFile) return;
    setMessage(null);
    setPhase('rendering');
    try {
      const saved = await uploadRecording(assignmentId, { audio: pending.audio, camera: pending.camera, events: eventsRef.current, durationMs: pending.durationMs });
      if (!saved.recording) throw new Error('Kayıt kaydedilemedi.');
      setVideo({ url: saved.recording.videoUrl });
      pendingRef.current = null;
      setPhase('done');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Video hazırlanamadı.');
      setPhase('failed');
    }
  }

  async function submitForReview() {
    setSending(true);
    setMessage(null);
    try {
      await api(`/api/teacher/assignments/${assignmentId}/submit`, { method: 'POST' });
      window.location.hash = `#/sorularim/${assignmentId}`;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Onaya gönderilemedi.');
    } finally {
      setSending(false);
    }
  }

  // "Sil": video sunucudan da silinir (Storage dosyası ve veritabanı kaydı); soru sayfasına dönülür.
  async function deleteRecording() {
    if (!window.confirm('Video silinsin mi? Bu işlem geri alınamaz.')) return;
    setSending(true);
    setMessage(null);
    try {
      await api(`/api/teacher/assignments/${assignmentId}/recording`, { method: 'DELETE' });
      window.location.hash = `#/sorularim/${assignmentId}`;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Video silinemedi.');
      setSending(false);
    }
  }

  function handleNewRecording() {
    setVideo(null);
    setPhase('recording');
    setMessage(null);
    eventsRef.current = [];
    pendingRef.current = null;
    recorder.reset();
    setBoardKey((k) => k + 1);
  }

  // Soru sayfasından gelindiyse soru görseli otomatik yüklenir (görsel seçme alanı gösterilmez).
  useEffect(() => {
    let cancelled = false;
    fetch(questionImageUrl)
      .then((r) => r.blob())
      .then((blob) => {
        if (!cancelled) handleFile(new File([blob], 'soru.jpg', { type: blob.type || 'image/jpeg' }));
      })
      .catch(() => setMessage('Soru görseli yüklenemedi.'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionImageUrl]);

  // Kayıt süre sınırına gelince otomatik bitir.
  useEffect(() => {
    if (active && elapsedMs >= VIDEO.maxSeconds * 1000) void handleFinish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedMs, active]);

  return (
    <main style={{ padding: 16, maxWidth: 1312, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
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
      {phase === 'rendering' && <p data-testid="rendering">Video hazırlanıyor ve sisteme kaydediliyor…</p>}
      {phase === 'failed' && (
        <p style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="primary" onClick={() => void upload()} data-testid="retry-upload">Tekrar dene</button>
          <button type="button" onClick={handleNewRecording}>Vazgeç ve yeniden çek</button>
        </p>
      )}

      {phase === 'done' && video ? (
        <section>
          <p data-testid="done" className="notice">Video hazır. İzleyip kaydedebilir, kaydedip onaya gönderebilir veya silebilirsiniz.</p>
          <VideoPreview src={video.url} />
          <p style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="primary" onClick={() => void submitForReview()} disabled={sending} data-testid="submit-review">
              {sending ? 'Gönderiliyor…' : 'Kaydet ve onaya gönder'}
            </button>
            <a href={`#/sorularim/${assignmentId}`} data-testid="save-draft">Kaydet</a>
            <button type="button" className="link danger" onClick={() => void deleteRecording()} disabled={sending} data-testid="delete-new">Sil</button>
            <a href={`#/sorularim/${assignmentId}/duzenle`} data-testid="edit-after">Düzenle (kırp / bölüm sil)</a>
            <button type="button" onClick={handleNewRecording}>Yeniden çek</button>
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
