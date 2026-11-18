// Yönetici (mobil, en küçük kapsam): Panel (sayılar), Onay kuyruğu (izle, onayla, notla geri gönder) ve Hata bildirimleri.
// Öğretmen, soru ve atama yönetimi web panelindedir. Sağ üstte bildirim zili ve çıkış vardır.
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ASSIGNMENT_STATUS_LABEL, ERROR_REPORT_TYPES, type AssignmentInfo, type AssignmentStatus, type DashboardStats, type ErrorReportInfo, type NotificationInfo } from '@app/shared';
import { abs, api } from '../api';
import { useNotifications } from '../notifications';
import { useSession } from '../session';
import { colors } from '../theme';
import { Button, Card, ErrorText, Notice, StatCard } from '../ui';
import { useWide } from '../ui/layout';
import { NotificationSheet } from '../ui/NotificationSheet';
import { VideoBox } from '../ui/VideoBox';

type Tab = 'panel' | 'queue' | 'reports';
const TABS: { id: Tab; label: string }[] = [
  { id: 'panel', label: 'Panel' },
  { id: 'queue', label: 'Onay kuyruğu' },
  { id: 'reports', label: 'Hata bildirimleri' },
];
const MAX_NOTE = 500;

// Bildirimin web adresinden (#/...) hangi sekmenin açılacağı.
function tabFromHref(href: string): Tab | null {
  if (href.startsWith('#/onay-kuyrugu')) return 'queue';
  if (href.startsWith('#/sorular/') || href.startsWith('#/hata-bildirimleri')) return 'reports';
  return null;
}

export function AdminScreen() {
  const { user, logout } = useSession();
  const insets = useSafeAreaInsets();
  const { notifications, unread, refresh: refreshNotifs } = useNotifications();
  const [tab, setTab] = useState<Tab>('panel');
  const [bellOpen, setBellOpen] = useState(false);

  async function openNotification(n: NotificationInfo) {
    if (!n.readAt) await api(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => undefined);
    void refreshNotifs();
    setBellOpen(false);
    const target = tabFromHref(n.href);
    if (target) setTab(target);
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
          <Text style={styles.role}>Yönetici</Text>
        </View>
        <Pressable accessibilityLabel={`Bildirimler${unread ? `, ${unread} okunmamış` : ''}`} onPress={() => setBellOpen(true)} style={styles.iconBtn} testID="bell">
          <Text style={{ fontSize: 20 }}>🔔</Text>
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread}</Text>
            </View>
          )}
        </Pressable>
        <Pressable accessibilityLabel="Çıkış" onPress={() => void logout()} style={styles.logout} testID="logout">
          <Text style={styles.logoutText}>Çıkış</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabOn]} testID={`admin-tab-${t.id}`}>
            <Text style={[styles.tabText, tab === t.id && { color: '#fff' }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'panel' && <PanelTab goTo={setTab} />}
      {tab === 'queue' && <QueueTab />}
      {tab === 'reports' && <ReportsTab />}

      <NotificationSheet visible={bellOpen} onClose={() => setBellOpen(false)} notifications={notifications} unread={unread} onOpen={(n) => void openNotification(n)} onReadAll={() => void readAll()} />
    </View>
  );
}

// Her sekme kendi verisini okur; aşağı çekince yenilenir ve 30 sn'de bir kendiliğinden güncellenir.
function useList<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const reload = useCallback(async () => {
    try {
      setData(await load());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi.');
    }
  }, [load]);
  useEffect(() => {
    void reload();
    const id = setInterval(() => void reload(), 30_000);
    return () => clearInterval(id);
  }, [reload]);
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} />;
  return { data, error, reload, refreshControl };
}

