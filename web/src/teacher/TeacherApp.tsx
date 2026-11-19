// Öğretmen arayüzü: Panel (sayılar, bildirimler, sorular) ve Sorularım. Bildirimler dashboard'da listelenir.
import type { UserInfo } from '@app/shared';
import { AppShell, type Page } from '../layout/AppShell';
import { useNotifications } from '../notifications/useNotifications';
import { MyQuestionsPage, NotificationsPage, StatusListPage, TeacherDashboard } from './TeacherPages';

export function TeacherApp({ user, onLogout }: { user: UserInfo; onLogout: () => void }) {
  const { notifications, unread, refresh } = useNotifications();
  const notifs = { notifications, refresh: () => void refresh() };

  const pages: Page[] = [
    { path: '/', label: 'Panel', render: () => <TeacherDashboard notifications={notifications} unread={unread} refresh={notifs.refresh} /> },
    { path: '/bildirimler', label: 'Bildirimler', hidden: true, render: () => <NotificationsPage notifications={notifications} unread={unread} refresh={notifs.refresh} /> },
    { path: '/durum', label: 'Durum', hidden: true, render: (r) => <StatusListPage status={r.param} /> },
    { path: '/sorularim', label: 'Sorularım', render: (r) => <MyQuestionsPage id={r.param} sub={r.sub} /> },
  ];
  return <AppShell pages={pages} userName={`${user.firstName} ${user.lastName}`} roleLabel={`Öğretmen · ${user.branch ?? ''}`} onLogout={onLogout} />;
}
