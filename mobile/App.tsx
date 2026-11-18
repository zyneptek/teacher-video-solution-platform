import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { VIDEO, type DrawingEvent, type InkController, type Tool } from '@app/shared';
import { Board } from './src/studio/Board';
import { RecordingTimer, StudioControls, formatTime } from './src/studio/StudioControls';
import { useRecordingClock } from './src/studio/useRecordingClock';

// Geçici deneme ekranı: Skia tahtası ve kayıt kontrolleri. Gerçek ekranlar (giriş, dashboard) sonra gelecek.

function Studio() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const landscape = width > height;
  const clock = useRecordingClock();
  const [tool, setTool] = useState<Tool>('pen');
  const [counts, setCounts] = useState({ strokes: 0, erases: 0 });
  const [boardKey, setBoardKey] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const controllerRef = useRef<InkController | null>(null);

  const active = clock.status !== 'idle';

  function handleEvent(event: DrawingEvent) {
    setCounts((c) => (event.type === 'stroke' ? { ...c, strokes: c.strokes + 1 } : { ...c, erases: c.erases + 1 }));
  }

  function handleStart() {
    setResult(null);
    clock.start();
  }

  // Kaydı bitirir. Mikrofon kaydı ve sunucuya yükleme henüz bağlı değil; şimdilik tahta temizlenir.
  function handleFinish() {
    const duration = clock.finish();
    setResult(`Kayıt tamamlandı: ${formatTime(duration)}, ${counts.strokes} çizgi, ${counts.erases} silme`);
    setCounts({ strokes: 0, erases: 0 });
    setBoardKey((k) => k + 1);
  }

  // Süre sınırına (3 dk) gelince kayıt kendiliğinden biter.
  useEffect(() => {
    if (active && clock.elapsedMs >= VIDEO.maxSeconds * 1000) handleFinish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.elapsedMs, active]);

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

  // Yalnızca geliştirici doğrulaması için (düğmelere dokunmadan akışı denemek):
  // EXPO_PUBLIC_AUTO_DEMO=1: kayıt başlar, çizer, duraklar, devam eder, bitirir. =2: başlar ve duraklatılmış bekler.
  const demoMode = process.env.EXPO_PUBLIC_AUTO_DEMO;
  useEffect(() => {
    if (!demoMode) return;
    const steps: [number, () => void][] =
      demoMode === '2'
        ? [[1000, clock.start], [1500, drawDemo], [3000, clock.pause]]
        : [[1000, clock.start], [1500, drawDemo], [4000, clock.pause], [6000, clock.resume], [8000, handleFinish]];
    const timers = steps.map(([ms, fn]) => setTimeout(fn, ms));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const controls = (
    <StudioControls
      tool={tool}
      onToolChange={setTool}
      status={clock.status}
      onStart={handleStart}
      onPause={clock.pause}
      onResume={clock.resume}
      onFinish={handleFinish}
      direction={landscape ? 'column' : 'row'}
    />
  );

  // Ekran dönse de aynı bileşen ağacı korunur (Board yeniden oluşmaz, çizimler kaybolmaz);
  // yalnızca stiller değişir.
  return (
    <View
      style={[
        styles.container,
        landscape ? styles.containerLandscape : { paddingTop: insets.top + 8, paddingHorizontal: 8, gap: 10 },
      ]}
    >
      <View style={landscape ? styles.boardLandscape : styles.boardPortrait}>
        <Board
          key={boardKey}
          imageSource={require('./assets/dev/sample-question.jpg')}
          tool={tool}
          getTimeMs={clock.getTimeMs}
          onEvent={handleEvent}
          onReady={(controller) => {
            controllerRef.current = controller;
          }}
          disabled={!active}
        />
      </View>

      {landscape ? (
        <>
          {/* Yatay: soru tam ekran; kontroller tahtanın sağ kenarında, süre sağ üstte yüzer. */}
          <View style={[styles.floating, { right: Math.max(insets.right, 12) + 8, top: 0, bottom: 0, justifyContent: 'center' }]}>
            {controls}
          </View>
          <View style={[styles.floating, { right: Math.max(insets.right, 12) + 8, top: 8 }]}>
            <RecordingTimer status={clock.status} elapsedMs={clock.elapsedMs} />
          </View>
        </>
      ) : (
        <>
          {/* Dikey: tahtanın altında aynı düğmeler yan yana, süre ortada. */}
          <View style={styles.portraitBar}>
            {controls}
            <RecordingTimer status={clock.status} elapsedMs={clock.elapsedMs} />
          </View>
          {!active && !result && <Text style={styles.hint}>Çizmek için 🔴 ile kaydı başlatın.</Text>}
          {result && <Text style={styles.hint}>{result}</Text>}
          {/* Geliştirici yardımcıları (yalnızca dikey modda) */}
          <View style={styles.devRow}>
            <Pressable style={styles.devButton} onPress={drawDemo}>
              <Text style={styles.devText}>Deneme çizimi</Text>
            </Pressable>
            <Pressable style={styles.devButton} onPress={eraseFirstLineTip}>
              <Text style={styles.devText}>Çizgiyi sil (uç)</Text>
            </Pressable>
            <Text style={styles.devText}>
              Çizgi: {counts.strokes}, silme: {counts.erases}
            </Text>
          </View>
        </>
      )}
      {/* Yatayda soru tam ekran: durum çubuğu da gizlenir. */}
      <StatusBar hidden={landscape} style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Studio />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f5' },
  boardPortrait: { width: '100%', aspectRatio: 16 / 9 },
  containerLandscape: { padding: 0 },
  boardLandscape: { flex: 1 },
  floating: { position: 'absolute' },
  portraitBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hint: { fontSize: 13, color: '#52525b' },
  devRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  devButton: { borderRadius: 6, borderWidth: 1, borderColor: '#d4d4d8', backgroundColor: '#ffffff', paddingVertical: 4, paddingHorizontal: 8 },
  devText: { fontSize: 12, color: '#52525b' },
});
