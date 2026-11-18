// Kamera görüntüsü: tahtanın sağ altında küçük dikdörtgen (4:3). Videoda da aynı konumda görünür (sunucu bindirmesiyle aynı yer).
import { useEffect, useRef } from 'react';

export function CameraPreview({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      muted
      playsInline
      data-testid="camera-preview"
      // Tahta 1280x720; bindirme 240x180 px ve 24 px kenar boşluğu → yüzde olarak.
      style={{ position: 'absolute', right: '1.9%', bottom: '3.3%', width: '18.75%', aspectRatio: '4 / 3', borderRadius: 4, objectFit: 'cover', pointerEvents: 'none', border: '2px solid #fff', boxShadow: '0 0 4px rgba(0,0,0,.4)' }}
    />
  );
}
