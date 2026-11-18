// Yüklenen çözüm verisini (ses, isteğe bağlı kamera klipleri, çizim günlüğü, süre) doğrular ve MP4'e çevirir.
// Hem öğretmenin kayıt yüklemesi hem geçici geliştirme uç noktası bu yardımcıyı kullanır.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { VIDEO } from '@app/shared';
import { parseDrawingEvents } from './parseDrawingEvents.js';
import { renderVideo } from './renderVideo.js';

export type UploadedFile = { buffer: Buffer };

export type RenderUploadInput = {
  image: Buffer;
  audio: UploadedFile | undefined;
  cameraClips: UploadedFile[];
  eventsText: unknown;
  durationText: unknown;
};

export class BadUploadError extends Error {}

function parseJson(text: unknown): unknown {
  if (typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Başarılıysa MP4 dosya yolunu ve süreyi döndürür; `cleanup` çağrılınca geçici dosyalar silinir.
export async function renderFromUpload(input: RenderUploadInput): Promise<{ mp4Path: string; durationMs: number; cleanup: () => Promise<void> }> {
  const events = parseDrawingEvents(parseJson(input.eventsText));
  const durationMs = Number(input.durationText);
  const maxMs = VIDEO.maxSeconds * 1000 + 2000;
  if (!input.audio || !events || !Number.isFinite(durationMs) || durationMs <= 0 || durationMs > maxMs) {
    throw new BadUploadError('Geçersiz istek: ses, çizim günlüğü ve süre gerekli.');
  }
  const workDir = await mkdtemp(path.join(tmpdir(), 'render-'));
  const cleanup = () => rm(workDir, { recursive: true, force: true });
  try {
    const audioPath = path.join(workDir, 'audio.bin');
    await writeFile(audioPath, input.audio.buffer);
    const cameraPaths: string[] = [];
    for (const [i, clip] of input.cameraClips.entries()) {
      const clipPath = path.join(workDir, `camera${i}.bin`);
      await writeFile(clipPath, clip.buffer);
      cameraPaths.push(clipPath);
    }
    const mp4Path = path.join(workDir, 'out.mp4');
    await renderVideo({ image: input.image, events, durationMs, audioPath, cameraPaths, outputPath: mp4Path });
    return { mp4Path, durationMs, cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  }
}
