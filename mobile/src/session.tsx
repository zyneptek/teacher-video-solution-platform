// Oturum: jetonlar güvenli depoda (SecureStore) tutulur. Açılışta kayıtlı oturum okunur; açıkken 30 sn'de bir
// hesabın hâlâ geçerli olup olmadığı sorulur (silinen öğretmenin oturumu otomatik kapanır).
// Giriş yapınca push jetonu sunucuya kaydedilir.
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginResponse, Role, UserInfo } from '@app/shared';
import { api, login as apiLogin, setSessionHandlers, setTokens } from './api';
import { registerForPush } from './push';

const KEY = 'session';
const POLL_MS = 30_000;

type Session = {
  ready: boolean;
  user: UserInfo | null;
  login: (email: string, password: string, role: Role) => Promise<void>;
  logout: () => Promise<void>;
  sessionEnded: boolean;
};

const Ctx = createContext<Session | null>(null);

async function store(login: LoginResponse | null) {
  try {
    if (login) await SecureStore.setItemAsync(KEY, JSON.stringify(login));
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // güvenli depo kullanılamazsa oturum yalnızca uygulama açıkken sürer
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);

  useEffect(() => {
    setSessionHandlers(
      () => {
        void store(null);
        setUser(null);
        setSessionEnded(true);
      },
      (refreshed) => void store(refreshed),
    );
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(KEY);
        if (raw) {
          const saved = JSON.parse(raw) as LoginResponse;
          setTokens({ accessToken: saved.accessToken, refreshToken: saved.refreshToken });
          setUser(saved.user);
        }
      } catch {
        // kayıtlı oturum okunamazsa giriş ekranı gösterilir
      }
      setReady(true);
    })();
    return () => setSessionHandlers(null, null);
  }, []);

  useEffect(() => {
    if (!user) return;
    const check = () => void api('/api/auth/me').catch(() => undefined); // 401'de api() oturumu kapatır
    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [user]);

  const login = useCallback(async (email: string, password: string, role: Role) => {
    const result = await apiLogin(email.trim(), password, role);
    setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    await store(result);
    setSessionEnded(false);
    setUser(result.user);
    if (result.user.role === 'teacher') void registerForPush(); // push yalnızca öğretmenlere gider; başarısız olursa uygulama etkilenmez
  }, []);

  const logout = useCallback(async () => {
    setTokens(null);
    await store(null);
    setUser(null);
    setSessionEnded(false);
  }, []);

  const value = useMemo(() => ({ ready, user, login, logout, sessionEnded }), [ready, user, login, logout, sessionEnded]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const value = useContext(Ctx);
  if (!value) throw new Error('SessionProvider eksik');
  return value;
}
