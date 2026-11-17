// Kayıt mantığı: kayıt saati ve mikrofon.
// Saat yalnızca kayıt sürerken ilerler; duraklatınca donar (çizim zaman damgaları bu saate göre alınır).
// Mikrofon MediaRecorder ile kaydedilir; duraklat/devam aynı ses dosyasına devam eder.
import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'paused';

export type RecordingResult = { audio: Blob; durationMs: number };

// Tarayıcının desteklediği ilk ses biçimi (Chrome: webm/opus, Safari: mp4).
function pickMimeType(): string | undefined {
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
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

  const start = useCallback(async () => {
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
    recorder.start(1000); // 1 sn'lik parçalarla topla
  }, []);

  const pause = useCallback(() => {
    if (recorderRef.current?.state !== 'recording') return;
    recorderRef.current.pause();
    clock.current = { base: getTimeMs(), resumedAt: null };
    setElapsedMs(clock.current.base);
    setStatus('paused');
  }, [getTimeMs]);

  const resume = useCallback(() => {
    if (recorderRef.current?.state !== 'paused') return;
    recorderRef.current.resume();
    clock.current = { base: clock.current.base, resumedAt: performance.now() };
    setStatus('recording');
  }, []);

  // Kaydı bitirir. Mikrofon kesilmişse bitirilemez.
  const finish = useCallback((): Promise<RecordingResult> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return Promise.reject(new Error('Kayıt başlatılmadı.'));
    if (micLostRef.current) return Promise.reject(new Error('Mikrofon bağlantısı kesildi. Ses olmadan kayıt bitirilemez.'));

    const durationMs = getTimeMs();
    return new Promise((resolve) => {
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        clock.current = { base: durationMs, resumedAt: null };
        setElapsedMs(durationMs);
        setStatus('idle');
        resolve({ audio: new Blob(chunksRef.current, { type: recorder.mimeType }), durationMs });
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
