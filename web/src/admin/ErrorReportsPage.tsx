// Yönetici: tüm hata bildirimleri (gönderen öğretmen, tür, açıklama, işaret ve ek ile).
import { useEffect, useState } from 'react';
import { ERROR_REPORT_TYPES, type ErrorReportInfo, type QuestionInfo } from '@app/shared';
import { api } from '../auth/session';
import { ReportCard } from '../reports/ReportViews';

export function ErrorReportsPage() {
  const [reports, setReports] = useState<ErrorReportInfo[] | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [type, setType] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ reports: ErrorReportInfo[] }>('/api/admin/error-reports')
      .then((r) => setReports(r.reports))
      .catch((err) => setError(err instanceof Error ? err.message : 'Hata bildirimleri yüklenemedi.'));
    api<{ questions: QuestionInfo[] }>('/api/admin/questions')
      .then((r) => setImages(Object.fromEntries(r.questions.map((q) => [q.id, q.imageUrl ?? '']))))
      .catch(() => undefined);
  }, []);

  const visible = (reports ?? []).filter((r) => !type || r.type === type);
  return (
    <div>
      <h2>Hata bildirimleri</h2>
      <div className="filters">
        <select value={type} onChange={(e) => setType(e.target.value)} data-testid="report-type-filter">
          <option value="">Tüm türler</option>
          {ERROR_REPORT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      {!reports && !error && <p>Yükleniyor…</p>}
      {reports && visible.length === 0 && <div className="empty" data-testid="reports-empty">Hata bildirimi yok.</div>}
      <div className="t-list">
        {visible.map((r) => (
          <ReportCard key={r.id} report={r} imageUrl={images[r.questionId]} showQuestion />
        ))}
      </div>
    </div>
  );
}
