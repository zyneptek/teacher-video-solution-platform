// Oturum: jetonlar tarayıcıda saklanır, her istek Authorization başlığıyla gider.
// Erişim jetonu süresi dolarsa (401) bir kez yenilenir; yenilenemezse oturum kapanır.
// Hesap silinirse sunucu 401 döner; ayrıca kısa aralıklarla /me sorgulanır, böylece açık oturum otomatik kapanır.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginResponse, Role, UserInfo } from '@app/shared';

const STORAGE_KEY = 'session';
const POLL_MS = 30_000;

type Tokens = { accessToken: string; refreshToken: string };
let tokens: Tokens | null = null;
let onSessionLost: (() => void) | null = null;

function loadStored(): { tokens: Tokens; user: UserInfo } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { tokens: Tokens; user: UserInfo }) : null;
  } catch {
    return null;
  }
}

function store(next: { tokens: Tokens; user: UserInfo } | null) {
  tokens = next?.tokens ?? null;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // tarayıcı depolamayı engelliyorsa oturum yalnızca bu sayfa açıkken sürer
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new ApiError(body?.error ?? `Sunucu hatası (${response.status})`, response.status);
  return body as T;
}

async function refreshTokens(): Promise<boolean> {
  if (!tokens) return false;
  try {
    const result = await parse<LoginResponse>(
      await fetch('/api/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: tokens.refreshToken }) }),
    );
    store({ tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken }, user: result.user });
    return true;
  } catch {
    return false;
  }
}

// Kimlik doğrulamalı JSON isteği. 401'de bir kez yenilemeyi dener, olmazsa oturumu kapatır.
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  // FormData (dosya yükleme) olduğu gibi gönderilir; tarayıcı içerik türünü (sınır değeriyle) kendisi ayarlar.
  const isForm = init.body instanceof FormData;
  const send = () =>
    fetch(path, {
      method: init.method ?? 'GET',
      headers: { ...(isForm ? {} : { 'content-type': 'application/json' }), ...(tokens ? { authorization: `Bearer ${tokens.accessToken}` } : {}) },
      body: init.body === undefined ? undefined : isForm ? (init.body as FormData) : JSON.stringify(init.body),
    });
  let response = await send();
  if (response.status === 401 && tokens && (await refreshTokens())) response = await send();
  if (response.status === 401 && tokens) {
    store(null);
    onSessionLost?.();
  }
  return parse<T>(response);
}

type Session = {
  user: UserInfo | null;
  login: (role: Role, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  sessionEnded: boolean;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(() => {
    const stored = loadStored();
    if (stored) tokens = stored.tokens;
    return stored?.user ?? null;
  });
  const [sessionEnded, setSessionEnded] = useState(false);

  useEffect(() => {
    onSessionLost = () => {
      setUser(null);
      setSessionEnded(true);
    };
    return () => {
      onSessionLost = null;
    };
  }, []);

  // Oturum açıkken hesabın hâlâ geçerli olduğu kontrol edilir (silinen öğretmen kısa sürede çıkış yapılır).
  useEffect(() => {
    if (!user) return;
    const check = () => void api('/api/auth/me').catch(() => undefined); // 401 olursa api() oturumu kapatır
    check();
    const id = window.setInterval(check, POLL_MS);
    return () => window.clearInterval(id);
  }, [user]);

  const login = useCallback(async (role: Role, email: string, password: string) => {
    const result = await parse<LoginResponse>(
      await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, role }) }),
    );
    store({ tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken }, user: result.user });
    setSessionEnded(false);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    store(null);
    setUser(null);
    setSessionEnded(false);
  }, []);

  const value = useMemo(() => ({ user, login, logout, sessionEnded }), [user, login, logout, sessionEnded]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider eksik');
  return value;
}
