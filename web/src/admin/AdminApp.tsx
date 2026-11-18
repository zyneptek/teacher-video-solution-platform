// Yönetici arayüzü: sol menü + sayfa alanı. Sayfa, adres çubuğundaki #/... kısmından seçilir
// (yenilemede ve geri düğmesinde aynı sayfada kalınır; ek yönlendirme kütüphanesi gerekmez).
import { useEffect, useState, type ReactNode } from 'react';
import type { UserInfo } from '@app/shared';
import { DashboardPage } from './DashboardPage';
import { PlaceholderPage } from './PlaceholderPage';
import { TeachersPage } from './TeachersPage';

type Page = { path: string; label: string; render: () => ReactNode };

// Sıra, görevdeki yönetici akışını izler: öğretmenler → sorular ve kazanımlar → atama → onay → hata bildirimleri.
const PAGES: Page[] = [
  { path: '/', label: 'Panel', render: () => <DashboardPage /> },
  { path: '/ogretmenler', label: 'Öğretmenler', render: () => <TeachersPage /> },
  {
    path: '/sorular',
    label: 'Sorular',
    render: () => (
      <PlaceholderPage title="Sorular" description="Soru listesi: görsel, branş, cevap anahtarı ve kazanımlar. Cevap anahtarı ve kazanımlar (arama kutusuyla ekleme) buradan güncellenecek; soru bazında atama ve hata bildirimleri de görünecek." />
    ),
  },
  {
    path: '/kazanimlar',
    label: 'Kazanımlar',
    render: () => <PlaceholderPage title="Kazanımlar" description="Kazanım listesi: arama ve bir kazanımın açıklamasını/branşını güncelleme." />,
  },
  {
    path: '/atamalar',
    label: 'Atamalar',
    render: () => (
      <PlaceholderPage title="Atamalar" description="Soru-öğretmen atamaları ve durumları (Atandı, Onaya gönderildi, Onaylandı, Geri gönderildi). Aynı branştan başka bir öğretmene ek atama burada yapılacak." />
    ),
  },
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

function currentPath(): string {
  const hash = window.location.hash.replace(/^#/, '');
  return PAGES.some((p) => p.path === hash) ? hash : '/';
}

export function AdminApp({ user, onLogout }: { user: UserInfo; onLogout: () => void }) {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => setPath(currentPath());
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
      <main className="page">{page.render()}</main>
    </div>
  );
}
