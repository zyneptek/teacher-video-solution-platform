import { File, Paths } from 'expo-file-system';
import { requestPermissionsAsync, saveToLibraryAsync } from 'expo-media-library/legacy';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { VIDEO, type DrawingEvent, type InkController, type Tool } from '@app/shared';
import { Board } from './src/studio/Board';
import { renderOnServer } from './src/studio/api';
import { PreviewScreen, type SaveState } from './src/studio/PreviewScreen';
import { RecordingTimer, StudioControls } from './src/studio/StudioControls';
import { CameraView } from 'expo-camera';
import { useCameraClips } from './src/studio/useCameraClips';
import { useRecorder, type RecordingResult } from './src/studio/useRecorder';

// Geçici stüdyo ekranı: kayıt → sunucuda MP4 → izle → kaydet akışı. Gerçek ekranlar (giriş, dashboard) sonra gelecek.

// Geçici: soru görseli uygulamayla paketlenmiştir; gerçek akışta sunucudan gelecek.
const QUESTION_IMAGE = require('./assets/dev/sample-question.jpg') as number;

type Phase = 'studio' | 'rendering' | 'preview';
type Video = { url: string; sizeKb: number; renderMs: number };

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function Studio() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const landscape = width > height;
  // Telefonda yalnızca yatay desteklenir; dikey ve yatay yalnızca tablette (ekranın kısa kenarı >= 600).
  const isTablet = Math.min(width, height) >= 600;
  const [orientationWaitOver, setOrientationWaitOver] = useState(false);
  const recorder = useRecorder();
  const camera = useCameraClips();
  const [tool, setTool] = useState<Tool>('pen');
  const [boardKey, setBoardKey] = useState(0);
  const [phase, setPhase] = useState<Phase>('studio');
  const [video, setVideo] = useState<Video | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const controllerRef = useRef<InkController | null>(null);
  const eventsRef = useRef<DrawingEvent[]>([]); // çizim günlüğü: biten her çizgi ve silme, gerçekleşme sırasıyla
  const pendingRef = useRef<RecordingResult | null>(null); // yüklenmeyi bekleyen kayıt
  const cameraUrisRef = useRef<string[]>([]); // yüklenmeyi bekleyen kamera klipleri

  const active = recorder.status !== 'idle';

  // Telefonda ekranı yataya kilitler, tablette kilidi kaldırır. Sistem kilidi reddederse (iOS 27+'da yeniden
  // boyutlanabilir uygulamalarda olabilir) kısa bir bekleyişten sonra mevcut yönde çalışmaya devam edilir.
  useEffect(() => {
    if (isTablet) {
      void ScreenOrientation.unlockAsync();
      return;
    }
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => setOrientationWaitOver(true));
    const timer = setTimeout(() => setOrientationWaitOver(true), 1500);
    return () => clearTimeout(timer);
  }, [isTablet]);

  function handleEvent(event: DrawingEvent) {
    eventsRef.current.push(event);
  }

  // Kayıt kontrolleri: ses ve çizim saati recorder'da; kamera açıksa klipler de aynı anda başlar/durur.
  async function startRecording() {
    if (await recorder.start()) camera.startClip(); // mikrofon açılamazsa kayıt başlamaz
  }
  async function pauseRecording() {
    recorder.pause();
    await camera.stopClip();
  }
  function resumeRecording() {
    recorder.resume();
    camera.startClip();
  }

  // Kaydı bitirir: ses dosyasını alır, sunucuya yükler, hazır olunca izleme ekranına geçer.
  async function handleFinish() {
    try {
      await camera.stopClip();
      pendingRef.current = await recorder.finish();
      cameraUrisRef.current = camera.takeClips();
    } catch (err) {
      recorder.setError(errorMessage(err, 'Kayıt bitirilemedi.'));
      return;
    }
    await upload();
  }

  async function upload() {
    const pending = pendingRef.current;
    if (!pending) return;
    setUploadError(null);
    setPhase('rendering');
    try {
      const result = await renderOnServer({
        imageModule: QUESTION_IMAGE,
        audioUri: pending.audioUri,
        cameraUris: cameraUrisRef.current,
        events: eventsRef.current,
        durationMs: pending.durationMs,
      });
      setVideo({ url: result.videoUrl, sizeKb: result.sizeKb, renderMs: result.renderMs });
      setSaveState({ status: 'idle' });
      setPhase('preview');
    } catch (err) {
      setUploadError(errorMessage(err, 'Video hazırlanamadı.'));
    }
  }

  // Yeni kayıt (veya vazgeç): tahta ve kayıt temizlenir.
  function resetStudio() {
    pendingRef.current = null;
    cameraUrisRef.current = [];
    camera.reset();
    eventsRef.current = [];
    setVideo(null);
    setUploadError(null);
    setBoardKey((k) => k + 1);
    recorder.setError(null);
    setPhase('studio');
  }

  // Videoyu indirir ve telefonun galerisine kaydeder.
  async function saveToGallery(url: string) {
    setSaveState({ status: 'saving' });
    try {
      const permission = await requestPermissionsAsync(true); // yalnızca yazma izni
      if (!permission.granted) {
        setSaveState({ status: 'error', message: 'Galeriye kaydetmek için fotoğraf izni verin.' });
        return;
      }
      const file = await File.downloadFileAsync(url, new File(Paths.cache, `cozum-videosu-${Date.now()}.mp4`));
      await saveToLibraryAsync(file.uri);
      setSaveState({ status: 'saved', message: 'Video galeriye kaydedildi.' });
    } catch (err) {
      setSaveState({ status: 'error', message: errorMessage(err, 'Video kaydedilemedi.') });
    }
  }

  // Süre sınırına (3 dk) gelince kayıt kendiliğinden biter.
  useEffect(() => {
    if (phase === 'studio' && active && recorder.elapsedMs >= VIDEO.maxSeconds * 1000) void handleFinish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.elapsedMs, active, phase]);

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
  // EXPO_PUBLIC_AUTO_DEMO=1: başlat, çiz, duraklat, devam et, bitir, izle, kaydet.
  // =2: başlar, çizer ve duraklatılmış bekler. =3: kayıt başlamadan çizer (yalnızca deneme çizimi).
  const demoMode = process.env.EXPO_PUBLIC_AUTO_DEMO;
  useEffect(() => {
    if (!demoMode) return;
    const steps: [number, () => void][] =
      demoMode === '3'
        ? [[1500, drawDemo]]
        : demoMode === '2'
          ? [[1000, () => void recorder.start()], [2500, drawDemo], [4000, recorder.pause]]
          : [[1000, () => void recorder.start()], [2500, drawDemo], [4500, recorder.pause], [6500, recorder.resume], [9000, () => void handleFinish()]];
    const timers = steps.map(([ms, fn]) => setTimeout(fn, ms));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Demo 1: izleme ekranı açılınca birkaç saniye sonra kaydet düğmesine basılmış gibi kaydeder.
  useEffect(() => {
    if (demoMode !== '1' || phase !== 'preview' || !video) return;
    const timer = setTimeout(() => void saveToGallery(video.url), 6000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, video]);

  // Telefon yataya dönene kadar dikey arayüz hiç gösterilmez (kilit uygulanmazsa bekleyiş bitince gösterilir).
  if (!isTablet && !landscape && !orientationWaitOver) return <View style={styles.container} />;

  if (phase === 'preview' && video) {
    return (
      <>
        <PreviewScreen
          videoUrl={video.url}
          landscape={landscape}
          autoPlay={demoMode === '1'}
          saveState={saveState}
          onSave={() => void saveToGallery(video.url)}
          onNew={resetStudio}
        />
        <StatusBar hidden={landscape} style="auto" />
      </>
    );
  }

  // Her iki yönde ve her cihazda aynı yerleşim: soru tahtası ekrana sığar, kontroller tahtanın sağ
  // kenarında yüzer, süre sağ üstte durur. Ekran dönse de aynı bileşen ağacı korunur (Board yeniden
  // oluşmaz, çizimler kaybolmaz).
  return (
    <View style={styles.container}>
      <View style={styles.board}>
        <Board
          key={boardKey}
          imageSource={QUESTION_IMAGE}
          tool={tool}
          getTimeMs={recorder.getTimeMs}
          onEvent={handleEvent}
          onReady={(controller) => {
            controllerRef.current = controller;
          }}
          renderOverlay={(k) =>
            camera.enabled ? (
              // Videodaki bindirmeyle aynı yer ve boyut: sağ altta 240x180 dikdörtgen (tahta 1280x720).
              <View pointerEvents="none" style={{ position: 'absolute', right: 24 * k, bottom: 24 * k, width: 240 * k, height: 180 * k, borderRadius: 4, overflow: 'hidden', borderWidth: 2, borderColor: '#fff' }}>
                <CameraView ref={camera.cameraRef} style={{ flex: 1 }} facing="front" mode="video" mute onCameraReady={camera.onReady} />
              </View>
            ) : null
          }
          // Kayıt başlamadan da çizilebilir: bu çizimler videonun ilk karesinden itibaren görünür.
          disabled={phase !== 'studio'}
        />
      </View>

      <View style={[styles.floating, { right: Math.max(insets.right, 12) + 8, top: 0, bottom: 0, justifyContent: 'center' }]}>
        <StudioControls
          tool={tool}
          onToolChange={setTool}
          status={recorder.status}
          startDisabled={recorder.starting}
          onStart={() => void startRecording()}
          onPause={() => void pauseRecording()}
          onResume={resumeRecording}
          cameraOn={camera.enabled}
          onToggleCamera={isTablet ? () => void camera.toggle() : undefined}
          onFinish={() => void handleFinish()}
          direction="column"
        />
      </View>
      <View style={[styles.floating, { right: Math.max(insets.right, 12) + 8, top: insets.top + 8 }]}>
        <RecordingTimer status={recorder.status} elapsedMs={recorder.elapsedMs} />
      </View>
      {(recorder.error || camera.notice) && (
        <View style={[styles.floating, styles.toast, { left: Math.max(insets.left, 12) + 8, top: insets.top + 8 }]}>
          <Text style={styles.error}>{recorder.error ?? camera.notice}</Text>
        </View>
      )}

      {/* Video hazırlanırken (veya hata olursa) tahtanın üstünü kaplayan bilgi katmanı */}
      {phase === 'rendering' && (
        <View style={styles.overlay}>
          {uploadError ? (
            <>
              <Text style={styles.overlayError}>{uploadError}</Text>
              <View style={styles.overlayRow}>
                <Pressable style={styles.pill} onPress={() => void upload()}>
                  <Text style={styles.pillText}>Tekrar dene</Text>
                </Pressable>
                <Pressable style={styles.pill} onPress={resetStudio}>
                  <Text style={styles.pillText}>Vazgeç</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#ffffff" />
              <Text style={styles.overlayText}>Video hazırlanıyor…</Text>
            </>
          )}
        </View>
      )}
      {/* Soru tam ekran: durum çubuğu gizlenir. */}
      <StatusBar hidden style="auto" />
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
  board: { flex: 1 },
  floating: { position: 'absolute' },
  toast: { maxWidth: 320, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 8, padding: 8 },
  error: { fontSize: 13, color: '#dc2626' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  overlayText: { color: '#ffffff', fontSize: 16 },
  overlayError: { color: '#ffffff', fontSize: 15, textAlign: 'center' },
  overlayRow: { flexDirection: 'row', gap: 12 },
  pill: { height: 36, paddingHorizontal: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  pillText: { fontSize: 14, color: '#18181b', fontWeight: '600' },
});
