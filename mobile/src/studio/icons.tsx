// Kayıt kontrolleri için emoji yerine kendi çizdiğimiz sade simgeler (Expo Go'da her cihazda aynı görünür).
import { StyleSheet, View } from 'react-native';

type IconProps = { size?: number; color?: string };

// Oynat: sağa bakan üçgen.
export function PlayIcon({ size = 20, color = '#18181b' }: IconProps) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        marginLeft: size * 0.12, // üçgenin görsel olarak ortalanması için
        borderTopWidth: size * 0.5,
        borderBottomWidth: size * 0.5,
        borderLeftWidth: size * 0.85,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: color,
      }}
    />
  );
}

// Duraklat: iki dikey çubuk.
export function PauseIcon({ size = 20, color = '#18181b' }: IconProps) {
  const bar = { width: size * 0.28, height: size, borderRadius: 2, backgroundColor: color };
  return (
    <View style={[styles.row, { gap: size * 0.22 }]}>
      <View style={bar} />
      <View style={bar} />
    </View>
  );
}

// Dur / bitir: dolu kare.
export function StopIcon({ size = 20, color = '#18181b' }: IconProps) {
  return <View style={{ width: size * 0.8, height: size * 0.8, borderRadius: 3, backgroundColor: color }} />;
}

// Kaydı başlat: dolu kırmızı daire.
export function RecordIcon({ size = 20, color = '#dc2626' }: IconProps) {
  return <View style={{ width: size * 0.9, height: size * 0.9, borderRadius: size * 0.45, backgroundColor: color }} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
