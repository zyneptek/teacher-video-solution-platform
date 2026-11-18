// Öğretmen arayüzü: Panel, Sorularım, Bildirimler. Okunmamış bildirim sayısı menüde rozet olarak görünür.
import type { UserInfo } from '@app/shared';
import { AppShell, type Page } from '../layout/AppShell';
import { MyQuestionsPage, NotificationsPage, TeacherDashboard } from './TeacherPages';
import { useNotifications } from './useTeacherData';

export function TeacherApp({ user, onLogout }: { user: UserInfo; onLogout: () => void }) {
  const { notifications, unread, refresh } = useNotifications();
  const notifs = { notifications, refresh: () => void refresh() };

  const pages: Page[] = [
    { path: '/', label: 'Panel', render: () => <TeacherDashboard notifs={notifs} /> },
    { path: '/sorularim', label: 'Sorularım', render: (r) => <MyQuestionsPage id={r.param} sub={r.sub} /> },
    { path: '/bildirimler', label: 'Bildirimler', badge: unread, render: () => <NotificationsPage notifs={notifs} /> },
  ];
  return <AppShell pages={pages} userName={`${user.firstName} ${user.lastName}`} roleLabel={`Öğretmen · ${user.branch ?? ''}`} onLogout={onLogout} />;
}
