// Ortak uygulama düzeni: sol menü + sayfa alanı. Yönetici ve öğretmen aynı düzeni kullanır.
// Sayfa, adres çubuğundaki #/sayfa/parametre/alt kısmından seçilir (yenilemede ve geri düğmesinde aynı sayfada
// kalınır; ek yönlendirme kütüphanesi gerekmez).
import { useEffect, useState, type ReactNode } from 'react';

export type Route = { path: string; param?: string; sub?: string };
export type Page = { path: string; label: string; badge?: number; hidden?: boolean; render: (route: Route) => ReactNode };

function currentRoute(pages: Page[]): Route {
  const [, first = '', param, sub] = window.location.hash.replace(/^#/, '').split('/');
  const path = `/${first}`;
  return pages.some((p) => p.path === path) ? { path, param, sub } : { path: '/' };
}

const COLLAPSE_KEY = 'sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(COLLAPSE_KEY);
    if (stored !== null) return stored === '1';
  } catch {
    // depolama kapalıysa varsayılan kullanılır
  }
  return window.innerWidth < 800; // dar ekranda menü varsayılan olarak kapalı
}

export function AppShell({ pages, userName, roleLabel, onLogout }: { pages: Page[]; userName: string; roleLabel: string; onLogout: () => void }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  function toggleSidebar() {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1');
      } catch {
        // yok say
      }
      return !value;
    });
  }
  const [route, setRoute] = useState(() => currentRoute(pages));
  useEffect(() => {
    const onChange = () => setRoute(currentRoute(pages));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, [pages]);
  const page = pages.find((p) => p.path === route.path) ?? (pages[0] as Page);

  return (
    <div className={collapsed ? 'admin collapsed' : 'admin'}>
      <aside className="sidebar" data-testid="sidebar">
        <div className="brand">Video Çözüm<br />Platformu</div>
        <nav>
          {pages.filter((p) => !p.hidden).map((p) => (
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
      <div className="main-col">
        <header className="pagebar">
          <button type="button" className="icon-btn" onClick={toggleSidebar} aria-label={collapsed ? 'Menüyü aç' : 'Menüyü kapat'} aria-expanded={!collapsed} title={collapsed ? 'Menüyü aç' : 'Menüyü kapat'} data-testid="sidebar-toggle">
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>
          </button>
          <span className="spacer" />
        </header>
        <main className="page">{page.render(route)}</main>
      </div>
    </div>
  );
}
