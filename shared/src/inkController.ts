// Kalem ve silgi etkileşim mantığı: çizgi başlat, noktaları ekle, silgiyle değen çizgiyi sil.
// Web ve mobil tahtası aynı denetleyiciyi kullanır; böylece ikisi aynı davranır.
// Görünümler (web canvas, mobil Skia) yalnızca dokunma/işaretçi konumlarını bu sınıfa iletir.
import { InkPainter, PEN_STYLE, eraserHitsStroke, type DrawingEvent, type StrokeEvent, type StrokePoint, type Tool } from './drawing';

// x, y: tahta koordinatı. ageMs: olayın gerçekleşmesinden bu yana geçen süre (varsa),
// hızlı harekette zaman damgasını daha doğru hesaplamak için kullanılır.
export type InkSample = { x: number; y: number; ageMs?: number };

type Active = { kind: 'pen'; index: number; stroke: StrokeEvent } | { kind: 'eraser'; last: StrokePoint };

export type InkControllerOptions = {
  painter: InkPainter;
  events: DrawingEvent[]; // painter ile aynı dizi
  getTimeMs: () => number; // kayıt saati (duraklatılmışsa donmuş değer)
  onEvent: (event: DrawingEvent) => void; // biten her çizgi ve her silme
};

export class InkController {
  private readonly painter: InkPainter;
  private readonly events: DrawingEvent[];
  private readonly getTimeMs: () => number;
  private readonly onEvent: (event: DrawingEvent) => void;
  private active: Active | null = null;
  private lastTime = 0; // zaman damgaları geriye gitmesin

  constructor(options: InkControllerOptions) {
    this.painter = options.painter;
    this.events = options.events;
    this.getTimeMs = options.getTimeMs;
    this.onEvent = options.onEvent;
  }

  isDrawing(): boolean {
    return this.active !== null;
  }

  // Parmak/kalem basıldı. Zaten bir hareket sürüyorsa (ikinci parmak) yok sayılır.
  begin(tool: Tool, sample: InkSample): void {
    if (this.active) return;
    const point = this.toPoint(sample);
    if (tool === 'pen') {
      const stroke: StrokeEvent = { type: 'stroke', ...PEN_STYLE, points: [point] };
      const index = this.events.push(stroke) - 1;
      this.painter.point(index, 0); // dokunuş bir nokta bırakır
      this.active = { kind: 'pen', index, stroke };
    } else {
      this.active = { kind: 'eraser', last: point };
      this.eraseAlong(point, point);
    }
  }

  // Hareket. Birden fazla örnek gelebilir (tarayıcının biriktirdiği ara noktalar).
  move(samples: InkSample[]): void {
    const active = this.active;
    if (!active) return;
    for (const sample of samples) {
      const to = this.toPoint(sample);
      if (active.kind === 'pen') {
        active.stroke.points.push(to);
        this.painter.point(active.index, active.stroke.points.length - 1);
      } else {
        this.eraseAlong(active.last, to);
        active.last = to;
      }
    }
  }

  // Parmak/kalem kalktı (veya iptal edildi).
  end(): void {
    const active = this.active;
    if (!active) return;
    this.active = null;
    if (active.kind === 'pen') {
      this.painter.end(active.index);
      this.onEvent(active.stroke);
    }
  }

  private toPoint(sample: InkSample): StrokePoint {
    const t = Math.max(this.lastTime, Math.round(this.getTimeMs() - (sample.ageMs ?? 0)));
    this.lastTime = t;
    return { x: sample.x, y: sample.y, t };
  }

  // Silgi from'dan to'ya giderken değdiği çizgileri siler.
  private eraseAlong(from: StrokePoint, to: StrokePoint): void {
    for (let i = 0; i < this.events.length; i++) {
      const candidate = this.events[i] as DrawingEvent;
      if (candidate.type !== 'stroke' || this.painter.isErased(i)) continue;
      if (!eraserHitsStroke(candidate, from, to)) continue;
      const erase: DrawingEvent = { type: 'erase', t: to.t, target: i };
      this.events.push(erase);
      this.painter.erase(i);
      this.onEvent(erase);
    }
  }
}
