// Ortak giriş ekranı: "Yönetici girişi" ve "Öğretmen girişi" sekmeleri.
import { useState, type FormEvent } from 'react';
import type { Role } from '@app/shared';
import { useSession } from './session';

const TABS: { role: Role; label: string }[] = [
  { role: 'admin', label: 'Yönetici girişi' },
  { role: 'teacher', label: 'Öğretmen girişi' },
];

export function LoginPage() {
  const { login, sessionEnded } = useSession();
  const [role, setRole] = useState<Role>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(role, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş yapılamadı.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
    <main className="login">
      <h1>Video Çözüm Platformu</h1>
      <div className="tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.role}
            type="button"
            role="tab"
            aria-selected={role === tab.role}
            className={role === tab.role ? 'tab active' : 'tab'}
            onClick={() => {
              setRole(tab.role);
              setError(null);
            }}
            data-testid={`tab-${tab.role}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <form onSubmit={(event) => void submit(event)} className="card">
        {sessionEnded && <p className="notice">Oturumunuz sonlandırıldı. Lütfen tekrar giriş yapın.</p>}
        <label>
          E-posta
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required data-testid="login-email" />
        </label>
        <label>
          Şifre
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required data-testid="login-password" />
        </label>
        {error && (
          <p role="alert" className="error" data-testid="login-error">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={busy} data-testid="login-submit">
          {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
    </main>
    </div>
  );
}
