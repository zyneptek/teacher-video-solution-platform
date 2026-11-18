// Kayıt rotası: soruyu sunucudan okuyup stüdyoyu açar (soru görseli ve atama bilgisi stüdyoya verilir).
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { TeacherAssignment } from '@app/shared';
import { api } from '../api';
import type { Nav } from '../nav';
import { colors } from '../theme';
import { Button, ErrorText } from '../ui';
import { StudioScreen } from '../studio/StudioScreen';

export function RecordRoute({ id, nav }: { id: string; nav: Nav }) {
  const [assignment, setAssignment] = useState<TeacherAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ assignment: TeacherAssignment }>(`/api/teacher/assignments/${id}`)
      .then((r) => setAssignment(r.assignment))
      .catch((err) => setError(err instanceof Error ? err.message : 'Soru yüklenemedi.'));
  }, [id]);

  if (assignment) return <StudioScreen assignment={assignment} nav={nav} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, gap: 12, justifyContent: 'center' }}>
      {error ? <ErrorText>{error}</ErrorText> : <Text style={{ color: colors.muted, textAlign: 'center' }}>Stüdyo hazırlanıyor…</Text>}
      {error && <Button label="Geri" variant="ghost" onPress={nav.pop} />}
    </View>
  );
}
