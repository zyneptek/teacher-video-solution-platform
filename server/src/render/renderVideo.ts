// Çizim olaylarını MP4'e çevirir: soru görseli + zamanlı çizimler (+ ses) → tek MP4.
// Kareler node-canvas ile çizilir ve ham piksel olarak ffmpeg'e verilir.
import { spawn } from 'node:child_process';
import type { Writable } from 'node:stream';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import ffmpegPath from 'ffmpeg-static';
import { BOARD, VIDEO, InkPainter, buildTimeline, questionImageRect, type DrawingEvent } from '@app/shared';

export type RenderOptions = {
  image: string | Buffer; // dosya yolu veya bellekteki görsel
  events: DrawingEvent[];
  durationMs: number; // kayıt süresi (duraklatmalar hariç)
  audioPath?: string;
  // Öğretmen kamerayı açtıysa kamera klipleri (yalnızca görüntü, kayıt sırasıyla); videoda küçük yuvarlak
  // bindirme olur. Duraklatılan kayıtta kamera her devamda yeni klip başlatabilir; klipler art arda eklenir.
  cameraPaths?: string[];
  outputPath: string;
};

// Kamera bindirmesi: sağ altta, 200 px çaplı daire (tahta 1280x720).
const CAMERA_OVERLAY = { size: 200, margin: 24 };

export function getFfmpegPath(): string {
  if (!ffmpegPath) throw new Error('ffmpeg ikili dosyası bulunamadı (ffmpeg-static)');
  return ffmpegPath;
}

// Akışa yazar; ffmpeg yetişemiyorsa (arabellek dolunca) boşalmasını bekler.
function write(stream: Writable, data: Buffer): Promise<void> {
  return new Promise((resolve) => {
    if (stream.write(data)) resolve();
    else stream.once('drain', () => resolve());
  });
}

export async function renderVideo(options: RenderOptions): Promise<void> {
  const { image: imageSource, events, durationMs, audioPath, cameraPaths, outputPath } = options;
  const { width, height } = BOARD;

  // Sabit zemin: beyaz + soru görseli.
  const base = createCanvas(width, height);
  const baseCtx = base.getContext('2d');
  baseCtx.fillStyle = '#ffffff';
  baseCtx.fillRect(0, 0, width, height);
  const image = await loadImage(imageSource);
  const rect = questionImageRect(image.width, image.height);
  baseCtx.drawImage(image, rect.x, rect.y, rect.width, rect.height);

  // Çizim katmanı (şeffaf) ve her karenin birleştirildiği tuval.
  const ink = createCanvas(width, height);
  const inkCtx = ink.getContext('2d');
  const frame = createCanvas(width, height);
  const frameCtx = frame.getContext('2d');

  const args = ['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', String(VIDEO.fps), '-i', 'pipe:0'];
  if (audioPath) args.push('-i', audioPath);
  if (cameraPaths && cameraPaths.length > 0) {
    // Kamera: kareye kırp, bindirme boyutuna küçült, 15 kare/sn'ye sabitle, klipleri art arda ekle,
    // yuvarlak maskele ve sağ alta yerleştir.
    const size = CAMERA_OVERLAY.size;
    const firstCamera = audioPath ? 2 : 1;
    const prepared = cameraPaths.map((cameraPath, i) => {
      args.push('-i', cameraPath);
      return `[${firstCamera + i}:v]setpts=PTS-STARTPTS,fps=${VIDEO.fps},crop='min(iw,ih)':'min(iw,ih)',scale=${size}:${size},format=yuv420p,setsar=1[c${i}]`;
    });
    const joined = cameraPaths.length > 1 ? `${cameraPaths.map((_, i) => `[c${i}]`).join('')}concat=n=${cameraPaths.length}:v=1:a=0[cj]` : '[c0]null[cj]';
    args.push(
      '-filter_complex',
      `${prepared.join(';')};${joined};` +
        `[cj]format=yuva420p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(lte(hypot(X-${size / 2},Y-${size / 2}),${size / 2}),255,0)'[cam];` +
        `[0:v][cam]overlay=x=W-w-${CAMERA_OVERLAY.margin}:y=H-h-${CAMERA_OVERLAY.margin}:eof_action=repeat[v]`,
      '-map',
      '[v]',
    );
    if (audioPath) args.push('-map', '1:a');
    args.push('-t', (durationMs / 1000).toFixed(3));
  }
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p');
  if (audioPath) args.push('-c:a', 'aac', '-b:a', '96k', '-shortest');
  args.push('-movflags', '+faststart', outputPath);

  const ffmpeg = spawn(getFfmpegPath(), args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  ffmpeg.stderr.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-2000);
  });
  ffmpeg.stdin.on('error', () => {
    // ffmpeg erken kapanırsa asıl hata aşağıda 'close' olayında bildirilir.
  });
  const finished = new Promise<void>((resolve, reject) => {
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg ${code} koduyla bitti: ${stderr.trim().split('\n').slice(-3).join(' | ')}`));
    });
  });

  const painter = new InkPainter(inkCtx, events, () => inkCtx.clearRect(0, 0, width, height));
  const timeline = buildTimeline(events);
  const totalFrames = Math.max(1, Math.ceil((durationMs * VIDEO.fps) / 1000));
  let nextOp = 0;
  let pixels: Buffer | null = null;

  for (let k = 0; k < totalFrames; k++) {
    const timeMs = (k * 1000) / VIDEO.fps;
    let changed = pixels === null;
    // Bu kareye kadar gerçekleşen çizim adımlarını (çizgiler ve silmeler) çizim katmanına işle.
    while (nextOp < timeline.length && (timeline[nextOp] as (typeof timeline)[number]).t <= timeMs) {
      painter.apply(timeline[nextOp] as (typeof timeline)[number]);
      nextOp++;
      changed = true;
    }
    if (changed) {
      frameCtx.globalCompositeOperation = 'source-over';
      frameCtx.drawImage(base, 0, 0);
      frameCtx.drawImage(ink, 0, 0);
      const data = frameCtx.getImageData(0, 0, width, height).data;
      pixels = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    }
    await write(ffmpeg.stdin, pixels as Buffer);
  }

  ffmpeg.stdin.end();
  await finished;
}
