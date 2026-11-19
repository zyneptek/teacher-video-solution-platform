// Yönetici arayüzü: sayfa listesi; düzeni AppShell sağlar.
import type { UserInfo } from '@app/shared';
import { AppShell, type Page } from '../layout/AppShell';
import { NotificationBell } from '../notifications/NotificationBell';
import { useNotifications } from '../notifications/useNotifications';
import { AssignmentsPage } from './AssignmentsPage';
import { DashboardPage } from './DashboardPage';
import { ErrorReportsPage } from './ErrorReportsPage';
import { OutcomesPage } from './OutcomesPage';
import { ReviewQueuePage } from './ReviewQueuePage';
import { QuestionsPage } from './QuestionsPage';
import { TeachersPage } from './TeachersPage';

// Sıra, görevdeki yönetici akışını izler: öğretmenler → sorular ve kazanımlar → atama → onay → hata bildirimleri.
const PAGES: Page[] = [
  { path: '/', label: 'Panel', render: () => <DashboardPage /> },
  { path: '/ogretmenler', label: 'Öğretmenler', render: () => <TeachersPage /> },
  { path: '/sorular', label: 'Sorular', render: (r) => <QuestionsPage id={r.param} /> },
  { path: '/kazanimlar', label: 'Kazanımlar', render: () => <OutcomesPage /> },
  { path: '/atamalar', label: 'Atamalar', render: (r) => <AssignmentsPage initialStatus={r.param} /> },
  { path: '/onay-kuyrugu', label: 'Onay kuyruğu', render: () => <ReviewQueuePage /> },
  { path: '/hata-bildirimleri', label: 'Hata bildirimleri', render: () => <ErrorReportsPage /> },
];

// Adres #/sayfa veya #/sayfa/parametre biçimindedir.
export function AdminApp({ user, onLogout }: { user: UserInfo; onLogout: () => void }) {
  const { notifications, unread, refresh } = useNotifications();
  return (
    <AppShell
      pages={PAGES}
      userName={`${user.firstName} ${user.lastName}`}
      roleLabel="Yönetici"
      onLogout={onLogout}
      topRight={<NotificationBell notifications={notifications} unread={unread} refresh={() => void refresh()} />}
    />
  );
}
