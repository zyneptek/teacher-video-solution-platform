// Öğretmen ana sayfası: atama durumu sayıları ve atanan sorular. Sağ üstte bildirim zili ve çıkış.
// Soru atanmamışsa liste boş kalır ve kısa bir açıklama gösterilir.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ASSIGNMENT_STATUS_LABEL, type AssignmentStatus, type NotificationInfo, type TeacherAssignment } from '@app/shared';
import { api } from '../api';
import { routeFromHref, type Nav } from '../nav';
import { useNotifications } from '../notifications';
import { useSession } from '../session';
import { colors } from '../theme';
import { ErrorText, StatCard } from '../ui';
import { AssignmentRow } from '../ui/AssignmentRow';
import { useWide } from '../ui/layout';
import { NotificationRows } from '../ui/NotificationSheet';

export function HomeScreen({ nav, refreshKey }: { nav: Nav; refreshKey: number }) {
  const { user, logout } = useSession();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const { notifications, unread, refresh: refreshNotifs } = useNotifications();
  const [assignments, setAssignments] = useState<TeacherAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ assignments: TeacherAssignment[] }>('/api/teacher/assignments');
      setAssignments(r.assignments);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sorular yüklenemedi.');
    }
  }, []);

  // Ekran her açıldığında (örneğin soru sayfasından dönünce) ve her 30 sn'de yenilenir.
  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load, refreshKey]);

  const counts: Record<AssignmentStatus, number> = { assigned: 0, submitted: 0, approved: 0, returned: 0 };
  for (const a of assignments ?? []) counts[a.status]++;

  async function openNotification(n: NotificationInfo) {
    if (!n.readAt) await api(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => undefined);
    void refreshNotifs();
    const route = routeFromHref(n.href);
    if (route) nav.push(route);
  }

  async function readAll() {
    await api('/api/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    void refreshNotifs();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello} numberOfLines={1}>{user?.firstName} {user?.lastName}</Text>
          <Text style={styles.role}>Öğretmen · {user?.branch}</Text>
        </View>
        <Pressable accessibilityLabel="Çıkış" onPress={() => void logout()} style={styles.logout} testID="logout">
          <Text style={styles.logoutText}>Çıkış</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await Promise.all([load(), refreshNotifs()]); setRefreshing(false); }} />}
      >
        <View style={styles.stats}>
          {(Object.keys(ASSIGNMENT_STATUS_LABEL) as AssignmentStatus[]).map((s) => (
            <StatCard key={s} wide={wide} onPress={() => nav.push({ name: 'list', status: s })} label={ASSIGNMENT_STATUS_LABEL[s]} value={counts[s]} tone={s === 'submitted' ? 'brand' : s === 'returned' ? 'warn' : undefined} />
          ))}
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.section}>Bildirimler{unread > 0 ? ` (${unread} okunmamış)` : ''}</Text>
          {unread > 0 && (
            <Pressable onPress={() => void readAll()} hitSlop={10}>
              <Text style={{ color: colors.brandDark, fontWeight: '700' }}>Tümünü okundu yap</Text>
            </Pressable>
          )}
        </View>
        <NotificationRows notifications={notifications?.slice(0, 6) ?? null} onOpen={(n) => void openNotification(n)} />

        <Text style={styles.section}>Sorularım</Text>
        {error && <ErrorText>{error}</ErrorText>}
        {!assignments && !error && <Text style={{ color: colors.muted }}>Yükleniyor…</Text>}
        {assignments && assignments.length === 0 && (
          <View style={styles.empty} testID="empty-questions">
            <Text style={{ fontWeight: '700', color: colors.ink }}>Henüz size atanmış soru yok.</Text>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>Yönetici size bir soru atadığında burada görünür ve bildirim alırsınız.</Text>
          </View>
        )}
        <View style={wide ? { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } : { gap: 12 }}>
        {assignments?.map((a) => (
          <AssignmentRow key={a.id} assignment={a} wide={wide} onPress={() => nav.push({ name: 'question', id: a.id })} />
        ))}
        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.ink, borderBottomWidth: 3, borderBottomColor: colors.brand },
  hello: { color: '#fff', fontSize: 17, fontWeight: '800' },
  role: { color: colors.sage, fontSize: 12 },
  logout: { paddingHorizontal: 12, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#ffffff44', alignItems: 'center', justifyContent: 'center' },
  logoutText: { color: colors.sage, fontWeight: '700' },
  content: { padding: 16, gap: 12, width: '100%', maxWidth: 1240, alignSelf: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  section: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: 6 },
  empty: { backgroundColor: '#fff', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.sage, borderRadius: 12, padding: 20, alignItems: 'center', gap: 6 },
  small: { fontSize: 12, color: colors.muted },
});
