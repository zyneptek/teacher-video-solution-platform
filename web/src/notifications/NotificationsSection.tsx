// Panelde (öğretmen ve yönetici ortak) bildirimler: son 3 bildirim, okunmamış sayacı, "Tümünü okundu yap" ve
// daha fazlası varsa kalan sayıyı gösteren "Tümünü gör" bağlantısı. Tüm bildirimler #/bildirimler sayfasında listelenir.
import type { NotificationInfo } from '@app/shared';
import { api } from '../auth/session';
import { NotificationList } from './NotificationList';

const DASHBOARD_NOTIF_COUNT = 3;

type Props = { notifications: NotificationInfo[] | null; unread: number; refresh: () => void };

function readAll(refresh: () => void) {
  void api('/api/notifications/read-all', { method: 'POST' }).then(refresh, refresh);
}

export function NotificationsSection({ notifications, unread, refresh }: Props) {
  return (
    <>
      <div className="row" style={{ marginTop: 18 }}>
        <h3 style={{ margin: 0 }}>Bildirimler{unread > 0 && <span className="notif-count" data-testid="unread-count">{unread} okunmamış</span>}</h3>
        {unread > 0 && (
          <button type="button" className="link" onClick={() => readAll(refresh)} data-testid="read-all">
            Tümünü okundu yap
          </button>
        )}
      </div>
      {!notifications ? <p className="muted">Yükleniyor…</p> : <NotificationList notifications={notifications.slice(0, DASHBOARD_NOTIF_COUNT)} onChanged={refresh} />}
      {notifications && notifications.length > DASHBOARD_NOTIF_COUNT && (
        <a href="#/bildirimler" className="see-all" data-testid="see-all-notifs">
          Tümünü gör<span className="notif-count">+{notifications.length - DASHBOARD_NOTIF_COUNT}</span>
        </a>
      )}
    </>
  );
}

export function NotificationsPage({ notifications, unread, refresh }: Props) {
  return (
    <div>
      <a href="#/" className="link">← Panel</a>
      <div className="row">
        <h2 style={{ margin: '8px 0' }}>Bildirimler</h2>
        {unread > 0 && (
          <button type="button" className="link" onClick={() => readAll(refresh)}>
            Tümünü okundu yap
          </button>
        )}
      </div>
      {!notifications ? <p className="muted">Yükleniyor…</p> : <NotificationList notifications={notifications} onChanged={refresh} />}
    </div>
  );
}
