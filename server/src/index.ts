import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { BRANCHES } from '@app/shared';
import { adminTeachersRouter } from './routes/adminTeachers.js';
import { authRouter } from './routes/auth.js';
import { devRenderRouter } from './routes/devRender.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, branches: BRANCHES });
});

app.use('/api/auth', authRouter);
app.use('/api/admin/teachers', adminTeachersRouter);

// Geçici: stüdyo denemesi için. Yalnızca geliştirme ortamında açılır.
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev', devRenderRouter);
}

// Yükleme hataları (örneğin dosya çok büyük) 400 döner.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: 'Yükleme geçersiz veya çok büyük.' });
    return;
  }
  next(err);
});

app.listen(port, () => {
  console.log(`Sunucu http://localhost:${port} adresinde çalışıyor`);
});
