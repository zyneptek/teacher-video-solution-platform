import { AdminApp } from './admin/AdminApp';
import { LoginPage } from './auth/LoginPage';
import { SessionProvider, useSession } from './auth/session';
import { TeacherApp } from './teacher/TeacherApp';

// Giriş yapılmamışsa giriş ekranı; yönetici ve öğretmen aynı uygulamada rolüne göre ekranlar görür.
function Shell() {
  const { user, logout } = useSession();
  if (!user) return <LoginPage />;
  if (user.role === 'admin') return <AdminApp user={user} onLogout={() => void logout()} />;

  return <TeacherApp user={user} onLogout={() => void logout()} />;
}

export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
