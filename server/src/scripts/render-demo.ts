// Renderer denemesi: elle hazırlanmış çizim olaylarıyla örnek bir MP4 üretir.
// Kullanım: npm run render:demo -w server -- <çıktı klasörü> [süre (sn), varsayılan 6]
// Sahne: kalemle çizim, silgiyle silme ve "duraklatma sırasında yapılan" çizim.
import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Stroke, StrokePoint } from '@app/shared';
import { getFfmpegPath, renderVideo } from '../render/renderVideo.js';

const outDir = path.resolve(process.argv[2] ?? 'render-demo-output');
await mkdir(outDir, { recursive: true });

const imagePath = fileURLToPath(new URL('../../../Örnek sorular/fabecad6-eef8-4cec-9252-98c82f6b65e5.jpg', import.meta.url));
const audioPath = path.join(outDir, 'tone.wav');
const outputPath = path.join(outDir, 'demo.mp4');
const durationMs = Number(process.argv[3] ?? 6) * 1000;

// Ses yerine geçen 440 Hz ses (ses birleştirmeyi denemek için).
spawnSync(getFfmpegPath(), ['-y', '-f', 'lavfi', '-i', `sine=frequency=440:duration=${durationMs / 1000}`, audioPath], { stdio: 'ignore' });

// Başlangıç ve bitiş noktası arasında, [t0, t1] zaman aralığında eşit aralıklı noktalar üretir.
function line(x0: number, y0: number, x1: number, y1: number, t0: number, t1: number, steps = 30): StrokePoint[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const f = i / steps;
    return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, t: Math.round(t0 + (t1 - t0) * f) };
  });
}

const strokes: Stroke[] = [
  // 0,5 sn - 2 sn: kırmızı kalın çizgi, soru görselinin üzerinde
  { tool: 'pen', color: '#e11d48', width: 8, points: line(100, 120, 560, 120, 500, 2000) },
  // 2,2 sn - 3,2 sn: mavi çizgi, sağdaki boş alanda
  { tool: 'pen', color: '#2563eb', width: 6, points: line(700, 200, 1200, 400, 2200, 3200) },
  // 3,5 sn - 4,2 sn: silgi, kırmızı çizginin ortasını siler
  { tool: 'eraser', color: '#000000', width: 40, points: line(300, 120, 400, 120, 3500, 4200, 20) },
  // Duraklatma sırasında çizilmiş: tüm noktalar duraklatma anının zamanını (4,3 sn) taşır.
  { tool: 'pen', color: '#16a34a', width: 8, points: line(700, 550, 1200, 550, 4300, 4300, 10) },
];

const started = Date.now();
await renderVideo({ imagePath, strokes, durationMs, audioPath, outputPath });
console.log(`MP4 üretildi: ${outputPath} (${((Date.now() - started) / 1000).toFixed(1)} sn sürdü)`);
