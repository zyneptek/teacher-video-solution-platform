// Ortak uygulama düzeni: sol menü + sayfa alanı. Yönetici ve öğretmen aynı düzeni kullanır.
// Sayfa, adres çubuğundaki #/sayfa/parametre/alt kısmından seçilir (yenilemede ve geri düğmesinde aynı sayfada
// kalınır; ek yönlendirme kütüphanesi gerekmez).
import { useEffect, useState, type ReactNode } from 'react';

export type Route = { path: string; param?: string; sub?: string };
export type Page = { path: string; label: string; badge?: number; render: (route: Route) => ReactNode };

function currentRoute(pages: Page[]): Route {
  const [, first = '', param, sub] = window.location.hash.replace(/^#/, '').split('/');
  const path = `/${first}`;
  return pages.some((p) => p.path === path) ? { path, param, sub } : { path: '/' };
}

export function AppShell({ pages, userName, roleLabel, onLogout }: { pages: Page[]; userName: string; roleLabel: string; onLogout: () => void }) {
  const [route, setRoute] = useState(() => currentRoute(pages));
  useEffect(() => {
    const onChange = () => setRoute(currentRoute(pages));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, [pages]);
  const page = pages.find((p) => p.path === route.path) ?? (pages[0] as Page);

  return (
    <div className="admin">
      <aside className="sidebar">
        <div className="brand">Video Çözüm<br />Platformu</div>
        <nav>
          {pages.map((p) => (
            <a key={p.path} href={`#${p.path}`} className={p.path === route.path ? 'nav active' : 'nav'} data-testid={`nav-${p.path.replace('/', '') || 'panel'}`}>
              {p.label}
              {p.badge ? <span className="nav-badge" data-testid={`badge-${p.path.replace('/', '')}`}>{p.badge}</span> : null}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="who" data-testid="whoami">
            {userName}
            <small>{roleLabel}</small>
          </div>
          <button type="button" className="ghost" onClick={onLogout} data-testid="logout">
            Çıkış
          </button>
        </div>
      </aside>
      <main className="page">{page.render(route)}</main>
    </div>
  );
}
