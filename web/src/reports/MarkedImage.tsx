// Soru görseli + isteğe bağlı işaret (kırmızı halka). onPick verilirse görsele tıklanarak işaret konulur (konum 0..1 oransaldır).
import type { MouseEvent } from 'react';

export type Marker = { x: number; y: number };

export function MarkedImage({ src, alt, marker, onPick, small }: { src: string; alt: string; marker?: Marker | null; onPick?: (marker: Marker) => void; small?: boolean }) {
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!onPick) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onPick({ x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)) });
  }
  return (
    <div className={onPick ? 'marked picking' : 'marked'} onClick={handleClick} data-testid={onPick ? 'marker-surface' : undefined}>
      <img src={src} alt={alt} style={small ? { maxHeight: 220, width: 'auto' } : undefined} />
      {marker && <span className="pin" style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }} data-testid="pin" />}
    </div>
  );
}
