// Tüm bildirimler: ana sayfada yalnızca son 3 bildirim görünür, "Tümünü gör" bu sayfayı açar.
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NotificationInfo } from '@app/shared';
import { routeFromHref, type Nav } from '../nav';
import { useNotifications } from '../notifications';
import { colors } from '../theme';
import { Button } from '../ui';
import { NotificationRows } from '../ui/NotificationsSection';

export function NotificationsScreen({ nav }: { nav: Nav }) {
  const insets = useSafeAreaInsets();
  const { notifications, unread, markRead, readAll } = useNotifications();

  function open(n: NotificationInfo) {
    if (!n.readAt) void markRead(n.id);
    const route = routeFromHref(n.href);
    if (route) nav.push(route);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
      <Button label="← Geri" variant="ghost" onPress={nav.pop} style={{ alignSelf: 'flex-start' }} />
      <View style={styles.row}>
        <Text style={styles.title}>Bildirimler</Text>
        {unread > 0 && (
          <Pressable onPress={() => void readAll()} hitSlop={10}>
            <Text style={{ color: colors.brandDark, fontWeight: '700' }}>Tümünü okundu yap</Text>
          </Pressable>
        )}
      </View>
      {!notifications ? <Text style={{ color: colors.muted }}>Yükleniyor…</Text> : <NotificationRows notifications={notifications} onOpen={open} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 12, width: '100%', maxWidth: 900, alignSelf: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
});
