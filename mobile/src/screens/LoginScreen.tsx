// Öğretmen girişi (web ile aynı hesap). Mobil uygulamaya yalnızca öğretmenler girer; yönetici web panelini kullanır.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../session';
import { colors } from '../theme';
import { Button, ErrorText, Notice } from '../ui';

export function LoginScreen() {
  const { login, sessionEnded } = useSession();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş yapılamadı.');
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Video Çözüm Platformu</Text>
          <View style={styles.accent} />
          <Text style={styles.sub}>Öğretmen girişi</Text>
          {sessionEnded && <Notice>Oturumunuz sonlandırıldı. Lütfen tekrar giriş yapın.</Notice>}
          <Text style={styles.label}>E-posta</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" placeholder="ornek@okul.com" accessibilityLabel="E-posta" />
          <Text style={styles.label}>Şifre</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry textContentType="password" accessibilityLabel="Şifre" onSubmitEditing={() => void submit()} />
          {error && <ErrorText>{error}</ErrorText>}
          <Button label="Giriş yap" onPress={() => void submit()} busy={busy} disabled={!email || !password} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  card: { width: '100%', maxWidth: 420, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 20, gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  accent: { width: 48, height: 4, borderRadius: 2, backgroundColor: colors.brand, alignSelf: 'center' },
  sub: { textAlign: 'center', color: colors.muted, marginBottom: 6 },
  label: { fontSize: 13, color: colors.muted, marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.sage, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: colors.ink, backgroundColor: colors.white },
});
