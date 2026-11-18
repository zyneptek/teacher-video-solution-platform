// Hata bildirimi: tür (altı hazır tür + Diğer), kısa açıklama, sorunun görseli üzerinde hata yerini işaretleme ve
// isteğe bağlı ek (ekran görüntüsü veya en fazla 1 dakikalık video).
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ERROR_REPORT_LIMITS, ERROR_REPORT_TYPES, type ErrorReportType, type TeacherAssignment } from '@app/shared';
import { abs, api } from '../api';
import type { Nav } from '../nav';
import { colors } from '../theme';
import { Button, ErrorText, Notice } from '../ui';

const MB = 1024 * 1024;

export function ReportScreen({ id, nav }: { id: string; nav: Nav }) {
  const insets = useSafeAreaInsets();
  const [assignment, setAssignment] = useState<TeacherAssignment | null>(null);
  const [type, setType] = useState<ErrorReportType | ''>('');
  const [description, setDescription] = useState('');
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);
  const [picking, setPicking] = useState(false);
  const [ratio, setRatio] = useState(0.7);
  const [attachment, setAttachment] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [box, setBox] = useState({ w: 1, h: 1 }); // görsel kutusunun ölçüsü (işaret konumu 0..1 oransal saklanır)

  useEffect(() => {
    api<{ assignment: TeacherAssignment }>(`/api/teacher/assignments/${id}`)
      .then((r) => {
        setAssignment(r.assignment);
        Image.getSize(abs(r.assignment.question.imageUrl), (w, h) => setRatio(w / h), () => undefined);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Soru yüklenemedi.'));
  }, [id]);

  async function pickAttachment() {
    setFileError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], videoMaxDuration: ERROR_REPORT_LIMITS.videoSeconds, quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.type === 'video') {
      if (asset.duration && asset.duration / 1000 > ERROR_REPORT_LIMITS.videoSeconds + 1) return setFileError('Ek video en fazla 1 dakika olabilir.');
      if (asset.fileSize && asset.fileSize > ERROR_REPORT_LIMITS.videoBytes) return setFileError(`Video en fazla ${ERROR_REPORT_LIMITS.videoBytes / MB} MB olabilir.`);
    } else if (asset.fileSize && asset.fileSize > ERROR_REPORT_LIMITS.imageBytes) {
      return setFileError('Ekran görüntüsü en fazla 5 MB olabilir.');
    }
    setAttachment(asset);
  }

  async function submit() {
    if (!type) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('type', type);
      form.append('description', description);
      if (marker) {
        form.append('markerX', String(marker.x));
        form.append('markerY', String(marker.y));
      }
      // expo/fetch, expo-file-system'ın File nesnesini dosya parçası olarak yükler (bkz. src/api.ts).
      if (attachment) form.append('attachment', new File(attachment.uri));
      await api(`/api/teacher/assignments/${id}/error-reports`, { method: 'POST', form });
      nav.pop();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata bildirimi gönderilemedi.');
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Button label="← Geri" variant="ghost" onPress={nav.pop} style={{ alignSelf: 'flex-start' }} />
        <Text style={styles.title}>Hata bildir</Text>

        <Text style={styles.label}>Hata türü</Text>
        <View style={styles.chips}>
          {ERROR_REPORT_TYPES.map((t) => (
            <Pressable key={t.value} onPress={() => setType(t.value)} style={[styles.chip, type === t.value && styles.chipOn]} testID={`type-${t.value}`}>
              <Text style={[styles.chipText, type === t.value && { color: '#fff' }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Kısa açıklama {type === 'other' ? '(zorunlu)' : '(isteğe bağlı)'}</Text>
        <TextInput style={styles.textarea} value={description} onChangeText={setDescription} multiline maxLength={ERROR_REPORT_LIMITS.descriptionMax} placeholder="Hatayı kısaca anlatın" accessibilityLabel="Açıklama" />

        <Text style={styles.label}>Hatanın yeri (isteğe bağlı)</Text>
        <Button label={picking ? 'Görsele dokunun…' : marker ? 'İşareti değiştir' : 'Görselde hatayı işaretle'} variant={picking ? 'primary' : 'ghost'} onPress={() => setPicking(!picking)} />
        {assignment && (
          <Pressable
            disabled={!picking}
            onPress={(e) => {
              const { locationX, locationY } = e.nativeEvent;
              setMarker({ x: Math.min(1, Math.max(0, locationX / box.w)), y: Math.min(1, Math.max(0, locationY / box.h)) });
              setPicking(false);
            }}
            onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            style={[styles.imageBox, picking && { borderColor: colors.brand, borderWidth: 3 }]}
          >
            <Image source={{ uri: abs(assignment.question.imageUrl) }} style={{ width: '100%', aspectRatio: ratio }} resizeMode="contain" />
            {marker && <View pointerEvents="none" style={[styles.pin, { left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }]} />}
          </Pressable>
        )}
        {marker && <Button label="İşareti kaldır" variant="ghost" onPress={() => setMarker(null)} />}

        <Text style={styles.label}>Ek (ekran görüntüsü veya en fazla 1 dakikalık video, isteğe bağlı)</Text>
        <Button label={attachment ? 'Eki değiştir' : 'Dosya seç'} variant="ghost" onPress={() => void pickAttachment()} />
        {attachment && <Notice>Seçilen ek: {attachment.type === 'video' ? 'video' : 'görüntü'}{attachment.fileName ? ` (${attachment.fileName})` : ''}</Notice>}
        {fileError && <ErrorText>{fileError}</ErrorText>}
        {error && <ErrorText>{error}</ErrorText>}
        <Button label="Gönder" onPress={() => void submit()} busy={busy} disabled={!type || (type === 'other' && !description.trim())} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 10, width: '100%', maxWidth: 760, alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  label: { fontWeight: '700', color: colors.ink, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.sage, backgroundColor: '#fff' },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.ink, fontWeight: '600', fontSize: 13 },
  textarea: { minHeight: 90, borderWidth: 1, borderColor: colors.sage, borderRadius: 10, padding: 10, fontSize: 15, backgroundColor: '#fff', textAlignVertical: 'top', color: colors.ink },
  imageBox: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  pin: { position: 'absolute', width: 26, height: 26, marginLeft: -13, marginTop: -13, borderRadius: 13, borderWidth: 3, borderColor: '#e11d48', backgroundColor: 'rgba(225,29,72,0.18)' },
});
