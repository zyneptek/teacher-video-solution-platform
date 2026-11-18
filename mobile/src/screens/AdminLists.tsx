// Yönetici liste sayfaları (salt okunur): Öğretmenler, Sorular, Kazanımlar (arama) ve duruma göre Atamalar.
// Panel kartlarına dokununca açılır; düzenleme ve atama işlemleri web panelindedir.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ASSIGNMENT_STATUS_LABEL, type AssignmentInfo, type AssignmentStatus, type OutcomeInfo, type QuestionInfo, type TeacherInfo } from '@app/shared';
import { abs, api } from '../api';
import { colors } from '../theme';
import { Badge, Button, Card, ErrorText, StatusBadge } from '../ui';
import { useWide } from '../ui/layout';
import { useList } from '../ui/useList';
import { VideoBox } from '../ui/VideoBox';

export type AdminPage = { name: 'teachers' } | { name: 'questions' } | { name: 'outcomes' } | { name: 'assignments'; status: AssignmentStatus };

export function pageTitle(page: AdminPage): string {
  if (page.name === 'teachers') return 'Öğretmenler';
  if (page.name === 'questions') return 'Sorular';
  if (page.name === 'outcomes') return 'Kazanımlar';
  return ASSIGNMENT_STATUS_LABEL[page.status];
}

export function AdminPageView({ page, onBack }: { page: AdminPage; onBack: () => void }) {
  return (
    <Shell title={pageTitle(page)} onBack={onBack}>
      {page.name === 'teachers' && <TeachersList />}
      {page.name === 'questions' && <QuestionsList />}
      {page.name === 'outcomes' && <OutcomesList />}
      {page.name === 'assignments' && <AssignmentsList status={page.status} />}
    </Shell>
  );
}

function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
      <Button label="← Panel" variant="ghost" onPress={onBack} style={{ alignSelf: 'flex-start' }} />
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

function QuestionsList() {
  const wide = useWide();
  const { data, error } = useList(useCallback(async () => (await api<{ questions: QuestionInfo[] }>('/api/admin/questions')).questions, []));
  return (
    <>
      <Status error={error} loading={!data} empty={data?.length === 0 && 'Soru yok.'} />
      <Grid>
      {data?.map((q) => (
        <Cell key={q.id}><Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          {q.imageUrl && <Image source={{ uri: abs(q.imageUrl) }} style={[styles.thumb, wide && { width: 110, height: 90 }]} resizeMode="contain" />}
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Badge label={q.branch} />
              <Text style={styles.bold}>{q.questionNumber ? `Soru ${q.questionNumber}` : 'Soru'}</Text>
            </View>
            <Text style={styles.small} numberOfLines={1}>{q.outcomes.map((o) => o.code).join(', ')}</Text>
            <Text style={styles.small}>Cevap: {q.answerKey} · {q.assignmentCount} atama</Text>
          </View>
        </Card></Cell>
      ))}
      </Grid>
    </>
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
  thumb: { width: 72, height: 56, backgroundColor: '#fff', marginRight: 10 },
  search: { borderWidth: 1, borderColor: colors.sage, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: colors.ink, backgroundColor: colors.white },
});
