// Öğretmen ana sayfası: atama durumu sayıları ve atanan sorular. Sağ üstte bildirim zili ve çıkış.
// Soru atanmamışsa liste boş kalır ve kısa bir açıklama gösterilir.
import { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ASSIGNMENT_STATUS_LABEL, type AssignmentStatus, type NotificationInfo, type TeacherAssignment } from '@app/shared';
import { abs, api } from '../api';
import { routeFromHref, type Nav } from '../nav';
import { useNotifications } from '../notifications';
import { useSession } from '../session';
import { colors } from '../theme';
import { Badge, Card, ErrorText, StatusBadge } from '../ui';

function solutionHint(a: TeacherAssignment): string {
  if (a.status === 'assigned') return a.recording ? 'Kayıt hazır, onaya gönderilmedi' : 'Kayıt bekleniyor';
  if (a.status === 'returned') return a.recording ? 'Düzeltip yeniden gönderin' : 'Yeni kayıt gerekli';
  return ASSIGNMENT_STATUS_LABEL[a.status];
}

export function HomeScreen({ nav, refreshKey }: { nav: Nav; refreshKey: number }) {
  const { user, logout } = useSession();
  const insets = useSafeAreaInsets();
  const { notifications, unread, refresh: refreshNotifs } = useNotifications();
  const [assignments, setAssignments] = useState<TeacherAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

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
    setBellOpen(false);
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
        <Pressable accessibilityLabel={`Bildirimler${unread ? `, ${unread} okunmamış` : ''}`} onPress={() => setBellOpen(true)} style={styles.iconBtn} testID="bell">
          <Text style={{ fontSize: 20 }}>🔔</Text>
          {unread > 0 && (
            <View style={styles.badge} testID="bell-badge">
              <Text style={styles.badgeText}>{unread}</Text>
            </View>
          )}
        </Pressable>
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
            <View key={s} style={styles.stat}>
              <Text style={[styles.statValue, s === 'submitted' && { color: colors.brand }, s === 'returned' && { color: colors.danger }]}>{counts[s]}</Text>
              <Text style={styles.statLabel}>{ASSIGNMENT_STATUS_LABEL[s]}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>Sorularım</Text>
        {error && <ErrorText>{error}</ErrorText>}
        {!assignments && !error && <Text style={{ color: colors.muted }}>Yükleniyor…</Text>}
        {assignments && assignments.length === 0 && (
          <View style={styles.empty} testID="empty-questions">
            <Text style={{ fontWeight: '700', color: colors.ink }}>Henüz size atanmış soru yok.</Text>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>Yönetici size bir soru atadığında burada görünür ve bildirim alırsınız.</Text>
          </View>
        )}
        {assignments?.map((a) => (
          <Pressable key={a.id} onPress={() => nav.push({ name: 'question', id: a.id })} testID="assignment-card">
            <Card style={styles.row}>
              <Image source={{ uri: abs(a.question.imageUrl) }} style={styles.thumb} resizeMode="contain" />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Badge label={a.question.branch} />
                  <Text style={{ fontWeight: '700', color: colors.ink }}>{a.question.questionNumber ? `Soru ${a.question.questionNumber}` : 'Soru'}</Text>
                </View>
                <Text style={styles.small} numberOfLines={1}>{a.question.outcomes.map((o) => o.code).join(', ')}</Text>
                <Text style={styles.small}>{solutionHint(a)}</Text>
              </View>
              <StatusBadge status={a.status} />
            </Card>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={bellOpen} transparent animationType="fade" onRequestClose={() => setBellOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setBellOpen(false)}>
          <Pressable style={[styles.sheet, { marginTop: insets.top + 56 }]} onPress={() => undefined}>
            <View style={styles.sheetHead}>
              <Text style={{ fontWeight: '800', fontSize: 16, color: colors.ink }}>Bildirimler</Text>
              {unread > 0 && (
                <Pressable onPress={() => void readAll()}>
                  <Text style={{ color: colors.brandDark, fontWeight: '700' }}>Tümünü okundu yap</Text>
                </Pressable>
              )}
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {!notifications || notifications.length === 0 ? (
                <Text style={{ color: colors.muted, padding: 8 }}>Henüz bildiriminiz yok.</Text>
              ) : (
                notifications.map((n) => (
                  <Pressable key={n.id} onPress={() => void openNotification(n)} style={[styles.notif, !n.readAt && styles.notifUnread]} testID={n.readAt ? 'notif-read' : 'notif-unread'}>
                    <Text style={[{ color: colors.ink, fontSize: 14 }, !n.readAt && { fontWeight: '700' }]}>{n.text}</Text>
                    <Text style={styles.small}>{new Date(n.createdAt).toLocaleString('tr-TR')}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: colors.ink },
  hello: { color: '#fff', fontSize: 17, fontWeight: '800' },
  role: { color: colors.sage, fontSize: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#ffffff1a', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  logout: { paddingHorizontal: 12, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#ffffff44', alignItems: 'center', justifyContent: 'center' },
  logoutText: { color: colors.sage, fontWeight: '700' },
  content: { padding: 16, gap: 12, width: '100%', maxWidth: 860, alignSelf: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '22%', minWidth: 76, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 12 },
  statValue: { fontSize: 26, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 12, color: colors.muted },
  section: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: 6 },
  empty: { backgroundColor: '#fff', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.sage, borderRadius: 12, padding: 20, alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 72, height: 56, backgroundColor: '#fff' },
  small: { fontSize: 12, color: colors.muted },
  backdrop: { flex: 1, backgroundColor: 'rgba(26,14,28,0.35)', alignItems: 'flex-end', paddingHorizontal: 12 },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 8 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  notif: { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.line, marginBottom: 6, gap: 2 },
  notifUnread: { borderLeftWidth: 4, borderLeftColor: colors.brand, backgroundColor: '#fff7f3' },
});