// Panel: iki grup (sayılar, atama durumları); telefonda 2x2, tablette tek sırada dört kart.
function PanelTab({ goTo }: { goTo: (t: Tab) => void }) {
  const insets = useSafeAreaInsets();
  const { data: stats, error, refreshControl } = useList(useCallback(() => api<DashboardStats>('/api/admin/dashboard'), []));
  const wide = useWide();
  const statuses = Object.keys(ASSIGNMENT_STATUS_LABEL) as AssignmentStatus[];
  return (
    <ScrollView refreshControl={refreshControl} contentContainerStyle={[styles.panel, { paddingBottom: insets.bottom + 16 }]}>
      {error && <ErrorText>{error}</ErrorText>}
      {!stats && !error && <Text style={{ color: colors.muted }}>Yükleniyor…</Text>}
      {stats && (
        <>
          <View style={styles.statGrid}>
            <StatCard wide={wide} label="Öğretmen" value={stats.teachers} />
            <StatCard wide={wide} label="Soru" value={stats.questions} />
            <StatCard wide={wide} label="Kazanım" value={stats.outcomes} />
            <StatCard wide={wide} label="Hata bildirimi" value={stats.errorReports} onPress={() => goTo('reports')} />
          </View>
          <Text style={styles.section}>Atama durumları</Text>
          <View style={styles.statGrid}>
            {statuses.map((s) => (
              <StatCard wide={wide} key={s} label={ASSIGNMENT_STATUS_LABEL[s]} value={stats.assignments[s]} tone={s === 'submitted' ? 'brand' : s === 'returned' ? 'warn' : undefined} onPress={s === 'submitted' ? () => goTo('queue') : undefined} />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function QueueTab() {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const { data, error, reload, refreshControl } = useList(useCallback(async () => (await api<{ assignments: AssignmentInfo[] }>('/api/admin/assignments?status=submitted')).assignments, []));
  return (
    <ScrollView refreshControl={refreshControl} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
      {message && <Notice>{message}</Notice>}
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !error && <Text style={{ color: colors.muted }}>Yükleniyor…</Text>}
      {data && data.length === 0 && <Text style={styles.empty} testID="queue-empty">Onay bekleyen video yok.</Text>}
      {data?.map((a) => (
        <ReviewCard key={a.id} assignment={a} onDone={(text) => { setMessage(text); void reload(); }} />
      ))}
    </ScrollView>
  );
}

function ReviewCard({ assignment: a, onDone }: { assignment: AssignmentInfo; onDone: (message: string) => void }) {
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = `${a.branch} — ${a.questionNumber ? `Soru ${a.questionNumber}` : 'Soru'}`;

  async function send(path: 'approve' | 'return', body: object | undefined, doneText: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/assignments/${a.id}/${path}`, { method: 'POST', body });
      onDone(`${label} (${a.teacherName}) ${doneText}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem yapılamadı.');
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text style={{ fontWeight: '800', color: colors.ink }}>{label} · {a.teacherName}</Text>
      <Text style={styles.small}>Gönderilme: {a.submittedAt ? new Date(a.submittedAt).toLocaleString('tr-TR') : '—'}</Text>
      {a.recording ? <VideoBox url={abs(a.recording.videoUrl)} /> : <Text style={{ color: colors.muted }}>Video bulunamadı.</Text>}
      {error && <ErrorText>{error}</ErrorText>}
      {returning ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.small}>Öğretmene görünecek not (zorunlu, en fazla {MAX_NOTE} karakter)</Text>
          <TextInput style={styles.textarea} value={note} onChangeText={setNote} multiline maxLength={MAX_NOTE} accessibilityLabel="Geri gönderme notu" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Geri gönder" onPress={() => void send('return', { note }, 'notla geri gönderildi.')} busy={busy} disabled={!note.trim()} style={{ flex: 1 }} />
            <Button label="Vazgeç" variant="ghost" onPress={() => setReturning(false)} disabled={busy} />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Onayla" onPress={() => void send('approve', undefined, 'onaylandı.')} busy={busy} style={{ flex: 1 }} />
          <Button label="Geri gönder" variant="ghost" onPress={() => setReturning(true)} disabled={busy} style={{ flex: 1 }} />
        </View>
      )}
    </Card>
  );
}

function ReportsTab() {
  const insets = useSafeAreaInsets();
  const { data, error, refreshControl } = useList(useCallback(async () => (await api<{ reports: ErrorReportInfo[] }>('/api/admin/error-reports')).reports, []));
  return (
    <ScrollView refreshControl={refreshControl} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !error && <Text style={{ color: colors.muted }}>Yükleniyor…</Text>}
      {data && data.length === 0 && <Text style={styles.empty} testID="reports-empty">Hata bildirimi yok.</Text>}
      {data?.map((r) => (
        <Card key={r.id}>
          <Text style={{ fontWeight: '800', color: colors.ink }}>{ERROR_REPORT_TYPES.find((t) => t.value === r.type)?.label}</Text>
          <Text style={{ color: colors.ink }}>{r.questionLabel} · Gönderen: {r.reporterName}</Text>
          {!!r.description && <Text style={{ color: colors.ink }}>{r.description}</Text>}
          {r.attachment?.type === 'image' && <Image source={{ uri: abs(r.attachment.url) }} style={styles.attachment} resizeMode="contain" />}
          {r.attachment?.type === 'video' && <VideoBox url={abs(r.attachment.url)} />}
          <Text style={styles.small}>{new Date(r.createdAt).toLocaleString('tr-TR')}{r.marker ? ' · görselde işaretli' : ''}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.ink, borderBottomWidth: 3, borderBottomColor: colors.brand },
  hello: { color: '#fff', fontSize: 17, fontWeight: '800' },
  role: { color: colors.sage, fontSize: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#ffffff1a', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  logout: { paddingHorizontal: 12, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#ffffff44', alignItems: 'center', justifyContent: 'center' },
  logoutText: { color: colors.sage, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 0, width: '100%', maxWidth: 860, alignSelf: 'center' },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.sage },
  tabOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  content: { padding: 16, gap: 12, width: '100%', maxWidth: 860, alignSelf: 'center' },
  section: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: 6 },
  panel: { padding: 16, gap: 12, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  empty: { color: colors.muted, textAlign: 'center', padding: 24 },
  small: { fontSize: 12, color: colors.muted },
  textarea: { minHeight: 80, borderWidth: 1, borderColor: colors.sage, borderRadius: 10, padding: 10, fontSize: 15, backgroundColor: '#fff', textAlignVertical: 'top', color: colors.ink },
  attachment: { width: '100%', height: 220, backgroundColor: colors.bg, borderRadius: 8 },
});
