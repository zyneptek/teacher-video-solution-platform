// Soru sayfası: soru görseli, durum, çözüm kaydı (izle, yeniden kaydet, kırp, sil, onaya gönder),
// çapraz atamada onaylı örnek video, kazanımlar ve hata bildirimi.
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ASSIGNMENT_STATUS_LABEL, ERROR_REPORT_TYPES, type ErrorReportInfo, type TeacherAssignment } from '@app/shared';
import { abs, api } from '../api';
import type { Nav } from '../nav';
import { colors } from '../theme';
import { Button, Card, ErrorText, StatusBadge } from '../ui';
import { useWide } from '../ui/layout';
import { PeerCheck } from '../ui/PeerCheck';
import { VideoBox } from '../ui/VideoBox';

export function QuestionScreen({ id, nav }: { id: string; nav: Nav }) {
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const [assignment, setAssignment] = useState<TeacherAssignment | null>(null);
  const [reports, setReports] = useState<ErrorReportInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imageRatio, setImageRatio] = useState(0.7);

  const load = useCallback(async () => {
    try {
      const r = await api<{ assignment: TeacherAssignment }>(`/api/teacher/assignments/${id}`);
      setAssignment(r.assignment);
      setError(null);
      Image.getSize(abs(r.assignment.question.imageUrl), (w, h) => setImageRatio(w / h), () => undefined);
      api<{ reports: ErrorReportInfo[] }>(`/api/teacher/assignments/${id}/error-reports`).then((x) => setReports(x.reports)).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Soru yüklenemedi.');
    }
  }, [id]);

  // Başka ekrandan (kayıt, kırpma, hata bildirimi) dönünce yenilenir.
  useEffect(() => {
    void load();
  }, [load]);

  async function act(path: string, method: 'POST' | 'DELETE') {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ assignment: TeacherAssignment }>(`/api/teacher/assignments/${id}${path}`, { method });
      setAssignment(r.assignment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem yapılamadı.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Kayıt silinsin mi?', 'Onaya gönderilmişse yönetici de artık izleyemez.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => void act('/recording', 'DELETE') },
    ]);
  }

  if (error && !assignment) {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={nav.pop}><Text style={styles.back}>← Geri</Text></Pressable>
        <ErrorText>{error}</ErrorText>
      </View>
    );
  }
  if (!assignment) return <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}><Text style={{ color: colors.muted }}>Yükleniyor…</Text></View>;

  const q = assignment.question;
  const canSubmit = !!assignment.recording && (assignment.status === 'assigned' || assignment.status === 'returned');

  const outcomesCard = (
    <Card>
      <Text style={styles.bold}>Kazanımlar</Text>
      {q.outcomes.map((o) => (
        <Text key={o.id} style={{ color: colors.ink, fontSize: 14 }}><Text style={{ fontWeight: '800' }}>{o.code}</Text> {o.description}</Text>
      ))}
    </Card>
  );

  const reportCard = (
    <Card>
      <View style={styles.between}>
        <Text style={styles.bold}>Soruda hata mı var?</Text>
        <Button label="Hata bildir" variant="ghost" onPress={() => nav.push({ name: 'report', id })} />
      </View>
      {reports.length > 0 && <Text style={styles.small}>Gönderdiğiniz bildirimler</Text>}
      {reports.map((r) => (
        <View key={r.id} style={styles.report}>
          <Text style={{ fontWeight: '700', color: colors.ink }}>{ERROR_REPORT_TYPES.find((t) => t.value === r.type)?.label}</Text>
          {!!r.description && <Text style={{ color: colors.ink }}>{r.description}</Text>}
          <Text style={styles.small}>{new Date(r.createdAt).toLocaleString('tr-TR')}{r.marker ? ' · görselde işaretli' : ''}{r.attachment ? ` · ek: ${r.attachment.type === 'video' ? 'video' : 'görüntü'}` : ''}</Text>
        </View>
      ))}
    </Card>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[styles.content, wide && styles.contentWide, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}>
      <Pressable onPress={nav.pop} hitSlop={16} style={styles.backBtn} testID="back"><Text style={styles.back}>← Sorularım</Text></Pressable>
      <Text style={styles.title}>{q.branch} sorusu{q.questionNumber ? ` (Soru ${q.questionNumber})` : ''}</Text>
      {error && <ErrorText>{error}</ErrorText>}

      <View style={wide ? styles.cols : { gap: 12 }}>
      <View style={wide ? styles.colLeft : undefined}>
      <View style={styles.imageBox}>
        <Image source={{ uri: abs(q.imageUrl) }} style={{ width: '100%', aspectRatio: imageRatio }} resizeMode="contain" />
      </View>
      </View>

      <View style={wide ? styles.colRight : { gap: 12 }}>
      <Card>
        <View style={styles.between}>
          <Text style={styles.bold}>Durum</Text>
          <StatusBadge status={assignment.status} />
        </View>
        {assignment.status === 'returned' && assignment.returnNote && (
          <View style={styles.returnNote} testID="return-note">
            <Text style={{ color: colors.danger }}><Text style={{ fontWeight: '800' }}>Yöneticinin notu: </Text>{assignment.returnNote}</Text>
          </View>
        )}
        <Text style={styles.small}>Atanma: {new Date(assignment.assignedAt).toLocaleString('tr-TR')}</Text>
      </Card>

      {outcomesCard}

      <Card>
        <Text style={styles.bold}>Çözüm kaydı</Text>
        {assignment.recording ? (
          <>
            <VideoBox key={assignment.recording.videoUrl} url={abs(assignment.recording.videoUrl)} />
            <Text style={styles.small}>Süre: {Math.round(assignment.recording.durationSeconds)} sn · Kaydedilme: {new Date(assignment.recording.updatedAt).toLocaleString('tr-TR')}</Text>
            {canSubmit && <Button label={assignment.status === 'returned' ? 'Yeniden onaya gönder' : 'Onaya gönder'} variant="accent" onPress={() => void act('/submit', 'POST')} busy={busy} />}
            <View style={styles.actions}>
              <Button label="Yeniden kaydet" variant="accent" onPress={() => nav.push({ name: 'record', id })} style={{ flex: 1 }} />
              <Button label="Düzenle" variant="accent" onPress={() => nav.push({ name: 'trim', id })} style={{ flex: 1 }} />
              <Button label="Sil" variant="accent" onPress={confirmDelete} disabled={busy} style={{ flex: 1 }} />
            </View>
          </>
        ) : (
          <>
            <Text style={{ color: colors.muted }}>Bu soru için henüz kayıt oluşturmadınız.</Text>
            <Button label="Kayıt oluştur" onPress={() => nav.push({ name: 'record', id })} />
          </>
        )}
      </Card>

      {assignment.referenceVideos && assignment.referenceVideos.length > 0 && (
        <Card>
          <Text style={styles.bold}>Bu soru için mevcut çözüm videoları</Text>
          {assignment.referenceVideos.map((v) => (
            <View key={`${v.recording.id}-${v.recording.updatedAt}`} style={{ gap: 4 }}>
              <Text style={styles.small}>{v.teacherName} · {ASSIGNMENT_STATUS_LABEL[v.status]}</Text>
              <VideoBox url={abs(v.recording.videoUrl)} />
              <PeerCheck assignmentId={assignment.id} recordingId={v.recording.id} initial={v.myCheck} />
            </View>
          ))}
        </Card>
      )}

      {reportCard}
      </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 },
  content: { paddingHorizontal: 16, gap: 12, width: '100%', maxWidth: 760, alignSelf: 'center' },
  contentWide: { maxWidth: 1240, paddingHorizontal: 24 },
  cols: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  colLeft: { flex: 1 },
  colRight: { flex: 1, gap: 12 },
  backBtn: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  back: { color: colors.brandDark, fontWeight: '700', fontSize: 15, paddingVertical: 6 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  imageBox: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  bold: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  small: { fontSize: 12, color: colors.muted },
  actions: { flexDirection: 'row', gap: 8 },
  returnNote: { backgroundColor: '#f5dcdc', borderRadius: 8, padding: 10 },
  report: { backgroundColor: colors.bg, borderRadius: 8, padding: 10, gap: 2 },
});
