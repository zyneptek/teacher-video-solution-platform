// Çizim tahtası ve video için ortak tipler ve çizim kodu.
// Aynı kod ekranda canlı çizim yapan istemcilerde ve videoyu üreten sunucuda kullanılır;
// böylece ekranda görülen çizgi ile videodaki çizgi aynı olur.

// Videonun çıktı biçimi.
export const VIDEO = { width: 1280, height: 720, fps: 15, maxSeconds: 180 } as const;

// Tahta: sabit 1280x720 mantıksal koordinat sistemi (videonun çözünürlüğüyle aynı).
export const BOARD = { width: VIDEO.width, height: VIDEO.height } as const;

export type Tool = 'pen' | 'eraser';

// MVP: tek renk ve tek kalınlık (tahta koordinat biriminde).
export const PEN_STYLE = { color: '#dc2626', width: 4 } as const;

// Silgi parça silgisidir: çizgiye (kenarından bile) değerse o çizginin tamamı silinir.
// Bu yarıçap, silgi işaretçisinin çizgiye değme payıdır (çizgi kalınlığının yarısına eklenir).
export const ERASER_RADIUS = 10;

// t: kayıt başından itibaren geçen süre (ms). Duraklatma süreleri sayılmaz.
export type StrokePoint = { x: number; y: number; t: number };

// Kalemle çizilmiş bir çizgi (parmak/kalem basılıp kaldırılana kadar).
export type StrokeEvent = { type: 'stroke'; color: string; width: number; points: StrokePoint[] };

// Silginin bir çizgiye değdiği an. target: silinen çizginin olay listesindeki sırası.
export type EraseEvent = { type: 'erase'; t: number; target: number };

// Çizim günlüğü: olaylar gerçekleşme sırasıyla tutulur. Sıra, zaman damgaları eşit olduğunda
// (örneğin duraklatma sırasında yapılan çizimlerde) neyin önce olduğunu belirler.
export type DrawingEvent = StrokeEvent | EraseEvent;

export type Rect = { x: number; y: number; width: number; height: number };

// Soru görseli tahtanın sol tarafındaki bu alana, oranı korunarak sığdırılır.
// Sağ taraf ve görselin altı çözümü yazmak için boş kalır.
const IMAGE_AREA: Rect = { x: 40, y: 40, width: 560, height: 640 };

export function questionImageRect(imageWidth: number, imageHeight: number): Rect {
  // Küçük görseller büyütülmez (bulanıklaşmasın), büyükler sığacak kadar küçültülür.
  const scale = Math.min(IMAGE_AREA.width / imageWidth, IMAGE_AREA.height / imageHeight, 1);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { x: IMAGE_AREA.x, y: IMAGE_AREA.y, width, height };
}

// Hem tarayıcı hem node-canvas bağlamının sağladığı en küçük çizim arayüzü.
export interface DrawingContext {
  strokeStyle: string | object;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  stroke(): void;
}

type XY = { x: number; y: number };

