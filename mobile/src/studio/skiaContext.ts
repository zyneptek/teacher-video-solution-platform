// Skia canvas'ı, `shared/` içindeki ortak çizim koduyla (InkPainter) konuşturan adaptör.
// Ortak kod tarayıcı canvas'ına benzeyen bir arayüze (moveTo, lineTo, quadraticCurveTo, stroke) çizer;
// bu sınıf aynı çağrıları Skia yoluna (PathBuilder) çevirip Skia canvas'ına çizer.
// Böylece mobilde, web'de ve sunucudaki videoda çizgiler aynı koddan çıkar.
import { PaintStyle, Skia, StrokeCap, StrokeJoin, type SkCanvas, type SkPathBuilder } from '@shopify/react-native-skia';
import type { DrawingContext } from '@app/shared';

export class SkiaDrawingContext implements DrawingContext {
  strokeStyle: string | object = '#000000';
  lineWidth = 1;
  lineCap = 'round';
  lineJoin = 'round';

  private readonly canvas: SkCanvas;
  private readonly onDraw: () => void;
  private readonly paint = Skia.Paint();
  private builder: SkPathBuilder | null = null;

  // onDraw: her çizimden sonra çağrılır (ekranın yenilenmesini istemek için).
  constructor(canvas: SkCanvas, onDraw: () => void) {
    this.canvas = canvas;
    this.onDraw = onDraw;
    this.paint.setAntiAlias(true);
    this.paint.setStyle(PaintStyle.Stroke);
    this.paint.setStrokeCap(StrokeCap.Round);
    this.paint.setStrokeJoin(StrokeJoin.Round);
  }

  beginPath(): void {
    this.builder = Skia.PathBuilder.Make();
  }

  moveTo(x: number, y: number): void {
    this.builder?.moveTo(x, y);
  }

  lineTo(x: number, y: number): void {
    this.builder?.lineTo(x, y);
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.builder?.quadTo(cpx, cpy, x, y);
  }

  stroke(): void {
    if (!this.builder) return;
    this.paint.setColor(Skia.Color(String(this.strokeStyle)));
    this.paint.setStrokeWidth(this.lineWidth);
    this.canvas.drawPath(this.builder.build(), this.paint);
    this.builder = null;
    this.onDraw();
  }
}
