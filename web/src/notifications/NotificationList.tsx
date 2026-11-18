// Bildirim listesi: okunmamışlar vurgulanır; tıklayınca bildirim okundu olur ve ilgili soruya gidilir.
import type { NotificationInfo } from '@app/shared';
import { api } from '../auth/session';

export function NotificationList({ notifications, onChanged, onOpened }: { notifications: NotificationInfo[]; onChanged: () => void; onOpened?: () => void }) {
  if (notifications.length === 0) return <div className="empty">Henüz bildiriminiz yok.</div>;

  async function open(n: NotificationInfo) {
    if (!n.readAt) await api(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => undefined);
    onChanged();
    onOpened?.();
    window.location.hash = n.href;
  }

  return (
    <ul className="notif-list" data-testid="notification-list">
      {notifications.map((n) => (
        <li key={n.id}>
          <button type="button" className={n.readAt ? 'notif' : 'notif unread'} onClick={() => void open(n)} data-testid={n.readAt ? 'notif-read' : 'notif-unread'}>
            <span>{n.text}</span>
            <small>{new Date(n.createdAt).toLocaleString('tr-TR')}</small>
          </button>
        </li>
      ))}
    </ul>
  );
}
