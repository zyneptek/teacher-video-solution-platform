// Çözüm tahtası: soru görseli üzerinde kalem ve silgiyle çizim.
// Çizim doğrudan canvas'a yapılır (React'ten geçmez), böylece çizgi işaretçiyi gecikmeden izler.
// Her nokta tahta koordinatında ve kayıt süresiyle saklanır; videoyu sunucu bu olaylardan üretir.
import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  BOARD,
  TOOL_STYLES,
  drawSegment,
  questionImageRect,
  type Stroke,
  type StrokePoint,
  type Tool,
} from '@app/shared';

type Props = {
  imageUrl: string | null;
  tool: Tool;
  // Kayıt saati (ms). Duraklatılmışsa donmuş değeri döner.
  getTimeMs: () => number;
  onStrokeComplete: (stroke: Stroke) => void;
};

type ActiveStroke = { pointerId: number; stroke: Stroke };

const fill: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };

export function Board({ imageUrl, tool, getTimeMs, onStrokeComplete }: Props) {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const inkCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const activeRef = useRef<ActiveStroke | null>(null);
  const lastTimeRef = useRef(0); // zaman damgaları geriye gitmesin

  // Olay işleyicilerinin her çizimde yeniden kurulmaması için en güncel değerler burada tutulur.
  const latest = useRef({ tool, getTimeMs, onStrokeComplete });
  useEffect(() => {
    latest.current = { tool, getTimeMs, onStrokeComplete };
  }, [tool, getTimeMs, onStrokeComplete]);

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

  function inkContext(): CanvasRenderingContext2D | null {
    if (!inkCtxRef.current) {
      // desynchronized: tarayıcıya çizimi ekrana beklemeden göndermesini söyler (daha düşük gecikme).
      inkCtxRef.current = inkRef.current?.getContext('2d', { desynchronized: true }) ?? null;
    }
    return inkCtxRef.current;
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
    if (activeRef.current) return; // tek işaretçi: ikinci parmak yok sayılır
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const ctx = inkContext();
    if (!ctx) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const tool = latest.current.tool;
    const stroke: Stroke = { tool, ...TOOL_STYLES[tool], points: [] };
    const point = toPoint(event.nativeEvent);
    stroke.points.push(point);
    drawSegment(ctx, stroke, point, point); // dokunuş bir nokta bırakır
    activeRef.current = { pointerId: event.pointerId, stroke };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const active = activeRef.current;
    const ctx = inkContext();
    if (!active || !ctx || active.pointerId !== event.pointerId) return;

    // Hızlı harekette iki çizim arasında gelen ara noktalar da alınır (çizgi kopmasın).
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const events = coalesced.length > 0 ? coalesced : [event.nativeEvent];
    const points = active.stroke.points;
    for (const e of events) {
      const from = points[points.length - 1] as StrokePoint;
      const to = toPoint(e);
      drawSegment(ctx, active.stroke, from, to);
      points.push(to);
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLCanvasElement>) {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    activeRef.current = null;
    latest.current.onStrokeComplete(active.stroke);
  }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: BOARD.width, aspectRatio: '16 / 9', background: '#fff' }}>
      <canvas ref={baseRef} width={BOARD.width} height={BOARD.height} style={fill} />
      <canvas
        ref={inkRef}
        width={BOARD.width}
        height={BOARD.height}
        style={{ ...fill, touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      />
    </div>
  );
}
