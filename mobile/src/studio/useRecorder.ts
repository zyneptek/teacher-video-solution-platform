// Mobil kayıt: mikrofon (expo-audio) + kayıt saati.
// Saat yalnızca kayıt sürerken ilerler, duraklatınca donar; çizim zaman damgaları bu saate göre alınır.
// Mikrofon izni yoksa kayıt başlamaz; kayıt sırasında mikrofon hata verirse kayıt bitirilemez.
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { useCallback, useRef, useState } from 'react';
import { useRecordingClock } from './useRecordingClock';

export type RecordingResult = { audioUri: string; durationMs: number };

export function useRecorder() {
  const clock = useRecordingClock();
  const { start: clockStart, pause: clockPause, resume: clockResume, finish: clockFinish } = clock;
  const micLostRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Kayıt sırasında ses kaydedici hata bildirirse (mikrofon koptu, başka uygulama aldı) kayıt bitirilemez.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) => {
    if (status.hasError) {
      micLostRef.current = true;
      setError('Mikrofon bağlantısı kesildi. Ses olmadan kayıt bitirilemez.');
    }
  });

  const start = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setError('Mikrofon izni verilmedi. Mikrofonsuz kayıt yapılamaz; Ayarlar’dan mikrofona izin verip tekrar deneyin.');
        return;
      }
      micLostRef.current = false;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      clockStart(); // saat, ses kaydı başladığı anda sıfırdan başlar
    } catch {
      setError('Mikrofon açılamadı. Başka bir uygulama mikrofonu kullanıyor olabilir.');
    } finally {
      setStarting(false);
    }
  }, [recorder, clockStart]);

  const pause = useCallback(() => {
    recorder.pause();
    clockPause();
  }, [recorder, clockPause]);

  // Duraklatılmış kayıt, record() yeniden çağrılarak kaldığı yerden sürer.
  const resume = useCallback(() => {
    recorder.record();
    clockResume();
  }, [recorder, clockResume]);

  // Kaydı bitirir. Mikrofon kesilmişse bitirilemez.
  const finish = useCallback(async (): Promise<RecordingResult> => {
    if (micLostRef.current) throw new Error('Mikrofon bağlantısı kesildi. Ses olmadan kayıt bitirilemez.');
    const durationMs = clockFinish();
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    const audioUri = recorder.uri;
    if (!audioUri) throw new Error('Ses dosyası oluşturulamadı.');
    return { audioUri, durationMs };
  }, [recorder, clockFinish]);

  return { status: clock.status, elapsedMs: clock.elapsedMs, getTimeMs: clock.getTimeMs, starting, error, setError, start, pause, resume, finish };
}
