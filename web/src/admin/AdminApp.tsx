// Yönetici arayüzü: sayfa listesi; düzeni AppShell sağlar.
import type { UserInfo } from '@app/shared';
import { AppShell, type Page } from '../layout/AppShell';
import { AssignmentsPage } from './AssignmentsPage';
import { DashboardPage } from './DashboardPage';
import { OutcomesPage } from './OutcomesPage';
import { PlaceholderPage } from './PlaceholderPage';
import { QuestionsPage } from './QuestionsPage';
import { TeachersPage } from './TeachersPage';

// Sıra, görevdeki yönetici akışını izler: öğretmenler → sorular ve kazanımlar → atama → onay → hata bildirimleri.
const PAGES: Page[] = [
  { path: '/', label: 'Panel', render: () => <DashboardPage /> },
  { path: '/ogretmenler', label: 'Öğretmenler', render: () => <TeachersPage /> },
  { path: '/sorular', label: 'Sorular', render: (r) => <QuestionsPage id={r.param} /> },
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
export function AdminApp({ user, onLogout }: { user: UserInfo; onLogout: () => void }) {
  return <AppShell pages={PAGES} userName={`${user.firstName} ${user.lastName}`} roleLabel="Yönetici" onLogout={onLogout} />;
}
