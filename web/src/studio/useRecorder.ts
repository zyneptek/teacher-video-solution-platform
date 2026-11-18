// Kayıt mantığı: kayıt saati ve mikrofon.
// Saat yalnızca kayıt sürerken ilerler; duraklatınca donar (çizim zaman damgaları bu saate göre alınır).
// Mikrofon MediaRecorder ile kaydedilir; duraklat/devam aynı ses dosyasına devam eder.
import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'paused';

export type RecordingResult = { audio: Blob; camera: Blob | null; durationMs: number };

// Tarayıcının desteklediği ilk ses biçimi (Chrome: webm/opus, Safari: mp4).
function pickMimeType(): string | undefined {
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
}

// Kamera bindirmesi küçük (240x180) olduğundan düşük bit hızı yeter; 3 dakikalık klip ~15 MB kalır.
const CAMERA_BITS_PER_SECOND = 800_000;

// Kamera klibi yalnızca görüntü içerir (ses ayrı kaydedilir).
function pickVideoMimeType(): string | undefined {
  return ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
}

function micErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Mikrofon izni verilmedi. Mikrofonsuz kayıt yapılamaz; tarayıcı ayarlarından mikrofona izin verip tekrar deneyin.';
  }
  if (name === 'NotFoundError') return 'Mikrofon bulunamadı. Bir mikrofon bağlayıp tekrar deneyin.';
  return 'Mikrofon açılamadı. Başka bir uygulama mikrofonu kullanıyor olabilir.';
}

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Saat: base = duraklatmalara kadar biriken süre, resumedAt = şu an çalışıyorsa son başlama anı.
  const clock = useRef<{ base: number; resumedAt: number | null }>({ base: 0, resumedAt: null });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cameraRecorderRef = useRef<MediaRecorder | null>(null);
  const cameraChunksRef = useRef<Blob[]>([]);
  const micLostRef = useRef(false);

  const getTimeMs = useCallback((): number => {
    const { base, resumedAt } = clock.current;
    return resumedAt === null ? base : base + (performance.now() - resumedAt);
  }, []);

  // Kayıt sürerken süre göstergesini güncelle.
  useEffect(() => {
    if (status !== 'recording') return;
    const id = window.setInterval(() => setElapsedMs(getTimeMs()), 200);
    return () => window.clearInterval(id);
  }, [status, getTimeMs]);

  // Sayfadan çıkılırsa mikrofonu bırak.
  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  // cameraStream verilirse kamera da kaydedilir; ses/ekran kaydı kameradan bağımsızdır.
  const start = useCallback(async (cameraStream?: MediaStream | null) => {
    setError(null);
    setStatus('starting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(micErrorMessage(err));
      setStatus('idle');
      return;
    }

    micLostRef.current = false;
    chunksRef.current = [];
    streamRef.current = stream;
    // Kayıt sırasında mikrofon kesilirse (çıkarıldı, izin geri alındı) kayıt bitirilemez.
    stream.getAudioTracks().forEach((track) => {
      track.onended = () => {
        micLostRef.current = true;
        setError('Mikrofon bağlantısı kesildi. Ses olmadan kayıt bitirilemez.');
      };
    });

    const recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    // Saat, ses kaydı gerçekten başladığı anda sıfırdan başlar (ses ve çizim aynı anda başlasın).
    recorder.onstart = () => {
      clock.current = { base: 0, resumedAt: performance.now() };
      setElapsedMs(0);
      setStatus('recording');
    };
    recorderRef.current = recorder;

    cameraRecorderRef.current = null;
    cameraChunksRef.current = [];
    const videoTracks = cameraStream?.getVideoTracks().filter((track) => track.readyState === 'live') ?? [];
    if (cameraStream && videoTracks.length > 0) {
      try {
        const cameraRecorder = new MediaRecorder(new MediaStream(videoTracks), { mimeType: pickVideoMimeType(), videoBitsPerSecond: CAMERA_BITS_PER_SECOND });
        cameraRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) cameraChunksRef.current.push(event.data);
        };
        cameraRecorderRef.current = cameraRecorder;
        cameraRecorder.start(1000);
      } catch {
        cameraRecorderRef.current = null; // kamera kaydedilemezse ekran ve sesle devam
      }
    }
    recorder.start(1000); // 1 sn'lik parçalarla topla
  }, []);

  const pause = useCallback(() => {
    if (recorderRef.current?.state !== 'recording') return;
    recorderRef.current.pause();
    if (cameraRecorderRef.current?.state === 'recording') cameraRecorderRef.current.pause();
    clock.current = { base: getTimeMs(), resumedAt: null };
    setElapsedMs(clock.current.base);
    setStatus('paused');
  }, [getTimeMs]);

  const resume = useCallback(() => {
    if (recorderRef.current?.state !== 'paused') return;
    recorderRef.current.resume();
    if (cameraRecorderRef.current?.state === 'paused') cameraRecorderRef.current.resume();
    clock.current = { base: clock.current.base, resumedAt: performance.now() };
    setStatus('recording');
  }, []);

  // Kaydı bitirir. Mikrofon kesilmişse bitirilemez.
  const finish = useCallback((): Promise<RecordingResult> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return Promise.reject(new Error('Kayıt başlatılmadı.'));
    if (micLostRef.current) return Promise.reject(new Error('Mikrofon bağlantısı kesildi. Ses olmadan kayıt bitirilemez.'));

    const durationMs = getTimeMs();
    // Kamera klibi (varsa) ses kaydı durmadan önce kapatılır.
    const cameraRecorder = cameraRecorderRef.current;
    const cameraDone = new Promise<Blob | null>((resolve) => {
      if (!cameraRecorder || cameraRecorder.state === 'inactive') {
        resolve(cameraChunksRef.current.length > 0 ? new Blob(cameraChunksRef.current) : null);
        return;
      }
      cameraRecorder.onstop = () => resolve(cameraChunksRef.current.length > 0 ? new Blob(cameraChunksRef.current, { type: cameraRecorder.mimeType }) : null);
      cameraRecorder.stop();
    });
    return new Promise((resolve) => {
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        cameraRecorderRef.current = null;
        clock.current = { base: durationMs, resumedAt: null };
        setElapsedMs(durationMs);
        setStatus('idle');
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType });
        void cameraDone.then((camera) => resolve({ audio, camera, durationMs }));
      };
      recorder.stop();
    });
  }, [getTimeMs]);

  const reset = useCallback(() => {
    clock.current = { base: 0, resumedAt: null };
    setElapsedMs(0);
    setError(null);
  }, []);

  return { status, error, elapsedMs, getTimeMs, start, pause, resume, finish, reset, setError };
}
