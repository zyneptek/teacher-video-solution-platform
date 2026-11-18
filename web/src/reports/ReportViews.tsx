// Hata bildirimlerinin gösterimi (yönetici ve öğretmen ortak): tür, açıklama, gönderen, işaretli görsel ve ek.
import { ERROR_REPORT_TYPES, type ErrorReportInfo } from '@app/shared';
import { MarkedImage } from './MarkedImage';

export const typeLabel = (type: string) => ERROR_REPORT_TYPES.find((t) => t.value === type)?.label ?? type;

export function ReportCard({ report, imageUrl, showQuestion }: { report: ErrorReportInfo; imageUrl?: string; showQuestion?: boolean }) {
  return (
    <div className="report" data-testid="report-card">
      <div className="row" style={{ marginBottom: 4 }}>
        <div>
          <span className="badge">{typeLabel(report.type)}</span>{' '}
          {showQuestion && <a href={`#/sorular/${report.questionId}`}><strong>{report.questionLabel}</strong></a>}
        </div>
        <span className="muted small">{new Date(report.createdAt).toLocaleString('tr-TR')}</span>
      </div>
      <div className="muted small">Gönderen: <strong data-testid="reporter">{report.reporterName}</strong></div>
      {report.description && <p style={{ margin: '6px 0' }} data-testid="report-description">{report.description}</p>}
      <div className="report-media">
        {report.marker && imageUrl && <MarkedImage src={imageUrl} alt="İşaretli soru görseli" marker={report.marker} small />}
        {report.attachment?.type === 'image' && <a href={report.attachment.url} target="_blank" rel="noreferrer"><img src={report.attachment.url} alt="Ek ekran görüntüsü" className="attach" data-testid="attachment-image" /></a>}
        {report.attachment?.type === 'video' && <video src={report.attachment.url} controls className="attach" data-testid="attachment-video" />}
      </div>
    </div>
  );
}
