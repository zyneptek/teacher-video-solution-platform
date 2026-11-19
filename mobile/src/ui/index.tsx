// Küçük ortak arayüz parçaları (web ile aynı görsel dil).
import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { ASSIGNMENT_STATUS_LABEL, type AssignmentStatus } from '@app/shared';
import { colors } from '../theme';

// primary: dolu turuncu (ana işlem: giriş, kayıt oluştur); accent: turuncu degrade + hafif gölge (soru ve düzenleme ekranı işlemleri, web ile aynı);
// ghost: çerçeveli (gezinti ve ikincil işlemler); danger: kırmızı çerçeveli.
export function Button({ label, onPress, variant = 'primary', disabled, busy, style }: { label: string; onPress: () => void; variant?: 'primary' | 'accent' | 'ghost' | 'danger'; disabled?: boolean; busy?: boolean; style?: ViewStyle }) {
  const off = disabled || busy;
  const filled = variant === 'primary' || variant === 'accent';
  return (
    <Pressable accessibilityRole="button" disabled={off} onPress={onPress} style={({ pressed }) => [styles.btn, variant === 'primary' && styles.btnPrimary, variant === 'accent' && styles.btnAccent, variant === 'ghost' && styles.btnGhost, variant === 'danger' && styles.btnDanger, variant === 'accent' && pressed && { opacity: 0.85 }, off && { opacity: 0.5 }, style]}>
      {variant === 'accent' && <LinearGradient colors={[colors.brand, colors.brandDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnGradient} />}
      {busy ? <ActivityIndicator color={filled ? '#fff' : colors.ink} /> : <Text style={[styles.btnText, filled && { color: '#fff' }, variant === 'danger' && { color: colors.danger }]}>{label}</Text>}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// Sayı kartı (yönetici paneli ve öğretmen ana sayfası): solda renkli şerit, büyük sayı, altında etiket.
export function StatCard({ label, value, tone, wide, onPress }: { label: string; value: number; tone?: 'brand' | 'warn'; wide?: boolean; onPress?: () => void }) {
  const accent = tone === 'brand' ? colors.brand : tone === 'warn' ? colors.danger : colors.sage;
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={[styles.statCard, wide && { flexBasis: '22%', minHeight: 120, padding: 20 }]}>
      <View style={[styles.statAccent, { backgroundColor: accent }]} />
      <Text style={[styles.statValue, { fontSize: wide ? 44 : 32 }, tone === 'brand' && { color: colors.brand }, tone === 'warn' && { color: colors.danger }]}>{value}</Text>
      <Text style={[styles.statLabel, { fontSize: wide ? 16 : 13 }]}>{label}</Text>
    </Pressable>
  );
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

// forTeacher: turuncu, öğretmenin aksiyon alması gereken durumlardır (Atandı, Geri gönderildi); yönetici için Onaya gönderildi.
export function StatusBadge({ status, forTeacher }: { status: AssignmentStatus; forTeacher?: boolean }) {
  const tone = forTeacher
    ? status === 'assigned' || status === 'returned' ? 'brand' : status === 'approved' ? 'ok' : undefined
    : status === 'submitted' ? 'brand' : status === 'approved' ? 'ok' : status === 'returned' ? 'warn' : undefined;
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
  btn: { minHeight: 46, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  btnPrimary: { backgroundColor: colors.brand },
  btnAccent: { backgroundColor: colors.brand, shadowColor: colors.brandDark, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  btnGradient: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 12 },
  btnGhost: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.sage },
  btnDanger: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.danger },
  btnText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  card: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 10, shadowColor: colors.ink, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  statCard: { flexGrow: 1, flexBasis: '45%', minHeight: 92, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14, justifyContent: 'center', overflow: 'hidden', shadowColor: colors.ink, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  statAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  statValue: { fontWeight: '800', color: colors.ink },
  statLabel: { color: colors.muted, marginTop: 2 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: 10, borderRadius: 8, fontSize: 13 },
  notice: { backgroundColor: colors.sageLight, padding: 10, borderRadius: 8 },
});
