// Çapraz kontrol (öğretmen): aynı soruya atanmış başka bir öğretmenin çözümünü "Hatasız" veya "Hatalı" diye değerlendirir.
// Not isteğe bağlıdır. Değerlendirme yalnızca yöneticiye görünür; videonun sahibi görmez. Web ile aynı uç nokta ve kurallar.
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PEER_NOTE_MAX, PEER_VERDICT_LABEL, type MyPeerCheck, type PeerVerdict } from '@app/shared';
import { api } from '../api';
import { colors } from '../theme';
import { Button, ErrorText } from '.';

type Props = { assignmentId: string; recordingId: string; initial: MyPeerCheck | null };

export function PeerCheck({ assignmentId, recordingId, initial }: Props) {
  const [check, setCheck] = useState<MyPeerCheck | null>(initial);
  const [note, setNote] = useState(initial?.note ?? '');
  const [busy, setBusy] = useState<PeerVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(verdict: PeerVerdict) {
    setBusy(verdict);
    setError(null);
    try {
      const r = await api<{ check: MyPeerCheck }>(`/api/teacher/assignments/${assignmentId}/peer-check`, { method: 'PUT', body: { recordingId, verdict, note } });
      setCheck(r.check);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Değerlendirme kaydedilemedi.');
    } finally {
      setBusy(null);
    }
  }

  const label = (v: PeerVerdict) => (check?.verdict === v ? `✓ ${PEER_VERDICT_LABEL[v]}` : PEER_VERDICT_LABEL[v]);

  return (
    <View style={styles.box} testID="peer-box">
      <Text style={styles.title}>Bu çözümü değerlendirin</Text>
      <TextInput style={styles.input} value={note} onChangeText={setNote} maxLength={PEER_NOTE_MAX} multiline placeholder="Not (isteğe bağlı)" accessibilityLabel="Not" />
      <View style={styles.row}>
        <Button label={label('correct')} variant="accent" onPress={() => void save('correct')} busy={busy === 'correct'} disabled={busy !== null} style={{ flex: 1 }} />
        <Button label={label('faulty')} variant="accent" onPress={() => void save('faulty')} busy={busy === 'faulty'} disabled={busy !== null} style={{ flex: 1 }} />
      </View>
      {check && <Text style={styles.small}>Değerlendirmeniz kaydedildi: {PEER_VERDICT_LABEL[check.verdict]}</Text>}
      {error && <ErrorText>{error}</ErrorText>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, marginTop: 6, padding: 10, backgroundColor: colors.bg, borderRadius: 10 },
  title: { fontWeight: '700', color: colors.ink, fontSize: 14 },
  input: { minHeight: 60, borderWidth: 1, borderColor: colors.sage, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.ink, backgroundColor: colors.white, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8 },
  small: { color: colors.muted, fontSize: 12 },
});
