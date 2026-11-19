// Yönetici sayfaları: Öğretmenler, Sorular, Kazanımlar (arama) ve duruma göre Atamalar listeleri (panel kartlarından açılır).
// Soru detayında cevap anahtarı ve kazanımlar düzenlenir, soru aynı branştaki öğretmenlere atanır (web ile aynı uç noktalar).
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ANSWER_KEYS, ASSIGNMENT_STATUS_LABEL, type AssignmentDelivery, type AssignmentInfo, type AssignmentStatus, type OutcomeInfo, type QuestionInfo, type TeacherInfo } from '@app/shared';
import { abs, api } from '../api';
import { colors } from '../theme';
import { Badge, Button, Card, ErrorText, Notice, StatusBadge } from '../ui';
import { useWide } from '../ui/layout';
import { NotificationRows, type NotifProps } from '../ui/NotificationsSection';
import { useList } from '../ui/useList';
import { VideoBox } from '../ui/VideoBox';

export type AdminPage = { name: 'notifications' } | { name: 'teachers' } | { name: 'questions' } | { name: 'question'; question: QuestionInfo } | { name: 'outcomes' } | { name: 'assignments'; status: AssignmentStatus };

export function pageTitle(page: AdminPage): string {
  if (page.name === 'notifications') return 'Bildirimler';
  if (page.name === 'teachers') return 'Öğretmenler';
  if (page.name === 'questions') return 'Sorular';
  if (page.name === 'question') return `${page.question.branch} sorusu${page.question.questionNumber ? ` (Soru ${page.question.questionNumber})` : ''}`;
  if (page.name === 'outcomes') return 'Kazanımlar';
  return ASSIGNMENT_STATUS_LABEL[page.status];
}

export function AdminPageView({ page, onBack, open, notif }: { page: AdminPage; onBack: () => void; open: (p: AdminPage) => void; notif: NotifProps }) {
  return (
    <Shell title={pageTitle(page)} onBack={page.name === 'question' ? () => open({ name: 'questions' }) : onBack} backLabel={page.name === 'question' ? '← Sorular' : '← Panel'}>
      {page.name === 'notifications' && (
        <>
          {notif.unread > 0 && <Button label="Tümünü okundu yap" variant="ghost" onPress={notif.onReadAll} style={{ alignSelf: 'flex-start' }} />}
          <NotificationRows notifications={notif.notifications} onOpen={notif.onOpen} />
        </>
      )}
      {page.name === 'teachers' && <TeachersList />}
      {page.name === 'questions' && <QuestionsList open={open} />}
      {page.name === 'question' && <QuestionDetail question={page.question} />}
      {page.name === 'outcomes' && <OutcomesList />}
      {page.name === 'assignments' && <AssignmentsList status={page.status} />}
    </Shell>
  );
}

function Shell({ title, onBack, backLabel, children }: { title: string; onBack: () => void; backLabel: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
      <Button label={backLabel} variant="ghost" onPress={onBack} style={{ alignSelf: 'flex-start' }} />
      <Text style={styles.title}>{title}</Text>
      {children}
    </ScrollView>
  );
}

// Geniş ekranda (tablet) kartlar iki sütuna dizilir, telefonda alt alta kalır.
function Grid({ children }: { children: ReactNode }) {
  const wide = useWide();
  return <View style={wide ? { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } : { gap: 12 }}>{children}</View>;
}
function Cell({ children }: { children: ReactNode }) {
  const wide = useWide();
  return <View style={wide ? { width: '48.9%' } : undefined}>{children}</View>;
}

function Status({ error, loading, empty }: { error: string | null; loading: boolean; empty?: string | false }) {
  if (error) return <ErrorText>{error}</ErrorText>;
  if (loading) return <Text style={{ color: colors.muted }}>Yükleniyor…</Text>;
  if (empty) return <Text style={styles.empty}>{empty}</Text>;
  return null;
}

