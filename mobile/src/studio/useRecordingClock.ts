// Kayıt saati ve durumu (mobil). Web'deki useRecorder'ın saat mantığıyla aynıdır:
// saat yalnızca kayıt sürerken ilerler, duraklatınca donar; çizim zaman damgaları bu saate göre alınır.
// Mikrofon kaydı bu kancaya sonra bağlanacak (expo-audio).
import { useCallback, useEffect, useRef, useState } from 'react';

export type RecordingStatus = 'idle' | 'recording' | 'paused';

export function useRecordingClock() {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  // base = duraklatmalara kadar biriken süre, resumedAt = şu an çalışıyorsa son başlama anı.
  const clock = useRef<{ base: number; resumedAt: number | null }>({ base: 0, resumedAt: null });

  const getTimeMs = useCallback((): number => {
    const { base, resumedAt } = clock.current;
    return resumedAt === null ? base : base + (performance.now() - resumedAt);
  }, []);

  // Kayıt sürerken süre göstergesini güncelle.
  useEffect(() => {
    if (status !== 'recording') return;
    const id = setInterval(() => setElapsedMs(getTimeMs()), 200);
    return () => clearInterval(id);
  }, [status, getTimeMs]);

  const start = useCallback(() => {
    clock.current = { base: 0, resumedAt: performance.now() };
    setElapsedMs(0);
    setStatus('recording');
  }, []);

  const pause = useCallback(() => {
    clock.current = { base: getTimeMs(), resumedAt: null };
    setElapsedMs(clock.current.base);
    setStatus('paused');
  }, [getTimeMs]);

  const resume = useCallback(() => {
    clock.current = { base: clock.current.base, resumedAt: performance.now() };
    setStatus('recording');
  }, []);

  // Kaydı bitirir ve toplam süreyi (ms) döndürür.
  const finish = useCallback((): number => {
    const duration = getTimeMs();
    clock.current = { base: 0, resumedAt: null };
    setElapsedMs(0);
    setStatus('idle');
    return duration;
  }, [getTimeMs]);

  return { status, elapsedMs, getTimeMs, start, pause, resume, finish };
}
