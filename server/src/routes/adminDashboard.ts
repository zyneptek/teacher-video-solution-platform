// Yönetici paneli özeti: toplam sayılar ve atama durumlarına göre dağılım.
import { Router } from 'express';
import type { AssignmentStatus, DashboardStats } from '@app/shared';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

export const adminDashboardRouter = Router();
adminDashboardRouter.use(requireAuth('admin'));

adminDashboardRouter.get('/', async (_req, res) => {
  try {
    const [counts, byStatus] = await Promise.all([
      pool.query<{ teachers: string; questions: string; outcomes: string; reports: string }>(
        `select
           (select count(*) from profiles where role = 'teacher' and deleted_at is null) as teachers,
           (select count(*) from questions) as questions,
           (select count(*) from learning_outcomes) as outcomes,
           (select count(*) from error_reports) as reports`,
      ),
      pool.query<{ status: AssignmentStatus; n: string }>('select status, count(*) as n from assignments group by status'),
    ]);
    const row = counts.rows[0];
    const assignments: Record<AssignmentStatus, number> = { assigned: 0, submitted: 0, approved: 0, returned: 0 };
    for (const r of byStatus.rows) assignments[r.status] = Number(r.n);
    const stats: DashboardStats = {
      teachers: Number(row?.teachers ?? 0),
      questions: Number(row?.questions ?? 0),
      outcomes: Number(row?.outcomes ?? 0),
      assignments,
      errorReports: Number(row?.reports ?? 0),
    };
    res.json(stats);
  } catch (err) {
    console.error('Panel özeti alınamadı:', err);
    res.status(500).json({ error: 'Panel özeti alınamadı.' });
  }
});