function TeachersList() {
  const { data, error } = useList(useCallback(async () => (await api<{ teachers: TeacherInfo[] }>('/api/admin/teachers')).teachers, []));
  return (
    <>
      <Status error={error} loading={!data} empty={data?.length === 0 && 'Öğretmen yok.'} />
      <Grid>
      {data?.map((t) => (
        <Cell key={t.id}><Card>
          <View style={styles.between}>
            <Text style={styles.bold}>{t.firstName} {t.lastName}</Text>
            {t.branch && <Badge label={t.branch} />}
          </View>
          <Text style={styles.small}>{t.email}</Text>
        </Card></Cell>
      ))}
      </Grid>
    </>
  );
}

function QuestionsList({ open }: { open: (p: AdminPage) => void }) {
  const wide = useWide();
  const { data, error } = useList(useCallback(async () => (await api<{ questions: QuestionInfo[] }>('/api/admin/questions')).questions, []));
  return (
    <>
      <Status error={error} loading={!data} empty={data?.length === 0 && 'Soru yok.'} />
      <Grid>
      {data?.map((q) => (
        <Cell key={q.id}><Pressable onPress={() => open({ name: 'question', question: q })} style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)} accessibilityRole="button" testID="question-row"><Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          {q.imageUrl && <Image source={{ uri: abs(q.imageUrl) }} style={[styles.thumb, wide && { width: 110, height: 90 }]} resizeMode="contain" />}
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Badge label={q.branch} />
              <Text style={styles.bold}>{q.questionNumber ? `Soru ${q.questionNumber}` : 'Soru'}</Text>
            </View>
            <Text style={styles.small} numberOfLines={1}>{q.outcomes.map((o) => o.code).join(', ')}</Text>
            <Text style={styles.small}>Cevap: {q.answerKey} · {q.assignmentCount} atama</Text>
          </View>
        </Card></Pressable></Cell>
      ))}
      </Grid>
    </>
  );
}

