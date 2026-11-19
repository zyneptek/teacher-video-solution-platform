// Öğretmenin bildirimleri: açılışta ve her 30 sn'de bir sunucudan okunur.
import { useCallback, useEffect, useState } from 'react';
import type { NotificationInfo } from '@app/shared';
import { api } from './api';

const POLL_MS = 30_000;

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationInfo[] | null>(null);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ notifications: NotificationInfo[]; unread: number }>('/api/notifications');
      setNotifications(r.notifications);
      setUnread(r.unread);
    } catch {
      // ağ hatasında mevcut liste kalır
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Bildirime dokununca okundu yapılır; hepsini okundu yapma ana sayfa ve Bildirimler sayfasında ortaktır.
  const markRead = useCallback(async (id: string) => {
    await api(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => undefined);
    void refresh();
  }, [refresh]);
  const readAll = useCallback(async () => {
    await api('/api/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    void refresh();
  }, [refresh]);

  return { notifications, unread, refresh, markRead, readAll };
}
