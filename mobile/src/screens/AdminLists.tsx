// Yönetici liste sayfaları (salt okunur): Öğretmenler, Sorular, Kazanımlar (arama) ve duruma göre Atamalar.
// Panel kartlarına dokununca açılır; düzenleme ve atama işlemleri web panelindedir.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ASSIGNMENT_STATUS_LABEL, type AssignmentDelivery, type AssignmentInfo, type AssignmentStatus, type OutcomeInfo, type QuestionInfo, type TeacherInfo } from '@app/shared';
import { abs, api } from '../api';
import { colors } from '../theme';
import { Badge, Button, Card, ErrorText, Notice, StatusBadge } from '../ui';
import { useWide } from '../ui/layout';
import { useList } from '../ui/useList';
import { VideoBox } from '../ui/VideoBox';

export type AdminPage = { name: 'teachers' } | { name: 'questions' } | { name: 'question'; question: QuestionInfo } | { name: 'outcomes' } | { name: 'assignments'; status: AssignmentStatus };

export function pageTitle(page: AdminPage): string {
  if (page.name === 'teachers') return 'Öğretmenler';
  if (page.name === 'questions') return 'Sorular';
  if (page.name === 'question') return `${page.question.branch} sorusu${page.question.questionNumber ? ` (Soru ${page.question.questionNumber})` : ''}`;
  if (page.name === 'outcomes') return 'Kazanımlar';
  return ASSIGNMENT_STATUS_LABEL[page.status];
}

export function AdminPageView({ page, onBack, open }: { page: AdminPage; onBack: () => void; open: (p: AdminPage) => void }) {
  return (
    <Shell title={pageTitle(page)} onBack={page.name === 'question' ? () => open({ name: 'questions' }) : onBack} backLabel={page.name === 'question' ? '← Sorular' : '← Panel'}>
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
        <Cell key={q.id}><Pressable onPress={() => open({ name: 'question', question: q })} testID="question-row"><Card style={{ flexDirection: 'row', alignItems: 'center' }}>
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
function QuestionDetail({ question: q }: { question: QuestionInfo }) {
  const wide = useWide();
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

  return (
    <View style={wide ? { flexDirection: 'row', gap: 16, alignItems: 'flex-start' } : { gap: 12 }}>
      <View style={wide ? { flex: 1 } : undefined}>
        {q.imageUrl && (
          <View style={styles.imageBox}>
            <Image source={{ uri: abs(q.imageUrl) }} style={{ width: '100%', aspectRatio: ratio }} resizeMode="contain" />
          </View>
        )}
      </View>
      <View style={[{ gap: 12 }, wide && { flex: 1 }]}>
        <Card>
          <View style={styles.between}>
            <Text style={styles.bold}>Cevap anahtarı</Text>
            <Badge label={q.answerKey} tone="brand" />
          </View>
          <Text style={styles.bold}>Kazanımlar</Text>
          {q.outcomes.map((o) => (
            <Text key={o.id} style={{ color: colors.ink, fontSize: 14 }}><Text style={{ fontWeight: '800' }}>{o.code}</Text> {o.description}</Text>
          ))}
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
  imageBox: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 8 },
  thumb: { width: 72, height: 56, backgroundColor: '#fff', marginRight: 10 },
  search: { borderWidth: 1, borderColor: colors.sage, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: colors.ink, backgroundColor: colors.white },
});
