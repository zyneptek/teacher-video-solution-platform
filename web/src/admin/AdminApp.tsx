// Yönetici arayüzü: sol menü + sayfa alanı. Sayfa, adres çubuğundaki #/... kısmından seçilir
// (yenilemede ve geri düğmesinde aynı sayfada kalınır; ek yönlendirme kütüphanesi gerekmez).
import { useEffect, useState, type ReactNode } from 'react';
import type { UserInfo } from '@app/shared';
import { AssignmentsPage } from './AssignmentsPage';
import { DashboardPage } from './DashboardPage';
import { OutcomesPage } from './OutcomesPage';
import { PlaceholderPage } from './PlaceholderPage';
import { QuestionsPage } from './QuestionsPage';
import { TeachersPage } from './TeachersPage';

// param: adresteki ikinci parça (örneğin #/sorular/<id> için soru kimliği)
type Page = { path: string; label: string; render: (param?: string) => ReactNode };

// Sıra, görevdeki yönetici akışını izler: öğretmenler → sorular ve kazanımlar → atama → onay → hata bildirimleri.
const PAGES: Page[] = [
  { path: '/', label: 'Panel', render: () => <DashboardPage /> },
  { path: '/ogretmenler', label: 'Öğretmenler', render: () => <TeachersPage /> },
  { path: '/sorular', label: 'Sorular', render: (id) => <QuestionsPage id={id} /> },
  { path: '/kazanimlar', label: 'Kazanımlar', render: () => <OutcomesPage /> },
  { path: '/atamalar', label: 'Atamalar', render: () => <AssignmentsPage /> },
  {
    path: '/onay-kuyrugu',
    label: 'Onay kuyruğu',
    render: () => <PlaceholderPage title="Onay kuyruğu" description="Onaya gönderilen videolar: tarayıcı içinde izleme, onaylama veya notla geri gönderme." />,
  },
  {
    path: '/hata-bildirimleri',
    label: 'Hata bildirimleri',
    render: () => <PlaceholderPage title="Hata bildirimleri" description="Öğretmenlerin gönderdiği hata bildirimleri: tür, açıklama, ek ve gönderen öğretmen; ilgili soruyla birlikte görünecek." />,
  },
];

// Adres #/sayfa veya #/sayfa/parametre biçimindedir.
function currentRoute(): { path: string; param?: string } {
  const [, first = '', param] = window.location.hash.replace(/^#/, '').split('/');
  const path = `/${first}`;
  return PAGES.some((p) => p.path === path) ? { path, param } : { path: '/' };
}

export function AdminApp({ user, onLogout }: { user: UserInfo; onLogout: () => void }) {
  const [route, setRoute] = useState(currentRoute);
  const path = route.path;
  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const page = PAGES.find((p) => p.path === path) ?? (PAGES[0] as Page);

  return (
    <div className="admin">
      <aside className="sidebar">
        <div className="brand">Video Çözüm<br />Platformu</div>
        <nav>
          {PAGES.map((p) => (
            <a key={p.path} href={`#${p.path}`} className={p.path === path ? 'nav active' : 'nav'} data-testid={`nav-${p.path.replace('/', '') || 'panel'}`}>
              {p.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="who" data-testid="whoami">
            {user.firstName} {user.lastName}
            <small>Yönetici</small>
          </div>
          <button type="button" className="ghost" onClick={onLogout} data-testid="logout">
            Çıkış
          </button>
        </div>
      </aside>
      <main className="page">{page.render(route.param)}</main>
    </div>
  );
}
