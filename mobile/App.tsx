import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import type { DrawingEvent, InkController, Tool } from '@app/shared';
import { Board } from './src/studio/Board';

// Geçici deneme ekranı: Skia tahtasının çizim akıcılığını denemek için.
// Gerçek ekranlar (giriş, dashboard, stüdyo) sonra gelecek.
export default function App() {
  const [tool, setTool] = useState<Tool>('pen');
  const [counts, setCounts] = useState({ strokes: 0, erases: 0 });
  const controllerRef = useRef<InkController | null>(null);
  const startRef = useRef(Date.now());

  // Deneme için saat uygulama açıldığından itibaren işler; gerçek kayıtta kayıt saati kullanılacak.
  const getTimeMs = () => Date.now() - startRef.current;

  function handleEvent(event: DrawingEvent) {
    setCounts((c) => (event.type === 'stroke' ? { ...c, strokes: c.strokes + 1 } : { ...c, erases: c.erases + 1 }));
  }

  // Geliştirici denemesi: dokunmadan, programla birkaç çizgi çizer (görsel doğrulama için).
  function drawDemo() {
    const c = controllerRef.current;
    if (!c) return;
    const line = (x0: number, y0: number, x1: number, y1: number, n: number) =>
      Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n }));
    const stroke = (points: { x: number; y: number }[]) => {
      c.begin('pen', points[0] as { x: number; y: number });
      c.move(points.slice(1));
      c.end();
    };
    stroke(line(100, 120, 560, 120, 40)); // soru görselinin üstünde yatay çizgi
    stroke(Array.from({ length: 60 }, (_, i) => ({ x: 700 + i * 8, y: 400 + 60 * Math.sin(i / 6) }))); // dalga
    // küçük "3", yalnızca 9 seyrek noktadan
    const three = [[-9, -16], [0, -22], [9, -16], [10, -8], [0, -1], [8, 6], [10, 14], [0, 22], [-9, 16]];
    stroke(three.map(([dx, dy]) => ({ x: 900 + (dx as number), y: 560 + (dy as number) })));
  }

  // Geliştirici denemesi: ilk çizginin yalnızca ucuna değen silgi (tüm çizgi silinmeli).
  function eraseFirstLineTip() {
    const c = controllerRef.current;
    if (!c) return;
    c.begin('eraser', { x: 570, y: 126 });
    c.end();
  }

  // Yalnızca geliştirici doğrulaması için: EXPO_PUBLIC_AUTO_DEMO=1 ile açılışta deneme çizimi yapılır.
  useEffect(() => {
    if (!process.env.EXPO_PUBLIC_AUTO_DEMO) return;
    const first = setTimeout(drawDemo, 1500);
    const second = setTimeout(eraseFirstLineTip, 10000);
    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mobil tahta denemesi (Skia)</Text>
      <Board
        imageSource={require('./assets/dev/sample-question.jpg')}
        tool={tool}
        getTimeMs={getTimeMs}
        onEvent={handleEvent}
        onReady={(controller) => {
          controllerRef.current = controller;
        }}
      />
      <View style={styles.row}>
        <Button title={tool === 'pen' ? 'Kalem ✓' : 'Kalem'} onPress={() => setTool('pen')} />
        <Button title={tool === 'eraser' ? 'Silgi ✓' : 'Silgi'} onPress={() => setTool('eraser')} />
        <Text testID="counts">
          Çizgi: {counts.strokes}, silme: {counts.erases}
        </Text>
      </View>
      <View style={styles.row}>
        <Button title="Deneme çizimi" onPress={drawDemo} />
        <Button title="Çizgiyi sil (uç)" onPress={eraseFirstLineTip} />
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f5', paddingTop: 56, paddingHorizontal: 8 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8, flexWrap: 'wrap' },
});
