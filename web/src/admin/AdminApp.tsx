// Yönetici arayüzü: sayfa listesi; düzeni AppShell sağlar.
import type { UserInfo } from '@app/shared';
import { AppShell, type Page } from '../layout/AppShell';
import { NotificationsPage } from '../notifications/NotificationsSection';
import { useNotifications } from '../notifications/useNotifications';
import { DashboardPage } from './DashboardPage';
import { ErrorReportsPage } from './ErrorReportsPage';
import { OutcomesPage } from './OutcomesPage';
import { ReviewQueuePage } from './ReviewQueuePage';
import { QuestionsPage } from './QuestionsPage';
import { TeachersPage } from './TeachersPage';

// Sıra, görevdeki yönetici akışını izler: öğretmenler → sorular ve kazanımlar (atama soru sayfasındandır) → onay → hata bildirimleri.
// Bildirimler (video onaya gönderildi, hata bildirildi) öğretmendeki gibi panelde listelenir; tümü #/bildirimler sayfasındadır.
// Adres #/sayfa veya #/sayfa/parametre biçimindedir.
export function AdminApp({ user, onLogout }: { user: UserInfo; onLogout: () => void }) {
  const { notifications, unread, refresh } = useNotifications();
  const reload = () => void refresh();
  const pages: Page[] = [
    { path: '/', label: 'Panel', render: () => <DashboardPage notifications={notifications} unread={unread} refresh={reload} /> },
    { path: '/ogretmenler', label: 'Öğretmenler', render: () => <TeachersPage /> },
    { path: '/sorular', label: 'Sorular', render: (r) => <QuestionsPage id={r.param} /> },
    { path: '/kazanimlar', label: 'Kazanımlar', render: () => <OutcomesPage /> },
    { path: '/onay-kuyrugu', label: 'Onay bekleyenler', render: () => <ReviewQueuePage /> },
    { path: '/hata-bildirimleri', label: 'Hata bildirimleri', render: () => <ErrorReportsPage /> },
    { path: '/bildirimler', label: 'Bildirimler', hidden: true, render: () => <NotificationsPage notifications={notifications} unread={unread} refresh={reload} /> },
  ];
  return <AppShell pages={pages} userName={`${user.firstName} ${user.lastName}`} roleLabel="Yönetici" onLogout={onLogout} />;
}
