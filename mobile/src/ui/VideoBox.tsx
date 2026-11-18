// Sunucudan gelen MP4'ü oynatan basit video kutusu (sistem oynatma kontrolleriyle).
import { VideoView, useVideoPlayer } from 'expo-video';
import { StyleSheet } from 'react-native';
import type { VideoPlayer } from 'expo-video';

export function VideoBox({ url, onPlayer }: { url: string; onPlayer?: (player: VideoPlayer) => void }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    onPlayer?.(p);
  });
  return <VideoView player={player} nativeControls contentFit="contain" style={styles.video} />;
}

const styles = StyleSheet.create({ video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 8 } });
