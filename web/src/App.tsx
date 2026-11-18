import { AdminApp } from './admin/AdminApp';
import { LoginPage } from './auth/LoginPage';
import { SessionProvider, useSession } from './auth/session';
import StudioPage from './studio/StudioPage';

// Giriş yapılmamışsa giriş ekranı; yönetici ve öğretmen aynı uygulamada rolüne göre ekranlar görür.
function Shell() {
  const { user, logout } = useSession();
  if (!user) return <LoginPage />;
  if (user.role === 'admin') return <AdminApp user={user} onLogout={() => void logout()} />;

  // Geçici: öğretmen ekranları (dashboard, sorular) sonraki adımda; şimdilik stüdyo denemesi.
  return (
    <>
      <header className="topbar">
        <strong>Video Çözüm Platformu</strong>
        <span className="spacer" />
        <span data-testid="whoami">
          {user.firstName} {user.lastName} · Öğretmen ({user.branch})
        </span>
        <button type="button" onClick={() => void logout()} data-testid="logout">
          Çıkış
        </button>
      </header>
      <div className="content">
        <StudioPage />
      </div>
    </>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