// Soru detayı: görsel, cevap anahtarı, kazanımlar, mevcut atamalar ve aynı branştaki öğretmenlere atama.
function QuestionDetail({ question: initial }: { question: QuestionInfo }) {
  const wide = useWide();
  const [q, setQ] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<OutcomeInfo[]>([]);

  // Cevap anahtarı / kazanım değişikliği veritabanına yazılır, sonra soru yeniden okunur.
  async function change(run: () => Promise<unknown>, message: string) {
    setSaving(true);
    setEditError(null);
    setEditNotice(null);
    try {
      await run();
      setQ((await api<{ question: QuestionInfo }>(`/api/admin/questions/${q.id}`)).question);
      setEditNotice(message);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  // Kazanım araması: yazdıkça veritabanındaki liste süzülür; sonuca dokununca soruya eklenir.
  useEffect(() => {
    const term = search.trim();
    if (!term) {
      setFound([]);
      return;
    }
    const id = setTimeout(() => {
      api<{ outcomes: OutcomeInfo[] }>(`/api/admin/outcomes?q=${encodeURIComponent(term)}`).then((r) => setFound(r.outcomes), () => setFound([]));
    }, 250);
    return () => clearTimeout(id);
  }, [search]);
  const addable = found.filter((o) => !q.outcomes.some((x) => x.id === o.id)).slice(0, 8);

  const { data: teachers } = useList(useCallback(async () => (await api<{ teachers: TeacherInfo[] }>('/api/admin/teachers')).teachers, []));
  const { data: assignments, error, reload } = useList(useCallback(async () => (await api<{ assignments: AssignmentInfo[] }>(`/api/admin/assignments?questionId=${q.id}`)).assignments, [q.id]));
  const [ratio, setRatio] = useState(0.75);
  useEffect(() => {
    if (q.imageUrl) Image.getSize(abs(q.imageUrl), (w, h) => setRatio(w / h), () => undefined);
  }, [q.imageUrl]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // Yalnızca sorunun branşındaki öğretmenler; zaten atananlar yeniden atanamaz.
  const eligible = (teachers ?? []).filter((t) => t.branch === q.branch);
  const assignedIds = new Set((assignments ?? []).map((a) => a.teacherId));

  async function assign(t: TeacherInfo) {
    setBusyId(t.id);
    setMessage(null);
    setFailure(null);
    try {
      const r = await api<{ assignment: AssignmentInfo; delivery: AssignmentDelivery }>('/api/admin/assignments', { method: 'POST', body: { questionId: q.id, teacherId: t.id } });
      const email = r.delivery.email === 'sent' ? 'E-posta gönderildi.' : r.delivery.email === 'not_configured' ? 'E-posta gönderilmedi (ayar yok).' : 'E-posta gönderilemedi.';
      const push = r.delivery.pushDevices > 0 ? `Push ${r.delivery.pushDevices} cihaza gönderildi.` : 'Push gönderilmedi (mobil uygulama yüklü değil).';
      setMessage(`${r.assignment.teacherName} öğretmene atandı. ${email} ${push}`);
      await reload();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Atama yapılamadı.');
    } finally {
      setBusyId(null);
    }
  }

  function confirmAssign(t: TeacherInfo) {
    Alert.alert('Soru atansın mı?', `${t.firstName} ${t.lastName} öğretmene atanacak; e-posta ve push bildirimi gider.`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Ata', onPress: () => void assign(t) },
    ]);
  }

  // Telefonda önce işlem kartları, soru görseli en altta; tablette görsel solda.
  const image = q.imageUrl ? (
    <View style={styles.imageBox}>
      <Image source={{ uri: abs(q.imageUrl) }} style={{ width: '100%', aspectRatio: ratio }} resizeMode="contain" />
    </View>
  ) : null;

  return (
    <View style={wide ? { flexDirection: 'row', gap: 16, alignItems: 'flex-start' } : { gap: 12 }}>
      {wide && <View style={{ flex: 1 }}>{image}</View>}
      <View style={[{ gap: 12 }, wide && { flex: 1 }]}>
        <Card>
          <Text style={styles.bold}>Cevap anahtarı</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {ANSWER_KEYS.map((k) => (
              <Pressable key={k} disabled={saving} onPress={() => k !== q.answerKey && void change(() => api(`/api/admin/questions/${q.id}`, { method: 'PATCH', body: { answerKey: k } }), 'Cevap anahtarı kaydedildi.')} style={[styles.key, q.answerKey === k && styles.keyOn]} testID={`answer-${k}`}>
                <Text style={[styles.keyText, q.answerKey === k && { color: '#fff' }]}>{k}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.bold}>Kazanımlar</Text>
          {q.outcomes.length === 0 && <Text style={styles.small}>Bu soruya kazanım eklenmemiş.</Text>}
          {q.outcomes.map((o) => (
            <View key={o.id} style={styles.between}>
              <Text style={{ color: colors.ink, fontSize: 14, flex: 1 }}><Text style={{ fontWeight: '800' }}>{o.code}</Text> {o.description}</Text>
              <Pressable disabled={saving || q.outcomes.length <= 1} onPress={() => void change(() => api(`/api/admin/questions/${q.id}/outcomes/${o.id}`, { method: 'DELETE' }), 'Kazanım çıkarıldı.')} hitSlop={8} style={[styles.remove, q.outcomes.length <= 1 && { opacity: 0.35 }]} accessibilityLabel={`${o.code} kazanımını çıkar`}>
                <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 16 }}>×</Text>
              </Pressable>
            </View>
          ))}
          <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Kazanım ekle: kod veya açıklama ara" autoCorrect={false} accessibilityLabel="Kazanım ara" />
          {addable.map((o) => (
            <Pressable key={o.id} disabled={saving} onPress={() => { setSearch(''); void change(() => api(`/api/admin/questions/${q.id}/outcomes`, { method: 'POST', body: { outcomeId: o.id } }), `${o.code} soruya eklendi.`); }} style={styles.result} testID="outcome-result">
              <Text style={{ color: colors.ink, fontSize: 14 }}><Text style={{ fontWeight: '800' }}>{o.code}</Text> {o.description}</Text>
            </Pressable>
          ))}
          {search.trim() !== '' && addable.length === 0 && <Text style={styles.small}>Eklenebilecek sonuç yok.</Text>}
          {editNotice && <Notice>{editNotice}</Notice>}
          {editError && <ErrorText>{editError}</ErrorText>}
        </Card>

        <Card>
          <Text style={styles.bold}>Öğretmene ata ({q.branch})</Text>
          {message && <Notice>{message}</Notice>}
          {failure && <ErrorText>{failure}</ErrorText>}
          {teachers && eligible.length === 0 && <Text style={styles.small}>Bu branşta öğretmen yok.</Text>}
          {eligible.map((t) => {
            const done = assignedIds.has(t.id);
            return (
              <View key={t.id} style={styles.between}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontWeight: '700' }}>{t.firstName} {t.lastName}</Text>
                  <Text style={styles.small}>{t.email}</Text>
                </View>
                <Button label={done ? 'Atandı' : 'Ata'} variant={done ? 'ghost' : 'primary'} disabled={done} busy={busyId === t.id} onPress={() => confirmAssign(t)} />
              </View>
            );
          })}
        </Card>

        <Card>
          <Text style={styles.bold}>Atamalar</Text>
          {error && <ErrorText>{error}</ErrorText>}
          {assignments && assignments.length === 0 && <Text style={styles.small}>Bu soru henüz kimseye atanmadı.</Text>}
          {assignments?.map((a) => (
            <View key={a.id} style={styles.between}>
              <Text style={{ color: colors.ink, flex: 1 }}>{a.teacherName}</Text>
              <StatusBadge status={a.status} />
            </View>
          ))}
        </Card>
        {!wide && image}
      </View>
    </View>
  );
}

