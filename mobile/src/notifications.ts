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

  return { notifications, unread, refresh };
}
