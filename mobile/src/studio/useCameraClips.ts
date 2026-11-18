// İsteğe bağlı kamera (tablet): açıksa kayıt sürerken video klipleri kaydeder; ses ayrı (expo-audio) kaydedilir.
// expo-camera kaydı duraklatamaz; bu yüzden her duraklatmada klip kapatılır, devam edilince yeni klip açılır.
// Duraklatma süresi kayıt saatinde zaten yok sayıldığı için sunucu klipleri art arda ekler.
// İzin verilmezse veya kamera hata verirse kayıt ekran ve sesle sürer.
import { useCameraPermissions, type CameraView } from 'expo-camera';
import { useCallback, useRef, useState } from 'react';

export function useCameraClips() {
  const [permission, requestPermission] = useCameraPermissions();
  const [enabled, setEnabled] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const readyRef = useRef(false);
  const clipsRef = useRef<string[]>([]);
  const pendingRef = useRef<Promise<void> | null>(null);

  const toggle = useCallback(async () => {
    setNotice(null);
    if (enabled) {
      setEnabled(false);
      readyRef.current = false;
      return;
    }
    const granted = permission?.granted ? true : (await requestPermission()).granted;
    if (!granted) {
      setNotice('Kamera izni verilmedi; kayıt kamerasız (ekran ve ses) yapılacak.');
      return;
    }
    setEnabled(true);
  }, [enabled, permission, requestPermission]);

  const onReady = useCallback(() => {
    readyRef.current = true;
  }, []);

  // Yeni klip başlatır (kayıt başlarken ve devam edilirken).
  const startClip = useCallback(() => {
    const camera = cameraRef.current;
    if (!enabled || !camera || !readyRef.current || pendingRef.current) return;
    pendingRef.current = camera
      .recordAsync()
      .then((result) => {
        if (result?.uri) clipsRef.current.push(result.uri);
      })
      .catch(() => setNotice('Kamera kaydedilemedi; kayıt kamerasız sürüyor.'))
      .finally(() => {
        pendingRef.current = null;
      });
  }, [enabled]);

  // Açık klibi kapatır ve dosyanın hazır olmasını bekler (duraklatırken ve bitirirken).
  const stopClip = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    cameraRef.current?.stopRecording();
    await pending;
  }, []);

  // Bitirdikten sonra klip listesini verir ve temizler.
  const takeClips = useCallback((): string[] => {
    const clips = clipsRef.current;
    clipsRef.current = [];
    return clips;
  }, []);

  const reset = useCallback(() => {
    clipsRef.current = [];
  }, []);

  return { enabled, notice, cameraRef, toggle, onReady, startClip, stopClip, takeClips, reset };
}
