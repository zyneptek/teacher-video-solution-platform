// GEÇİCİ geliştirme uç noktaları: kimlik doğrulaması ve atama kontrolü YOKTUR.
// Stüdyonun (kayıt → sunucuda MP4 → izle/kaydet) uçtan uca denenmesi içindir; yalnızca geliştirme
// ortamında açılır. Atamaya bağlı gerçek yükleme uç noktası yazılınca kaldırılacaktır.
//   POST /render      görsel + ses + çizim günlüğü + süre → MP4 üretir, { id, renderMs, sizeBytes } döner
//   GET  /video/:id   üretilen MP4'ü sunar (tarayıcı/telefon oynatıcıları için aralık isteği destekli)
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { VIDEO } from '@app/shared';
import { parseDrawingEvents } from '../render/parseDrawingEvents.js';
import { renderVideo } from '../render/renderVideo.js';

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const STORE_DIR = path.join(tmpdir(), 'dev-render-store');
const MAX_AGE_MS = 60 * 60 * 1000; // üretilen videolar bir saat sonra silinir
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 12 } });

function parseJson(text: unknown): unknown {
  if (typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Eski videoları siler (her yüklemede çalışır).
async function sweepOldVideos(): Promise<void> {
  try {
    const now = Date.now();
    for (const name of await readdir(STORE_DIR)) {
      const file = path.join(STORE_DIR, name);
      if (now - (await stat(file)).mtimeMs > MAX_AGE_MS) await rm(file, { force: true });
    }
  } catch {
    // klasör henüz yoksa yapılacak bir şey yok
  }
}

export const devRenderRouter = Router();

devRenderRouter.post(
  '/render',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
    { name: 'camera', maxCount: 10 },
  ]),
  async (req, res) => {
    // Çok parçalı (multipart) olmayan bir istekte gövde tanımsız olabilir.
    const body = (req.body ?? {}) as Record<string, unknown>;
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const image = files?.image?.[0];
    const audio = files?.audio?.[0];
    const cameraClips = files?.camera ?? []; // isteğe bağlı; kayıt sırasıyla klipler
    const events = parseDrawingEvents(parseJson(body.events));
    const durationMs = Number(body.durationMs);
    const maxMs = VIDEO.maxSeconds * 1000 + 2000; // süre sınırına küçük bir pay

    if (!image || !audio || !events || !Number.isFinite(durationMs) || durationMs <= 0 || durationMs > maxMs) {
      res.status(400).json({ error: 'Geçersiz istek: görsel, ses, çizim günlüğü ve süre gerekli.' });
      return;
    }

    let workDir: string | null = null;
    try {
      await mkdir(STORE_DIR, { recursive: true });
      await sweepOldVideos();
      workDir = await mkdtemp(path.join(tmpdir(), 'render-'));
      const audioPath = path.join(workDir, 'audio.bin');
      await writeFile(audioPath, audio.buffer);
      const cameraPaths: string[] = [];
      for (const [i, clip] of cameraClips.entries()) {
        const clipPath = path.join(workDir, `camera${i}.bin`);
        await writeFile(clipPath, clip.buffer);
        cameraPaths.push(clipPath);
      }

      const id = randomUUID();
      const outputPath = path.join(STORE_DIR, `${id}.mp4`);
      const started = Date.now();
      await renderVideo({ image: image.buffer, events, durationMs, audioPath, cameraPaths, outputPath });
      const renderMs = Date.now() - started;
      const { size } = await stat(outputPath);
      res.json({ id, renderMs, sizeBytes: size });
    } catch (err) {
      console.error('Video üretilemedi:', err);
      res.status(500).json({ error: 'Video üretilemedi.' });
    } finally {
      if (workDir) await rm(workDir, { recursive: true, force: true });
    }
  },
);

devRenderRouter.get('/video/:id', (req, res) => {
  const id = req.params.id;
  if (!ID_PATTERN.test(id)) {
    res.status(400).json({ error: 'Geçersiz video kimliği.' });
    return;
  }
  res.type('video/mp4');
  res.sendFile(path.join(STORE_DIR, `${id}.mp4`), (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Video bulunamadı.' });
  });
});
