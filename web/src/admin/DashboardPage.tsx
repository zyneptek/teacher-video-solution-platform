// Yönetici ana sayfası: genel sayılar ve atama durumlarının özeti.
import { useEffect, useState } from 'react';
import type { DashboardStats } from '@app/shared';
import { api } from '../auth/session';

function Stat({ label, value, tone, href, testId }: { label: string; value: number; tone?: 'brand' | 'warn'; href?: string; testId?: string }) {
  const body = (
    <>
      <div className={`stat-value ${tone ? 'tone-' + tone : ''}`} data-testid={testId}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </>
  );
  return href ? (
    <a className="stat" href={href}>
      {body}
    </a>
  ) : (
    <div className="stat">{body}</div>
  );
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<DashboardStats>('/api/admin/dashboard')
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Panel yüklenemedi.'));
  }, []);

  if (error) return <p role="alert" className="error">{error}</p>;
  if (!stats) return <p>Yükleniyor…</p>;

  return (
    <div>
      <h2>Panel</h2>
      <div className="stats">
        <Stat label="Öğretmen" value={stats.teachers} href="#/ogretmenler" testId="stat-teachers" />
        <Stat label="Soru" value={stats.questions} href="#/sorular" testId="stat-questions" />
        <Stat label="Kazanım" value={stats.outcomes} href="#/kazanimlar" />
        <Stat label="Hata bildirimi" value={stats.errorReports} href="#/hata-bildirimleri" />
      </div>

      <h3>Atama durumları</h3>
      <div className="stats">
        <Stat label="Atandı" value={stats.assignments.assigned} />
        <Stat label="Onaya gönderildi" value={stats.assignments.submitted} tone="brand" href="#/onay-kuyrugu" />
        <Stat label="Onaylandı" value={stats.assignments.approved} />
        <Stat label="Geri gönderildi" value={stats.assignments.returned} tone="warn" />
      </div>
    </div>
  );
}
