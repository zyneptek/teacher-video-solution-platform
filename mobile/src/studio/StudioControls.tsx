// Stüdyo kontrolleri: kalem, silgi ve kayıt düğmeleri ile süre göstergesi.
// Hepsi aynı küçük yuvarlak emoji düğmesi tasarımındadır; dikey ve yatay modda aynı bileşenler kullanılır.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Tool } from '@app/shared';
import { VIDEO } from '@app/shared';
import type { RecordingStatus } from './useRecordingClock';

function RoundButton({ emoji, label, selected, onPress }: { emoji: string; label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.round, selected && styles.roundSelected]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
    </Pressable>
  );
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

type ControlsProps = {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  status: RecordingStatus;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  direction: 'row' | 'column';
};

// Kalem, silgi ve kayıt düğmeleri. Kayıt düğmeleri duruma göre değişir:
// bekleme: 🔴 başlat | kayıt: ⏸️ duraklat, ⏹️ bitir | duraklatıldı: ▶️ devam et, ⏹️ bitir.
export function StudioControls({ tool, onToolChange, status, onStart, onPause, onResume, onFinish, direction }: ControlsProps) {
  const column = direction === 'column';
  return (
    <View style={[styles.group, column ? styles.groupColumn : styles.groupRow]}>
      <RoundButton emoji="✏️" label="Kalem" selected={tool === 'pen'} onPress={() => onToolChange('pen')} />
      <RoundButton emoji="🧽" label="Silgi" selected={tool === 'eraser'} onPress={() => onToolChange('eraser')} />
      <View style={column ? styles.dividerHorizontal : styles.dividerVertical} />
      {status === 'idle' && <RoundButton emoji="🔴" label="Kaydı başlat" onPress={onStart} />}
      {status === 'recording' && <RoundButton emoji="⏸️" label="Duraklat" onPress={onPause} />}
      {status === 'paused' && <RoundButton emoji="▶️" label="Devam et" onPress={onResume} />}
      {status !== 'idle' && <RoundButton emoji="⏹️" label="Kaydı bitir" onPress={onFinish} />}
    </View>
  );
}

// Kayıt süresi: kayıt sürerken kırmızı nokta, duraklatılmışken duraklatma işareti.
export function RecordingTimer({ status, elapsedMs }: { status: RecordingStatus; elapsedMs: number }) {
  return (
    <View style={styles.timer} accessibilityLabel={`Kayıt süresi ${formatTime(elapsedMs)}`}>
      <Text style={[styles.timerMark, status === 'recording' && styles.timerMarkRecording]}>
        {status === 'paused' ? '❚❚' : '●'}
      </Text>
      <Text style={styles.timerText}>
        {formatTime(elapsedMs)} / {formatTime(VIDEO.maxSeconds * 1000)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10, alignItems: 'center' },
  groupRow: { flexDirection: 'row' },
  groupColumn: { flexDirection: 'column' },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#d4d4d8',
  },
  roundSelected: { borderColor: '#2563eb', borderWidth: 3 },
  emoji: { fontSize: 20 },
  dividerVertical: { width: 1, height: 28, backgroundColor: '#d4d4d8' },
  dividerHorizontal: { width: 28, height: 1, backgroundColor: '#d4d4d8' },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#d4d4d8',
  },
  timerMark: { fontSize: 12, color: '#a1a1aa' },
  timerMarkRecording: { color: '#dc2626' },
  timerText: { fontSize: 13, fontVariant: ['tabular-nums'], color: '#27272a' },
});
