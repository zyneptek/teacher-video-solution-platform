import express from 'express';
import { BRANCHES } from '@app/shared';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.get('/health', (_req, res) => {
  res.json({ ok: true, branches: BRANCHES });
});

app.listen(port, () => {
  console.log(`Sunucu http://localhost:${port} adresinde çalışıyor`);
});
