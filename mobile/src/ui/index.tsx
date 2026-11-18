// Küçük ortak arayüz parçaları (web ile aynı görsel dil).
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { ASSIGNMENT_STATUS_LABEL, type AssignmentStatus } from '@app/shared';
import { colors } from '../theme';

export function Button({ label, onPress, variant = 'primary', disabled, busy, style }: { label: string; onPress: () => void; variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; busy?: boolean; style?: ViewStyle }) {
  const off = disabled || busy;
  return (
    <Pressable accessibilityRole="button" disabled={off} onPress={onPress} style={[styles.btn, variant === 'primary' && styles.btnPrimary, variant === 'ghost' && styles.btnGhost, variant === 'danger' && styles.btnDanger, off && { opacity: 0.5 }, style]}>
      {busy ? <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.ink} /> : <Text style={[styles.btnText, variant === 'primary' && { color: '#fff' }, variant === 'danger' && { color: colors.danger }]}>{label}</Text>}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ label, tone }: { label: string; tone?: 'brand' | 'ok' | 'warn' }) {
  const bg = tone === 'brand' ? '#fde6dc' : tone === 'ok' ? '#dff1e4' : tone === 'warn' ? '#f5dcdc' : colors.sageLight;
  const fg = tone === 'brand' ? colors.brandDark : tone === 'ok' ? colors.success : tone === 'warn' ? colors.danger : colors.ink;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: AssignmentStatus }) {
  const tone = status === 'submitted' ? 'brand' : status === 'approved' ? 'ok' : status === 'returned' ? 'warn' : undefined;
  return <Badge label={ASSIGNMENT_STATUS_LABEL[status]} tone={tone} />;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <View style={styles.notice}>
      <Text style={{ color: colors.ink, fontSize: 13 }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  btnPrimary: { backgroundColor: colors.brand },
  btnGhost: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.sage },
  btnDanger: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.danger },
  btnText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  card: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 10 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: 10, borderRadius: 8, fontSize: 13 },
  notice: { backgroundColor: colors.sageLight, padding: 10, borderRadius: 8 },
});
