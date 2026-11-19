// Kayıt stüdyosu (soruya bağlı): soru görseli üzerinde çizim + mikrofon (+ isteğe bağlı kamera).
// Bitirince sunucu MP4'ü üretip sisteme kaydeder; ardından izlenir ve onaya gönderilir veya taslak bırakılır.
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { CameraView } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VIDEO, type DrawingEvent, type InkController, type TeacherAssignment, type Tool } from '@app/shared';
import { abs, api } from '../api';
import type { Nav } from '../nav';
import { Board } from './Board';
import { PreviewScreen } from './PreviewScreen';
import { RecordingTimer, StudioControls } from './StudioControls';
import { uploadRecording } from './api';
import { useCameraClips } from './useCameraClips';
import { useRecorder, type RecordingResult } from './useRecorder';

type Phase = 'studio' | 'rendering' | 'preview';
type Video = { url: string };

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function StudioScreen({ assignment, nav }: { assignment: TeacherAssignment; nav: Nav }) {
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
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
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

  // Bekleyen kaydı sunucuya gönderir: sunucu MP4'ü üretir ve sisteme kaydeder (cihaza indirme yoktur).
  async function upload() {
    const pending = pendingRef.current;
    if (!pending) return;
    setUploadError(null);
    setPhase('rendering');
    try {
      const saved = await uploadRecording(assignment.id, { audioUri: pending.audioUri, cameraUris: cameraUrisRef.current, events: eventsRef.current, durationMs: pending.durationMs });
      if (!saved.recording) throw new Error('Kayıt kaydedilemedi.');
      setVideo({ url: abs(saved.recording.videoUrl) });
      setPhase('preview');
    } catch (err) {
      setUploadError(errorMessage(err, 'Video hazırlanamadı.'));
    }
  }

  async function submitForReview() {
    setSending(true);
    setMessage(null);
    try {
      await api(`/api/teacher/assignments/${assignment.id}/submit`, { method: 'POST' });
      nav.pop();
    } catch (err) {
      setMessage(errorMessage(err, 'Onaya gönderilemedi.'));
      setSending(false);
    }
  }

  // "Sil": video sunucudan da silinir (dosya ve veritabanı kaydı); soru sayfasına dönülür.
  function confirmDelete() {
    Alert.alert('Video silinsin mi?', 'Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          setSending(true);
          api(`/api/teacher/assignments/${assignment.id}/recording`, { method: 'DELETE' })
            .then(() => nav.pop())
            .catch((err) => {
              setMessage(errorMessage(err, 'Video silinemedi.'));
              setSending(false);
            });
        },
      },
    ]);
  }

  // Yeni kayıt (veya vazgeç): tahta ve kayıt temizlenir.
  function resetStudio() {
    pendingRef.current = null;
    cameraUrisRef.current = [];
    camera.reset();
    eventsRef.current = [];
    setVideo(null);
    setUploadError(null);
    setMessage(null);
    setBoardKey((k) => k + 1);
    recorder.setError(null);
    setPhase('studio');
  }

  // Süre sınırına (3 dk) gelince kayıt kendiliğinden biter.
  useEffect(() => {
    if (phase === 'studio' && active && recorder.elapsedMs >= VIDEO.maxSeconds * 1000) void handleFinish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.elapsedMs, active, phase]);

  // Telefon yataya dönene kadar dikey arayüz hiç gösterilmez (kilit uygulanmazsa bekleyiş bitince gösterilir).
  if (!isTablet && !landscape && !orientationWaitOver) return <View style={styles.container} />;

  if (phase === 'preview' && video) {
    return (
      <>
        <PreviewScreen
          videoUrl={video.url}
          landscape={landscape}
          sending={sending}
          message={message}
          onSubmit={() => void submitForReview()}
          onDraft={() => nav.pop()}
          onEdit={() => { nav.pop(); nav.push({ name: 'trim', id: assignment.id }); }}
          onDelete={confirmDelete}
          onRetake={resetStudio}
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
          imageSource={abs(assignment.question.imageUrl)}
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
