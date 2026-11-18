// Giriş yapan kullanıcının (öğretmen veya yönetici) bildirimleri: açılışta ve her 30 sn'de bir sunucudan okunur (yeni atama kısa sürede görünür).
import { useCallback, useEffect, useState } from 'react';
import type { NotificationInfo } from '@app/shared';
import { api } from '../auth/session';

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
      // ağ hatasında mevcut liste kalır; bir sonraki yenilemede tekrar denenir
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { notifications, unread, refresh };
}
