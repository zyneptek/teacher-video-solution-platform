// Durum listesi: ana sayfadaki bir sayı kartına dokununca o durumdaki sorular listelenir.
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ASSIGNMENT_STATUS_LABEL, type AssignmentStatus, type TeacherAssignment } from '@app/shared';
import { api } from '../api';
import type { Nav } from '../nav';
import { colors } from '../theme';
import { Button, ErrorText } from '../ui';
import { AssignmentRow } from '../ui/AssignmentRow';
import { useWide } from '../ui/layout';
import { useList } from '../ui/useList';

export function ListScreen({ status, nav }: { status: AssignmentStatus; nav: Nav }) {
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const { data, error, refreshControl } = useList(useCallback(async () => (await api<{ assignments: TeacherAssignment[] }>('/api/teacher/assignments')).assignments.filter((a) => a.status === status), [status]));
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} refreshControl={refreshControl} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
      <Button label="← Geri" variant="ghost" onPress={nav.pop} style={{ alignSelf: 'flex-start' }} />
      <Text style={styles.title}>{ASSIGNMENT_STATUS_LABEL[status]}</Text>
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !error && <Text style={{ color: colors.muted }}>Yükleniyor…</Text>}
      {data && data.length === 0 && <Text style={styles.empty}>Bu durumda soru yok.</Text>}
      <View style={wide ? { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } : { gap: 12 }}>
        {data?.map((a) => (
          <AssignmentRow key={a.id} assignment={a} wide={wide} onPress={() => nav.push({ name: 'question', id: a.id })} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 12, width: '100%', maxWidth: 1240, alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  empty: { color: colors.muted, textAlign: 'center', padding: 24 },
});
