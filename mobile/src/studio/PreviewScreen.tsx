// Kayıt önizlemesi: izle (oynat/duraklat, baştan oynat, konum çubuğu); onaya gönder, taslak olarak bırak veya yeniden çek.
// Video, sunucunun ürettiği MP4'tür ve bir adresten oynatılır.
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PauseIcon, PlayIcon } from './icons';
import { RoundButton, formatTime } from './StudioControls';

type Props = {
  videoUrl: string;
  landscape: boolean;
  sending: boolean;
  message: string | null;
  onSubmit: () => void;
  onDraft: () => void;
  onRetake: () => void;
};

function Pill({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.pill, disabled && styles.pillDisabled]}>
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

export function PreviewScreen({ videoUrl, landscape, sending, message, onSubmit, onDraft, onRetake }: Props) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [ended, setEnded] = useState(false);
  const [barWidth, setBarWidth] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => setTime({ current: player.currentTime, duration: player.duration }), 250);
    const subscription = player.addListener('playToEnd', () => setEnded(true));
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [player]);

  function togglePlay() {
    if (isPlaying) {
      player.pause();
      return;
    }
    if (ended) {
      player.currentTime = 0; // bitmiş videoyu baştan oynat
      setEnded(false);
    }
    player.play();
  }

  function seekTo(fraction: number) {
    player.currentTime = Math.min(1, Math.max(0, fraction)) * time.duration;
    setEnded(false);
  }

  const progress = time.duration > 0 ? Math.min(1, time.current / time.duration) : 0;

  const controls = (
    <View style={[landscape ? styles.controlsLandscape : styles.controlsPortrait, landscape && { paddingBottom: insets.bottom + 8, paddingHorizontal: Math.max(insets.left, insets.right) + 16 }]}>
      <View style={styles.row}>
        <RoundButton label={isPlaying ? 'Duraklat' : 'Oynat'} onPress={togglePlay}>
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </RoundButton>
        <Pressable
          accessibilityLabel="Videoda konum"
          style={styles.barHit}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          onPress={(e) => seekTo(e.nativeEvent.locationX / barWidth)}
        >
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
          </View>
        </Pressable>
        <Text style={[styles.time, landscape && styles.timeLandscape]}>
          {formatTime(time.current * 1000)} / {formatTime(time.duration * 1000)}
        </Text>
      </View>
      <View style={styles.row}>
        <Pill label={sending ? 'Gönderiliyor…' : 'Onaya gönder'} disabled={sending} onPress={onSubmit} />
        <Pill label="Taslak olarak kaydet" disabled={sending} onPress={onDraft} />
        <Pill label="Yeniden çek" disabled={sending} onPress={onRetake} />
        <Text style={[styles.message, landscape && styles.timeLandscape]}>Kaydınız sisteme kaydedildi.</Text>
        {message && <Text style={[styles.messageError, landscape && styles.timeLandscape]}>{message}</Text>}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, landscape ? styles.containerLandscape : { paddingTop: insets.top + 8 }]}>
      <VideoView player={player} nativeControls={false} contentFit="contain" style={landscape ? styles.videoLandscape : styles.videoPortrait} />
      {controls}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f5' },
  containerLandscape: { backgroundColor: '#000000' },
  videoPortrait: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000000' },
  videoLandscape: { flex: 1 },
  controlsPortrait: { padding: 12, gap: 12 },
  // Yatayda video tam ekran; kontroller altta yarı saydam bir şerit olarak yüzer.
  controlsLandscape: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 8, paddingTop: 8, backgroundColor: 'rgba(0,0,0,0.55)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  barHit: { flex: 1, height: 32, justifyContent: 'center', minWidth: 80 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: '#d4d4d8', overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: '#2563eb' },
  time: { fontSize: 13, fontVariant: ['tabular-nums'], color: '#27272a' },
  timeLandscape: { color: '#ffffff' },
  pill: { height: 36, paddingHorizontal: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d4d4d8' },
  pillDisabled: { opacity: 0.5 },
  pillText: { fontSize: 14, color: '#18181b', fontWeight: '600' },
  message: { fontSize: 13, color: '#15803d' },
  messageError: { color: '#dc2626' },
});
