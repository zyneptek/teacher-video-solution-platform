// Çizim tahtası ve video için ortak tipler ve çizim kodu.
// Aynı kod ekranda canlı çizim yapan istemcilerde ve videoyu üreten sunucuda kullanılır;
// böylece ekranda görülen çizgi ile videodaki çizgi aynı olur.

// Videonun çıktı biçimi.
export const VIDEO = { width: 1280, height: 720, fps: 15, maxSeconds: 180 } as const;

// Tahta: sabit 1280x720 mantıksal koordinat sistemi (videonun çözünürlüğüyle aynı).
export const BOARD = { width: VIDEO.width, height: VIDEO.height } as const;

export type Tool = 'pen' | 'eraser';

// MVP: tek renk ve tek kalınlık (tahta koordinat biriminde).
export const TOOL_STYLES = {
  pen: { color: '#dc2626', width: 4 },
  eraser: { color: '#000000', width: 28 },
} as const;

// t: kayıt başından itibaren geçen süre (ms). Duraklatma süreleri sayılmaz.
export type StrokePoint = { x: number; y: number; t: number };

// Bir kalem/silgi hareketi (parmak/kalem basılıp kaldırılana kadar).
export type Stroke = { tool: Tool; color: string; width: number; points: StrokePoint[] };

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
  globalCompositeOperation: string;
  strokeStyle: string | object;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
}

// İki nokta arasına bir doğru parçası çizer. Silgi, çizim katmanındaki mürekkebi siler
// (destination-out); bu yüzden çizim, soru görselinden ayrı şeffaf bir katmana yapılmalıdır.
export function drawSegment(
  ctx: DrawingContext,
  stroke: Pick<Stroke, 'tool' | 'color' | 'width'>,
  from: StrokePoint,
  to: StrokePoint,
): void {
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

// Tek bir çizim adımı: bir hareketin iki ardışık noktası arasındaki parça.
export type InkOp = {
  t: number;
  stroke: Pick<Stroke, 'tool' | 'color' | 'width'>;
  from: StrokePoint;
  to: StrokePoint;
};

// Hareketleri zaman sırasıyla çizim adımlarına açar. Tek noktalı hareket (dokunuş) bir nokta çizer.
export function toInkOps(strokes: Stroke[]): InkOp[] {
  const ops: InkOp[] = [];
  for (const stroke of strokes) {
    const { points } = stroke;
    const first = points[0];
    if (!first) continue;
    if (points.length === 1) {
      ops.push({ t: first.t, stroke, from: first, to: first });
      continue;
    }
    for (let i = 1; i < points.length; i++) {
      const to = points[i] as StrokePoint;
      ops.push({ t: to.t, stroke, from: points[i - 1] as StrokePoint, to });
    }
  }
  return ops;
}
