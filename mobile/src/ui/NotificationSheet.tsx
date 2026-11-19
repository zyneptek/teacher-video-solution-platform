// Bildirim listesi (zil düğmesine basınca açılır): öğretmen ve yönetici ana ekranlarında ortak kullanılır.
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NotificationInfo } from '@app/shared';
import { colors } from '../theme';

// Bildirim satırları: okunmamışlar vurgulanır; dokununca onOpen çağrılır (okundu yapar ve ilgili soruya gider).
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

export function NotificationSheet({ visible, onClose, notifications, unread, onOpen, onReadAll }: {
  visible: boolean;
  onClose: () => void;
  notifications: NotificationInfo[] | null;
  unread: number;
  onOpen: (n: NotificationInfo) => void;
  onReadAll: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { marginTop: insets.top + 56 }]} onPress={() => undefined}>
          <View style={styles.head}>
            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.ink }}>Bildirimler</Text>
            {unread > 0 && (
              <Pressable onPress={onReadAll}>
                <Text style={{ color: colors.brandDark, fontWeight: '700' }}>Tümünü okundu yap</Text>
              </Pressable>
            )}
          </View>
          <ScrollView style={{ maxHeight: 420 }}>
            <NotificationRows notifications={notifications} onOpen={onOpen} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26,14,28,0.35)', alignItems: 'flex-end', paddingHorizontal: 12 },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  notif: { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.line, marginBottom: 6, gap: 2 },
  notifUnread: { borderLeftWidth: 4, borderLeftColor: colors.brand, backgroundColor: '#fff7f3' },
  small: { fontSize: 12, color: colors.muted },
});
