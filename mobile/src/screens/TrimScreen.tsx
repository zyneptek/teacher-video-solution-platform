// Kayıt düzenleme (kırp / bölüm sil): videoda bir aralık seçilir; "Yalnızca bu aralığı tut" (baştan/sondan kırpma) veya
// "Bu aralığı sil" (ortadan kesme). Sunucu düzenlenmiş MP4'ü kaydın yerine koyar; birden fazla düzenleme yapılabilir.
import Slider from '@react-native-community/slider';
import type { VideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TeacherAssignment } from '@app/shared';
import { abs, api } from '../api';
import type { Nav } from '../nav';
import { colors } from '../theme';
import { Button, ErrorText, Notice } from '../ui';
import { useWide, useWidePortrait } from '../ui/layout';
import { VideoBox } from '../ui/VideoBox';

const MIN_RANGE = 0.1;
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

export function TrimScreen({ id, nav }: { id: string; nav: Nav }) {
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const portraitTablet = useWidePortrait();
  const [assignment, setAssignment] = useState<TeacherAssignment | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const player = useRef<VideoPlayer | null>(null);

  function load(a: TeacherAssignment) {
    setAssignment(a);
    const total = a.recording?.durationSeconds ?? 0;
    setStart(0);
    setEnd(Math.min(total, Math.max(MIN_RANGE, total / 2)));
  }

  useEffect(() => {
    api<{ assignment: TeacherAssignment }>(`/api/teacher/assignments/${id}`)
      .then((r) => load(r.assignment))
      .catch((err) => setError(err instanceof Error ? err.message : 'Kayıt yüklenemedi.'));
  }, [id]);

  const recording = assignment?.recording;
  if (!recording) {
    return (
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]} style={{ backgroundColor: colors.bg }}>
        <Button label="← Geri" variant="ghost" onPress={nav.pop} style={{ alignSelf: 'flex-start' }} />
        {error ? <ErrorText>{error}</ErrorText> : <Text style={{ color: colors.muted }}>{assignment ? 'Düzenlenecek kayıt yok.' : 'Yükleniyor…'}</Text>}
      </ScrollView>
    );
  }
  const total = Math.max(recording.durationSeconds, MIN_RANGE * 2);

  function changeStart(v: number) {
    const value = Math.max(0, Math.min(v, end - MIN_RANGE));
    setStart(value);
    if (player.current) player.current.currentTime = value;
  }
  function changeEnd(v: number) {
    const value = Math.min(total, Math.max(v, start + MIN_RANGE));
    setEnd(value);
    if (player.current) player.current.currentTime = value;
  }

  async function apply(op: 'keep' | 'cut') {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await api<{ assignment: TeacherAssignment }>(`/api/teacher/assignments/${id}/recording/edit`, { method: 'POST', body: { op, start, end } });
      load(r.assignment);
      setDone(op === 'keep' ? 'Seçilen aralık tutuldu, kalan kısım kırpıldı.' : 'Seçilen aralık videodan silindi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt düzenlenemedi.');
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await api<{ assignment: TeacherAssignment }>(`/api/teacher/assignments/${id}/recording/undo`, { method: 'POST' });
      load(r.assignment);
      setDone('Son düzenleme geri alındı.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Düzenleme geri alınamadı.');
    } finally {
      setBusy(false);
    }
  }

  const keepSeconds = end - start;
  const cutSeconds = total - keepSeconds;

  const compact = wide && !portraitTablet; // yatay tablet: video geniş, ayarlar dar ve küçük
  const startControls = (
    <View style={{ gap: 10 }}>
      <Text style={styles.label}>Aralık başlangıcı: {fmt(start)}</Text>
      <Slider minimumValue={0} maximumValue={total} step={0.1} value={start} onValueChange={changeStart} minimumTrackTintColor={colors.brand} thumbTintColor={colors.brand} />
      <Button label="Mevcut konumu başlangıç yap" variant="accent" compact={compact} onPress={() => changeStart(player.current?.currentTime ?? 0)} />
    </View>
  );
  const endControls = (
    <View style={{ gap: 10 }}>
      <Text style={styles.label}>Aralık bitişi: {fmt(end)}</Text>
      <Slider minimumValue={0} maximumValue={total} step={0.1} value={end} onValueChange={changeEnd} minimumTrackTintColor={colors.brand} thumbTintColor={colors.brand} />
      <Button label="Mevcut konumu bitiş yap" variant="accent" compact={compact} onPress={() => changeEnd(player.current?.currentTime ?? total)} />
    </View>
  );
  const summary = (
    <>
      <Text style={styles.small}>Seçili aralık: {keepSeconds.toFixed(1)} sn · Toplam: {total.toFixed(1)} sn</Text>
      {done && <Notice>{done}</Notice>}
      {error && <ErrorText>{error}</ErrorText>}
    </>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[styles.content, wide && { maxWidth: 1240, paddingHorizontal: 24 }, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}>
      <Button label="← Geri" variant="ghost" onPress={nav.pop} style={{ alignSelf: 'flex-start' }} />
      <Text style={styles.title}>Kaydı düzenle</Text>
      {portraitTablet ? (
        // Dikey tablet: video tam genişlikte üstte, ayarlar altında; hepsi tek ekrana sığar.
        <View style={{ gap: 12 }}>
          <VideoBox key={recording.videoUrl} url={abs(recording.videoUrl)} onPlayer={(p) => (player.current = p)} />
          <View style={styles.row}>
            <View style={styles.half}>{startControls}</View>
            <View style={styles.half}>{endControls}</View>
          </View>
          {summary}
          <View style={styles.row}>
            <Button label="Yalnızca bu aralığı tut" variant="accent" onPress={() => void apply('keep')} busy={busy} disabled={keepSeconds < 1} style={{ flex: 1 }} />
            <Button label="Bu aralığı sil" variant="accent" onPress={() => void apply('cut')} disabled={busy || cutSeconds < 1} style={{ flex: 1 }} />
            <Button label="↶ Geri al" variant="accent" onPress={() => void undo()} disabled={busy || !recording.canUndo} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <View style={wide ? { flexDirection: 'row', gap: 20, alignItems: 'flex-start' } : { gap: 10 }}>
          <View style={wide ? { flex: 7 } : undefined}>
            <VideoBox key={recording.videoUrl} url={abs(recording.videoUrl)} onPlayer={(p) => (player.current = p)} />
          </View>
          <View style={[{ gap: compact ? 8 : 10 }, wide && { flex: 3 }]}>
            {startControls}
            {endControls}
            {summary}
            <Button label="Yalnızca bu aralığı tut" variant="accent" compact={compact} onPress={() => void apply('keep')} busy={busy} disabled={keepSeconds < 1} />
            <Button label="Bu aralığı sil" variant="accent" compact={compact} onPress={() => void apply('cut')} disabled={busy || cutSeconds < 1} />
            <Button label="↶ Geri al" variant="accent" compact={compact} onPress={() => void undo()} disabled={busy || !recording.canUndo} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 10, width: '100%', maxWidth: 760, alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  label: { fontWeight: '700', color: colors.ink, marginTop: 4 },
  small: { fontSize: 12, color: colors.muted },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
});