function mid(a: XY, b: XY): XY {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function applyStyle(ctx: DrawingContext, stroke: StrokeEvent): void {
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

// Çizgiye j. noktanın eklenmesiyle ortaya çıkan parçayı çizer.
// Yumuşatma: çizgi, ardışık noktaların orta noktalarından geçen ve noktaları kontrol noktası
// kabul eden ikinci derece eğrilerden oluşur. Hızlı ve küçük el hareketlerinde köşeli görünmez.
// Bu yüzden j. nokta, çizgiyi ancak bir sonraki nokta gelince tam olarak etkiler; çizgi bitince
// kalan yarım parça drawStrokeEnd ile tamamlanır.
export function drawStrokePoint(ctx: DrawingContext, stroke: StrokeEvent, j: number): void {
  const p = stroke.points;
  applyStyle(ctx, stroke);
  ctx.beginPath();
  if (j === 0) {
    const a = p[0] as StrokePoint;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x, a.y); // yuvarlak uçla bir nokta bırakır (dokunuş)
  } else if (j === 1) {
    const a = p[0] as StrokePoint;
    const m = mid(a, p[1] as StrokePoint);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(m.x, m.y);
  } else {
    const prev = p[j - 1] as StrokePoint;
    const from = mid(p[j - 2] as StrokePoint, prev);
    const to = mid(prev, p[j] as StrokePoint);
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(prev.x, prev.y, to.x, to.y);
  }
  ctx.stroke();
}

// Çizgi bittiğinde son orta noktadan son noktaya kalan parçayı çizer.
export function drawStrokeEnd(ctx: DrawingContext, stroke: StrokeEvent): void {
  const p = stroke.points;
  if (p.length < 2) return;
  const last = p[p.length - 1] as StrokePoint;
  const from = mid(p[p.length - 2] as StrokePoint, last);
  applyStyle(ctx, stroke);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

// Çizim katmanının durumunu tutar ve çizer. Ekranda canlı çizimde de, sunucuda videoyu
// kare kare üretirken de aynı sınıf kullanılır. Silinen bir çizgi çizim katmanından hemen kalkar:
// katman temizlenir ve silinmemiş çizgiler yeniden çizilir.
export class InkPainter {
  private readonly progress = new Map<number, { count: number; ended: boolean }>();
  private readonly erased = new Set<number>();

  private readonly ctx: DrawingContext;
  private readonly events: DrawingEvent[];
  private readonly clear: () => void;

  constructor(ctx: DrawingContext, events: DrawingEvent[], clear: () => void) {
    this.ctx = ctx;
    this.events = events;
    this.clear = clear;
  }

  isErased(index: number): boolean {
    return this.erased.has(index);
  }

  // events[index] çizgisine j. nokta eklendi (j, points'in son sırası olmalıdır).
  point(index: number, j: number): void {
    const stroke = this.events[index] as StrokeEvent;
    drawStrokePoint(this.ctx, stroke, j);
    this.progress.set(index, { count: j + 1, ended: false });
  }

  end(index: number): void {
    const stroke = this.events[index] as StrokeEvent;
    drawStrokeEnd(this.ctx, stroke);
    const state = this.progress.get(index);
    if (state) state.ended = true;
  }

  erase(target: number): void {
    this.erased.add(target);
    this.redraw();
  }

  // Bir zaman çizelgesi adımını uygular (sunucudaki video üretimi için).
  apply(op: TimelineOp): void {
    if (op.kind === 'point') this.point(op.event, op.index);
    else if (op.kind === 'end') this.end(op.event);
    else this.erase(op.target);
  }

  private redraw(): void {
    this.clear();
    // Map ekleme sırasını korur; çizgiler olay sırasıyla çizilir.
    for (const [index, state] of this.progress) {
      if (this.erased.has(index)) continue;
      const stroke = this.events[index] as StrokeEvent;
      for (let j = 0; j < state.count; j++) drawStrokePoint(this.ctx, stroke, j);
      if (state.ended) drawStrokeEnd(this.ctx, stroke);
    }
  }
}

// Zaman çizelgesi: olayların zamana yayılmış adımları, gerçekleşme sırasıyla.
export type TimelineOp = { t: number } & (
  | { kind: 'point'; event: number; index: number }
  | { kind: 'end'; event: number }
  | { kind: 'erase'; target: number }
);

export function buildTimeline(events: DrawingEvent[]): TimelineOp[] {
  const ops: TimelineOp[] = [];
  events.forEach((event, i) => {
    if (event.type === 'erase') {
      ops.push({ t: event.t, kind: 'erase', target: event.target });
      return;
    }
    event.points.forEach((point, j) => ops.push({ t: point.t, kind: 'point', event: i, index: j }));
    const last = event.points[event.points.length - 1];
    if (last) ops.push({ t: last.t, kind: 'end', event: i });
  });
  return ops;
}

// Bir noktanın, doğru parçasına (a-b) uzaklığının karesi.
function distanceSquaredToSegment(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const f = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  const cx = a.x + f * dx - p.x;
  const cy = a.y + f * dy - p.y;
  return cx * cx + cy * cy;
}

// Silgi işaretçisi from'dan to'ya giderken bu çizgiye değdi mi? Hızlı harekette ince bir çizginin
// üstünden atlanmasın diye silginin yolu küçük adımlarla taranır.
export function eraserHitsStroke(stroke: StrokeEvent, from: XY, to: XY, radius: number = ERASER_RADIUS): boolean {
  const reach = stroke.width / 2 + radius;
  const reachSquared = reach * reach;
  const points = stroke.points;
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 3));

  for (let s = 0; s <= steps; s++) {
    const f = s / steps;
    const p = { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f };
    if (points.length === 1) {
      const only = points[0] as StrokePoint;
      if ((only.x - p.x) ** 2 + (only.y - p.y) ** 2 <= reachSquared) return true;
      continue;
    }
    for (let i = 1; i < points.length; i++) {
      if (distanceSquaredToSegment(p, points[i - 1] as StrokePoint, points[i] as StrokePoint) <= reachSquared) return true;
    }
  }
  return false;
}

// Çizim günlüğünü yüklemek için serileştirir: koordinatlar 0,1 piksele, zaman damgaları 1 ms'ye yuvarlanır.
// Görsel fark yoktur (tahta 1280x720), ama JSON birkaç kat küçülür; yuvarlama sırayı ve geriye gitmemeyi bozmaz.
export function serializeEvents(events: DrawingEvent[]): string {
  return JSON.stringify(events, function (this: unknown, key: string, value: unknown) {
    if (typeof value !== 'number') return value;
    if (key === 'x' || key === 'y') return Math.round(value * 10) / 10;
    if (key === 't') return Math.round(value);
    return value;
  });
}
