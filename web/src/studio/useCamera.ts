// İsteğe bağlı kamera: öğretmen açarsa görüntü kayıt ekranında gösterilir ve videoya bindirilir.
// İzin verilmezse veya kamera yoksa kayıt ekran ve sesle devam edebilir; yalnızca bilgi mesajı gösterilir.
import { useCallback, useEffect, useRef, useState } from 'react';

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Kamera izni verilmedi; kayıt kamerasız (ekran ve ses) yapılacak.';
  }
  if (name === 'NotFoundError') return 'Kamera bulunamadı; kayıt kamerasız (ekran ve ses) yapılacak.';
  return 'Kamera açılamadı; kayıt kamerasız (ekran ve ses) yapılacak.';
}

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const toggle = useCallback(async () => {
    if (streamRef.current) {
      stop();
      return;
    }
    setNotice(null);
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      streamRef.current = next;
      setStream(next);
      // Kamera kayıt sırasında kesilirse kayıt ses ve ekranla sürer.
      next.getVideoTracks().forEach((track) => {
        track.onended = () => {
          streamRef.current = null;
          setStream(null);
          setNotice('Kamera bağlantısı kesildi; kayıt kamerasız sürüyor.');
        };
      });
    } catch (err) {
      setNotice(cameraErrorMessage(err));
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { stream, notice, toggle, stop };
}
