// Bildirimler (öğretmen ve yönetici ana sayfalarında ortak): son 3 bildirim, okunmamış sayısı, "Tümünü okundu yap" ve
// daha fazlası varsa kalan sayıyı gösteren "Tümünü gör" bağlantısı. NotificationRows tam liste sayfalarında da kullanılır.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NotificationInfo } from '@app/shared';
import { colors } from '../theme';

export const DASHBOARD_NOTIF_COUNT = 3;

// Bildirim satırları: okunmamışlar vurgulanır; dokununca onOpen çağrılır (okundu yapar ve ilgili ekrana gider).
export function NotificationRows({ notifications, onOpen }: { notifications: NotificationInfo[] | null; onOpen: (n: NotificationInfo) => void }) {
  if (!notifications || notifications.length === 0) return <Text style={{ color: colors.muted, padding: 8 }}>Henüz bildiriminiz yok.</Text>;
  return (
    <>
      {notifications.map((n) => (
        <Pressable key={n.id} onPress={() => onOpen(n)} style={[styles.notif, !n.readAt && styles.notifUnread]} testID={n.readAt ? 'notif-read' : 'notif-unread'}>
          <Text style={[{ color: colors.ink, fontSize: 14 }, !n.readAt && { fontWeight: '700' }]}>{n.text}</Text>
          <Text style={styles.small}>{new Date(n.createdAt).toLocaleString('tr-TR')}</Text>
        </Pressable>
      ))}
    </>
  );
}

export type NotifProps = {
  notifications: NotificationInfo[] | null;
  unread: number;
  onOpen: (n: NotificationInfo) => void;
  onReadAll: () => void;
  onSeeAll: () => void;
};

export function NotificationsSection({ notifications, unread, onOpen, onReadAll, onSeeAll }: NotifProps) {
  return (
    <>
      <View style={styles.sectionRow}>
        <Text style={styles.section}>Bildirimler{unread > 0 ? ` (${unread} okunmamış)` : ''}</Text>
        {unread > 0 && (
          <Pressable onPress={onReadAll} hitSlop={10}>
            <Text style={{ color: colors.brandDark, fontWeight: '700' }}>Tümünü okundu yap</Text>
          </Pressable>
        )}
      </View>
      <NotificationRows notifications={notifications?.slice(0, DASHBOARD_NOTIF_COUNT) ?? null} onOpen={onOpen} />
      {notifications && notifications.length > DASHBOARD_NOTIF_COUNT && (
        <Pressable onPress={onSeeAll} style={styles.seeAll} testID="see-all-notifs">
          <Text style={{ color: colors.brandDark, fontWeight: '700' }}>Tümünü gör</Text>
          <View style={styles.count}><Text style={styles.countText}>+{notifications.length - DASHBOARD_NOTIF_COUNT}</Text></View>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  section: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: 6 },
  notif: { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.line, marginBottom: 6, gap: 2 },
  notifUnread: { borderLeftWidth: 4, borderLeftColor: colors.brand, backgroundColor: '#fff7f3' },
  small: { fontSize: 12, color: colors.muted },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 8 },
  count: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, backgroundColor: '#fde6dc' },
  countText: { color: colors.brandDark, fontSize: 12, fontWeight: '800' },
});
