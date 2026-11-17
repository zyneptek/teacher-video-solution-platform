// Renderer denemesi: elle hazırlanmış çizim olaylarıyla örnek bir MP4 üretir.
// Kullanım: npm run render:demo -w server -- <çıktı klasörü> [süre (sn), varsayılan 6]
// Sahne: kalemle çizim, silgiyle bir çizgiyi tamamen silme, küçük bir "3" ve "duraklatma sırasında yapılan" çizim.
import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrawingEvent, StrokePoint } from '@app/shared';
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

// Küçük bir "3": iki yarım daire, seyrek noktalarla (yumuşatmayı denemek için).
function smallThree(cx: number, cy: number, t0: number, t1: number): StrokePoint[] {
  const raw: [number, number][] = [
    [-9, -16], [0, -22], [9, -16], [10, -8], [0, -1], [8, 6], [10, 14], [0, 22], [-9, 16],
  ];
  return raw.map(([dx, dy], i) => ({ x: cx + dx, y: cy + dy, t: Math.round(t0 + ((t1 - t0) * i) / (raw.length - 1)) }));
}

const pen = { type: 'stroke', color: '#dc2626', width: 4 } as const;

// Olaylar gerçekleşme sırasıyla; indeks = erase olayının hedefi.
const events: DrawingEvent[] = [
  // 0: 0,5 sn - 2 sn: kırmızı çizgi, soru görselinin üzerinde
  { ...pen, points: line(100, 120, 560, 120, 500, 2000) },
  // 1: 2,2 sn - 3,2 sn: kırmızı çizgi, sağdaki boş alanda
  { ...pen, points: line(700, 200, 1200, 400, 2200, 3200) },
  // 2: 3,5 sn: silgi, 0 numaralı çizginin yalnızca ucuna değiyor; çizginin tamamı silinmeli
  { type: 'erase', t: 3500, target: 0 },
  // 3: küçük "3" (3,6 sn - 4,1 sn)
  { ...pen, points: smallThree(800, 560, 3600, 4100) },
  // 4: duraklatma sırasında çizilmiş: tüm noktalar duraklatma anının zamanını (4,3 sn) taşır
  { ...pen, color: '#16a34a', points: line(950, 560, 1200, 560, 4300, 4300, 10) },
];

const started = Date.now();
await renderVideo({ image: imagePath, events, durationMs, audioPath, outputPath });
console.log(`MP4 üretildi: ${outputPath} (${((Date.now() - started) / 1000).toFixed(1)} sn sürdü)`);
