// Öğretmenin soru satırı: görsel, branş, soru no, kazanım kodları ve çözüm durumu. Ana sayfa ve durum listesinde ortak.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ASSIGNMENT_STATUS_LABEL, type TeacherAssignment } from '@app/shared';
import { abs } from '../api';
import { colors } from '../theme';
import { Badge, Card, StatusBadge } from '.';

function solutionHint(a: TeacherAssignment): string {
  if (a.status === 'assigned') return a.recording ? 'Kayıt hazır, onaya gönderilmedi' : 'Kayıt bekleniyor';
  if (a.status === 'returned') return a.recording ? 'Düzeltip yeniden gönderin' : 'Yeni kayıt gerekli';
  return ASSIGNMENT_STATUS_LABEL[a.status];
}

export function AssignmentRow({ assignment: a, onPress, wide }: { assignment: TeacherAssignment; onPress: () => void; wide?: boolean }) {
  return (
    <Pressable style={wide ? { width: '48.9%' } : undefined} onPress={onPress} testID="assignment-card">
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
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 72, height: 56, backgroundColor: '#fff' },
  small: { fontSize: 12, color: colors.muted },
});
