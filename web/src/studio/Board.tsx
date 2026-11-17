// Çözüm tahtası: soru görseli üzerinde kalem ve silgi.
// Kalem yumuşatılmış çizgi çizer; silgi parça silgisidir (çizgiye değerse tüm çizgi silinir).
// Çizim doğrudan canvas'a yapılır (React'ten geçmez), böylece çizgi işaretçiyi gecikmeden izler.
// Her nokta tahta koordinatında ve kayıt süresiyle saklanır; videoyu sunucu bu olaylardan üretir.
import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  BOARD,
  PEN_STYLE,
  InkPainter,
  eraserHitsStroke,
  questionImageRect,
  type DrawingEvent,
  type StrokeEvent,
  type StrokePoint,
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

type Active =
  | { kind: 'pen'; pointerId: number; index: number; stroke: StrokeEvent }
  | { kind: 'eraser'; pointerId: number; last: StrokePoint };

const fill: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };

export function Board({ imageUrl, tool, getTimeMs, onEvent, disabled = false }: Props) {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const painterRef = useRef<InkPainter | null>(null);
  const eventsRef = useRef<DrawingEvent[]>([]); // tahtanın kendi günlüğü (silmelerde hedef bulmak için)
  const activeRef = useRef<Active | null>(null);
  const lastTimeRef = useRef(0); // zaman damgaları geriye gitmesin

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

  function painter(): InkPainter | null {
    if (!painterRef.current) {
      const canvas = inkRef.current;
      // desynchronized: tarayıcıya çizimi ekrana beklemeden göndermesini söyler (daha düşük gecikme).
      const ctx = canvas?.getContext('2d', { desynchronized: true });
      if (!canvas || !ctx) return null;
      painterRef.current = new InkPainter(ctx, eventsRef.current, () => ctx.clearRect(0, 0, BOARD.width, BOARD.height));
    }
    return painterRef.current;
  }

  // Silgi from'dan to'ya giderken değdiği çizgileri siler.
  function eraseAlong(from: StrokePoint, to: StrokePoint) {
    const ink = painter();
    if (!ink) return;
    const events = eventsRef.current;
    for (let i = 0; i < events.length; i++) {
      const candidate = events[i] as DrawingEvent;
      if (candidate.type !== 'stroke' || ink.isErased(i)) continue;
      if (!eraserHitsStroke(candidate, from, to)) continue;
      const erase: DrawingEvent = { type: 'erase', t: to.t, target: i };
      events.push(erase);
      ink.erase(i);
      latest.current.onEvent(erase);
    }
  }

  // Ekran koordinatını tahta koordinatına ve kayıt süresine çevirir.
  function toPoint(event: PointerEvent): StrokePoint {
    const rect = (inkRef.current as HTMLCanvasElement).getBoundingClientRect();
    const x = ((event.clientX - rect.left) * BOARD.width) / rect.width;
    const y = ((event.clientY - rect.top) * BOARD.height) / rect.height;
    // Olayın gerçekleştiği an ile şimdiki an arasındaki fark çıkarılır (hızlı harekette daha doğru zaman).
    const age = performance.now() - event.timeStamp;
    const t = Math.max(lastTimeRef.current, Math.round(latest.current.getTimeMs() - age));
    lastTimeRef.current = t;
    return { x, y, t };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (latest.current.disabled || activeRef.current) return; // tek işaretçi: ikinci parmak yok sayılır
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const ink = painter();
    if (!ink) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toPoint(event.nativeEvent);
    if (latest.current.tool === 'pen') {
      const stroke: StrokeEvent = { type: 'stroke', ...PEN_STYLE, points: [point] };
      const index = eventsRef.current.push(stroke) - 1;
      ink.point(index, 0); // dokunuş bir nokta bırakır
      activeRef.current = { kind: 'pen', pointerId: event.pointerId, index, stroke };
    } else {
      activeRef.current = { kind: 'eraser', pointerId: event.pointerId, last: point };
      eraseAlong(point, point);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const active = activeRef.current;
    const ink = painter();
    if (!active || !ink || active.pointerId !== event.pointerId) return;

    // Hızlı harekette iki çizim arasında gelen ara noktalar da alınır (çizgi kopmasın).
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const events = coalesced.length > 0 ? coalesced : [event.nativeEvent];
    for (const e of events) {
      const to = toPoint(e);
      if (active.kind === 'pen') {
        active.stroke.points.push(to);
        ink.point(active.index, active.stroke.points.length - 1);
      } else {
        eraseAlong(active.last, to);
        active.last = to;
      }
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLCanvasElement>) {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    activeRef.current = null;
    if (active.kind === 'pen') {
      painter()?.end(active.index);
      latest.current.onEvent(active.stroke);
    }
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