// Kazanım araması: yazdıkça veritabanındaki liste süzülür (web ile aynı uç nokta).
function OutcomesList() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);
  const { data, error } = useList(useCallback(async () => (await api<{ outcomes: OutcomeInfo[]; limit: number }>(`/api/admin/outcomes?q=${encodeURIComponent(debounced)}`)).outcomes, [debounced]));
  return (
    <>
      <TextInput style={styles.search} value={query} onChangeText={setQuery} placeholder="Kazanım ara (kod veya açıklama)" autoCorrect={false} accessibilityLabel="Kazanım ara" />
      <Status error={error} loading={!data} empty={data?.length === 0 && 'Sonuç yok.'} />
      <Grid>
      {data?.map((o) => (
        <Cell key={o.id}><Card>
          <View style={styles.between}>
            <Text style={styles.bold}>{o.code}</Text>
            {o.branch && <Badge label={o.branch} />}
          </View>
          <Text style={{ color: colors.ink }}>{o.description}</Text>
        </Card></Cell>
      ))}
      </Grid>
    </>
  );
}

function AssignmentsList({ status }: { status: AssignmentStatus }) {
  const { data, error } = useList(useCallback(async () => (await api<{ assignments: AssignmentInfo[] }>(`/api/admin/assignments?status=${status}`)).assignments, [status]));
  const [open, setOpen] = useState<string | null>(null); // videosu açık olan atama
  return (
    <>
      <Status error={error} loading={!data} empty={data?.length === 0 && 'Bu durumda atama yok.'} />
      <Grid>
      {data?.map((a) => (
        <Cell key={a.id}><Card>
          <View style={styles.between}>
            <Text style={styles.bold}>{a.branch} — {a.questionNumber ? `Soru ${a.questionNumber}` : 'Soru'}</Text>
            <StatusBadge status={a.status} />
          </View>
          <Text style={styles.small}>{a.teacherName} · Atanma: {new Date(a.assignedAt).toLocaleString('tr-TR')}</Text>
          {a.returnNote && <Text style={{ color: colors.danger }}>Not: {a.returnNote}</Text>}
          {a.recording && (open === a.id ? <VideoBox url={abs(a.recording.videoUrl)} /> : <Button label="Videoyu izle" variant="ghost" onPress={() => setOpen(a.id)} />)}
        </Card></Cell>
      ))}
      </Grid>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  bold: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  small: { fontSize: 12, color: colors.muted },
  empty: { color: colors.muted, textAlign: 'center', padding: 24 },
  key: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.sage, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  keyOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  keyText: { fontSize: 17, fontWeight: '800', color: colors.ink },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  result: { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff7f3' },
  imageBox: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 8 },
  thumb: { width: 72, height: 56, backgroundColor: '#fff', marginRight: 10 },
  search: { borderWidth: 1, borderColor: colors.sage, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: colors.ink, backgroundColor: colors.white },
});
