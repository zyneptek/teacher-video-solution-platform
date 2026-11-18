// Sunucu istemcisi: jetonları tutar, her isteğe Authorization başlığı ekler, 401'de bir kez yeniler,
// yenilenemezse oturumu kapatır (silinen öğretmenin oturumu böyle sonlanır).
// Expo SDK 58'in fetch'i RN'nin eski { uri } dosya biçimini desteklemez; `expo/fetch` + expo-file-system `File` kullanılır.
import { fetch } from 'expo/fetch';
import type { LoginResponse } from '@app/shared';
import { API_URL } from './config';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type Tokens = { accessToken: string; refreshToken: string };

let tokens: Tokens | null = null;
let onSessionLost: (() => void) | null = null;
let onTokens: ((login: LoginResponse) => void) | null = null;

export function setTokens(next: Tokens | null) {
  tokens = next;
}
export function setSessionHandlers(lost: (() => void) | null, refreshed: ((login: LoginResponse) => void) | null) {
  onSessionLost = lost;
  onTokens = refreshed;
}

// Sunucunun verdiği göreli adresleri (görsel, video) mutlak adrese çevirir.
export const abs = (path: string) => (path.startsWith('http') ? path : `${API_URL}${path}`);

async function send(path: string, init: { method?: string; body?: unknown; form?: FormData }) {
  const headers: Record<string, string> = {};
  if (!init.form) headers['content-type'] = 'application/json';
  if (tokens) headers.authorization = `Bearer ${tokens.accessToken}`;
  try {
    return await fetch(abs(path), {
      method: init.method ?? 'GET',
      headers,
      body: init.form ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
    });
  } catch {
    throw new ApiError('Sunucuya ulaşılamadı. İnternet bağlantınızı ve sunucu adresini kontrol edin.', 0);
  }
}

async function parse<T>(response: { ok: boolean; status: number; json: () => Promise<unknown> }): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new ApiError(body?.error ?? `Sunucu hatası (${response.status})`, response.status);
  return body as T;
}

async function refresh(): Promise<boolean> {
  if (!tokens) return false;
  try {
    const response = await fetch(abs('/api/auth/refresh'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: tokens.refreshToken }) });
    const result = await parse<LoginResponse>(response);
    tokens = { accessToken: result.accessToken, refreshToken: result.refreshToken };
    onTokens?.(result);
    return true;
  } catch {
    return false;
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  let response = await send(path, init);
  if (response.status === 401 && tokens && (await refresh())) response = await send(path, init);
  if (response.status === 401 && tokens) {
    tokens = null;
    onSessionLost?.();
  }
  return parse<T>(response);
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  let response;
  try {
    response = await fetch(abs('/api/auth/login'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, role: 'teacher' }) });
  } catch {
    throw new ApiError('Sunucuya ulaşılamadı. İnternet bağlantınızı ve sunucu adresini kontrol edin.', 0);
  }
  return parse<LoginResponse>(response);
}
