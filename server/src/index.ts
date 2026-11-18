import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { BRANCHES } from '@app/shared';
import { adminAssignmentsRouter } from './routes/adminAssignments.js';
import { adminDashboardRouter } from './routes/adminDashboard.js';
import { adminOutcomesRouter, adminQuestionsRouter } from './routes/adminQuestions.js';
import { adminTeachersRouter } from './routes/adminTeachers.js';
import { authRouter } from './routes/auth.js';
import { questionImagesRouter, warmQuestionImages } from './questionImages.js';
import { teacherRouter } from './routes/teacher.js';
import { recordingVideosRouter } from './recordings.js';
import { adminErrorReportsRouter, errorAttachmentsRouter, teacherErrorReportsRouter } from './errorReports.js';
import { notificationsRouter } from './notifications.js';
import { pushTokensRouter } from './routes/pushTokens.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, branches: BRANCHES });
});

app.use('/api/auth', authRouter);
app.use('/api/admin/assignments', adminAssignmentsRouter);
app.use('/api/question-images', questionImagesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/teacher/assignments', teacherErrorReportsRouter);
app.use('/api/teacher', teacherRouter);
app.use('/api/admin/error-reports', adminErrorReportsRouter);
app.use('/api/error-attachments', errorAttachmentsRouter);
app.use('/api/recording-videos', recordingVideosRouter);
app.use('/api/push-token', pushTokensRouter);
app.use('/api/admin/dashboard', adminDashboardRouter);
app.use('/api/admin/questions', adminQuestionsRouter);
app.use('/api/admin/outcomes', adminOutcomesRouter);
app.use('/api/admin/teachers', adminTeachersRouter);

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
  void warmQuestionImages();
});
