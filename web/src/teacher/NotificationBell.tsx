// Bildirim düğmesi: sayfanın sağ üstünde zil simgesi + okunmamış sayısı. Tıklayınca bildirimler açılır liste olarak gelir;
// bir bildirime tıklamak onu okundu yapar ve ilgili soruya götürür.
import { useEffect, useRef, useState } from 'react';
import type { NotificationInfo } from '@app/shared';
import { api } from '../auth/session';
import { NotificationList } from './NotificationList';

export function NotificationBell({ notifications, unread, refresh }: { notifications: NotificationInfo[] | null; unread: number; refresh: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Dışarı tıklayınca veya Esc'ye basınca kapanır.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function readAll() {
    await api('/api/teacher/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    refresh();
  }

  return (
    <div className="bell" ref={ref}>
      <button type="button" className="icon-btn" onClick={() => setOpen((v) => !v)} aria-label={`Bildirimler${unread ? `, ${unread} okunmamış` : ''}`} aria-expanded={open} title="Bildirimler" data-testid="bell">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a6 6 0 0 0-6 6v3.5L4.5 16h15L18 12.5V9a6 6 0 0 0-6-6zM10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        {unread > 0 && <span className="bell-badge" data-testid="bell-badge">{unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Bildirimler" data-testid="bell-panel">
          <div className="row" style={{ marginBottom: 8 }}>
            <strong>Bildirimler</strong>
            {unread > 0 && (
              <button type="button" className="link" onClick={() => void readAll()} data-testid="read-all">
                Tümünü okundu yap
              </button>
            )}
          </div>
          {!notifications ? <p className="muted">Yükleniyor…</p> : <NotificationList notifications={notifications} onChanged={refresh} onOpened={() => setOpen(false)} />}
        </div>
      )}
    </div>
  );
}
