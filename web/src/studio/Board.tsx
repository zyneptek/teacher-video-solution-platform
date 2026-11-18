// Çözüm tahtası: soru görseli üzerinde kalem ve silgi.
// Kalem yumuşatılmış çizgi çizer; silgi parça silgisidir (çizgiye değerse tüm çizgi silinir).
// Çizim doğrudan canvas'a yapılır (React'ten geçmez), böylece çizgi işaretçiyi gecikmeden izler.
// Etkileşim mantığı `shared/` içindeki InkController'dadır; burada yalnızca işaretçi olayları iletilir.
import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  BOARD,
  InkController,
  InkPainter,
  questionImageRect,
  type DrawingEvent,
  type InkSample,
  type Tool,
} from '@app/shared';

type Props = {
  imageUrl: string | null;
  tool: Tool;
  // Kayıt saati (ms). Duraklatılmışsa donmuş değeri döner.
  getTimeMs: () => number;
  // Biten her çizgi ve her silme için çağrılır; olaylar gerçekleşme sırasıyla gelir.
  onEvent: (event: DrawingEvent) => void;
  // true iken çizim yapılamaz (kayıt başlamadan önce ve bittikten sonra).
  disabled?: boolean;
};

const fill: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };

export function Board({ imageUrl, tool, getTimeMs, onEvent, disabled = false }: Props) {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<InkController | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  // Olay işleyicilerinin her çizimde yeniden kurulmaması için en güncel değerler burada tutulur.
  const latest = useRef({ tool, getTimeMs, onEvent, disabled });
  useEffect(() => {
    latest.current = { tool, getTimeMs, onEvent, disabled };
  }, [tool, getTimeMs, onEvent, disabled]);

  // Zemin: beyaz + soru görseli.
  useEffect(() => {
    const canvas = baseRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, BOARD.width, BOARD.height);
    if (!imageUrl) return;

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const rect = questionImageRect(image.naturalWidth, image.naturalHeight);
      ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    };
    image.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  function controller(): InkController | null {
    if (!controllerRef.current) {
      const canvas = inkRef.current;
      // desynchronized: tarayıcıya çizimi ekrana beklemeden göndermesini söyler (daha düşük gecikme).
      const ctx = canvas?.getContext('2d', { desynchronized: true });
      if (!canvas || !ctx) return null;
      const events: DrawingEvent[] = [];
      const painter = new InkPainter(ctx, events, () => ctx.clearRect(0, 0, BOARD.width, BOARD.height));
      controllerRef.current = new InkController({
        painter,
        events,
        getTimeMs: () => latest.current.getTimeMs(),
        onEvent: (event) => latest.current.onEvent(event),
      });
    }
    return controllerRef.current;
  }

  // Ekran koordinatını tahta koordinatına çevirir.
  function toSample(event: PointerEvent): InkSample {
    const rect = (inkRef.current as HTMLCanvasElement).getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * BOARD.width) / rect.width,
      y: ((event.clientY - rect.top) * BOARD.height) / rect.height,
      // Olayın gerçekleştiği an ile şimdiki an arasındaki fark (hızlı harekette daha doğru zaman).
      ageMs: performance.now() - event.timeStamp,
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (latest.current.disabled || pointerIdRef.current !== null) return; // tek işaretçi
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const ink = controller();
    if (!ink) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerIdRef.current = event.pointerId;
    ink.begin(latest.current.tool, toSample(event.nativeEvent));
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    // Hızlı harekette iki çizim arasında gelen ara noktalar da alınır (çizgi kopmasın).
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const events = coalesced.length > 0 ? coalesced : [event.nativeEvent];
    controller()?.move(events.map(toSample));
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    pointerIdRef.current = null;
    controller()?.end();
  }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: BOARD.width, aspectRatio: '16 / 9', background: '#fff' }}>
      <canvas ref={baseRef} width={BOARD.width} height={BOARD.height} style={fill} />
      <canvas
        ref={inkRef}
        width={BOARD.width}
        height={BOARD.height}
        style={{ ...fill, touchAction: 'none', cursor: disabled ? 'not-allowed' : 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      />
    </div>
  );
}
