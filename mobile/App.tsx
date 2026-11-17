import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { BRANCHES } from '@app/shared';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Öğretmen Video Çözüm Platformu</Text>
      <Text>Branşlar (ortak paketten):</Text>
      {BRANCHES.map((branch) => (
        <Text key={branch}>{branch}</Text>
      ))}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
});
