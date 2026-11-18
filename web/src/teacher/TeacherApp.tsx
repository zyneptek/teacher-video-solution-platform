// Öğretmen arayüzü: Panel ve Sorularım. Bildirimler sağ üstteki zil düğmesinden açılır.
import type { UserInfo } from '@app/shared';
import { AppShell, type Page } from '../layout/AppShell';
import { NotificationBell } from '../notifications/NotificationBell';
import { useNotifications } from '../notifications/useNotifications';
import { MyQuestionsPage, TeacherDashboard } from './TeacherPages';

export function TeacherApp({ user, onLogout }: { user: UserInfo; onLogout: () => void }) {
  const { notifications, unread, refresh } = useNotifications();
  const notifs = { notifications, refresh: () => void refresh() };

  const pages: Page[] = [
    { path: '/', label: 'Panel', render: () => <TeacherDashboard /> },
    { path: '/sorularim', label: 'Sorularım', render: (r) => <MyQuestionsPage id={r.param} sub={r.sub} /> },
  ];
  return <AppShell pages={pages} userName={`${user.firstName} ${user.lastName}`} roleLabel={`Öğretmen · ${user.branch ?? ''}`} onLogout={onLogout} topRight={<NotificationBell notifications={notifications} unread={unread} refresh={notifs.refresh} />} />;
}
