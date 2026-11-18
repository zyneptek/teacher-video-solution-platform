// Kayıt kırpma: başlangıç ve bitiş kaydırıcılarıyla (veya videonun mevcut konumuyla) aralık seçilir; sunucu
// kırpılmış MP4'ü kaydın yerine koyar (geri alınamaz).
import Slider from '@react-native-community/slider';
import type { VideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TeacherAssignment } from '@app/shared';
import { abs, api } from '../api';
import type { Nav } from '../nav';
import { colors } from '../theme';
import { Button, ErrorText } from '../ui';
import { VideoBox } from '../ui/VideoBox';

const MIN_SECONDS = 1;
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

export function TrimScreen({ id, nav }: { id: string; nav: Nav }) {
  const insets = useSafeAreaInsets();
  const [assignment, setAssignment] = useState<TeacherAssignment | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const player = useRef<VideoPlayer | null>(null);

  useEffect(() => {
    api<{ assignment: TeacherAssignment }>(`/api/teacher/assignments/${id}`)
      .then((r) => {
        setAssignment(r.assignment);
        setEnd(r.assignment.recording?.durationSeconds ?? 0);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Kayıt yüklenemedi.'));
  }, [id]);

  const recording = assignment?.recording;
  if (!recording) {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
        <Button label="← Geri" variant="ghost" onPress={nav.pop} />
        {error ? <ErrorText>{error}</ErrorText> : <Text style={{ color: colors.muted }}>{assignment ? 'Kırpılacak kayıt yok.' : 'Yükleniyor…'}</Text>}
      </View>
    );
  }
  const total = Math.max(recording.durationSeconds, MIN_SECONDS);

  function changeStart(v: number) {
    const value = Math.max(0, Math.min(v, end - MIN_SECONDS));
    setStart(value);
    if (player.current) player.current.currentTime = value;
  }
  function changeEnd(v: number) {
    const value = Math.min(total, Math.max(v, start + MIN_SECONDS));
    setEnd(value);
    if (player.current) player.current.currentTime = value;
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/teacher/assignments/${id}/recording/trim`, { method: 'POST', body: { start, end } });
      nav.pop();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt kırpılamadı.');
      setBusy(false);
    }
  }

  const unchanged = start <= 0.05 && end >= total - 0.05;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}>
      <Button label="← Geri" variant="ghost" onPress={nav.pop} style={{ alignSelf: 'flex-start' }} />
      <Text style={styles.title}>Kaydı kırp</Text>
      <VideoBox url={abs(recording.videoUrl)} onPlayer={(p) => (player.current = p)} />
      <Text style={styles.label}>Başlangıç: {fmt(start)}</Text>
      <Slider minimumValue={0} maximumValue={total} step={0.1} value={start} onValueChange={changeStart} minimumTrackTintColor={colors.brand} thumbTintColor={colors.brand} />
      <Button label="Mevcut konumu başlangıç yap" variant="ghost" onPress={() => changeStart(player.current?.currentTime ?? 0)} />
      <Text style={styles.label}>Bitiş: {fmt(end)}</Text>
      <Slider minimumValue={0} maximumValue={total} step={0.1} value={end} onValueChange={changeEnd} minimumTrackTintColor={colors.brand} thumbTintColor={colors.brand} />
      <Button label="Mevcut konumu bitiş yap" variant="ghost" onPress={() => changeEnd(player.current?.currentTime ?? total)} />
      <Text style={styles.small}>Kırpılmış süre: {(end - start).toFixed(1)} sn (özgün: {total.toFixed(1)} sn). Kırpma kaydın yerine geçer ve geri alınamaz.</Text>
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Kırp ve kaydet" onPress={() => void save()} busy={busy} disabled={unchanged} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 },
  content: { paddingHorizontal: 16, gap: 10, width: '100%', maxWidth: 760, alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  label: { fontWeight: '700', color: colors.ink, marginTop: 4 },
  small: { fontSize: 12, color: colors.muted },
});
