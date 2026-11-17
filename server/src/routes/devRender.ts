// GEÇİCİ geliştirme uç noktası: kimlik doğrulaması ve atama kontrolü YOKTUR.
// Stüdyonun (kayıt → sunucuda MP4) uçtan uca denenmesi içindir; yalnızca geliştirme ortamında
// açılır. Atamaya bağlı gerçek yükleme uç noktası yazılınca kaldırılacaktır.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { VIDEO } from '@app/shared';
import { parseDrawingEvents } from '../render/parseDrawingEvents.js';
import { renderVideo } from '../render/renderVideo.js';

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 2 } });

function parseJson(text: unknown): unknown {
  if (typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const devRenderRouter = Router();

devRenderRouter.post(
  '/render',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
  ]),
  async (req, res) => {
    // Çok parçalı (multipart) olmayan bir istekte gövde tanımsız olabilir.
    const body = (req.body ?? {}) as Record<string, unknown>;
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const image = files?.image?.[0];
    const audio = files?.audio?.[0];
    const events = parseDrawingEvents(parseJson(body.events));
    const durationMs = Number(body.durationMs);
    const maxMs = VIDEO.maxSeconds * 1000 + 2000; // süre sınırına küçük bir pay

    if (!image || !audio || !events || !Number.isFinite(durationMs) || durationMs <= 0 || durationMs > maxMs) {
      res.status(400).json({ error: 'Geçersiz istek: görsel, ses, çizim günlüğü ve süre gerekli.' });
      return;
    }

    let workDir: string | null = null;
    try {
      workDir = await mkdtemp(path.join(tmpdir(), 'render-'));
      const dir = workDir;
      const audioPath = path.join(dir, 'audio.bin');
      const outputPath = path.join(dir, 'out.mp4');
      await writeFile(audioPath, audio.buffer);

      const started = Date.now();
      await renderVideo({ image: image.buffer, events, durationMs, audioPath, outputPath });
      res.setHeader('X-Render-Ms', String(Date.now() - started));
      res.type('video/mp4');
      res.sendFile(outputPath, () => void rm(dir, { recursive: true, force: true }));
    } catch (err) {
      if (workDir) await rm(workDir, { recursive: true, force: true });
      console.error('Video üretilemedi:', err);
      res.status(500).json({ error: 'Video üretilemedi.' });
    }
  },
);
