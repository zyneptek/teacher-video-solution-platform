// Stüdyo kontrolleri: kalem, silgi ve kayıt düğmeleri ile süre göstergesi.
// Hepsi aynı küçük yuvarlak düğme tasarımındadır; dikey ve yatay modda aynı bileşenler kullanılır.
// Kalem ve silgi emoji, kayıt düğmeleri kendi çizdiğimiz simgelerdir (icons.tsx).
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { VIDEO, type Tool } from '@app/shared';
import { PauseIcon, PlayIcon, RecordIcon, StopIcon } from './icons';
import type { RecordingStatus } from './useRecordingClock';

export function RoundButton({
  label,
  selected,
  disabled,
  onPress,
  children,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.round, selected && styles.roundSelected, disabled && styles.roundDisabled]}
    >
      {children}
    </Pressable>
  );
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

type ControlsProps = {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  status: RecordingStatus;
  startDisabled?: boolean; // mikrofon açılırken tekrar basılmasın
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  direction: 'row' | 'column';
  // Kamera düğmesi (telefonda ve tablette); verilmezse gösterilmez.
  cameraOn?: boolean;
  onToggleCamera?: () => void;
};

// Kalem, silgi ve kayıt düğmeleri. Kayıt düğmeleri duruma göre değişir:
// bekleme: kayıt (kırmızı daire) | kayıt sürüyor: duraklat, dur | duraklatıldı: devam et (üçgen), dur.
export function StudioControls({ tool, onToolChange, status, startDisabled, onStart, onPause, onResume, onFinish, direction, cameraOn, onToggleCamera }: ControlsProps) {
  const column = direction === 'column';
  return (
    <View style={[styles.group, column ? styles.groupColumn : styles.groupRow]}>
      <RoundButton label="Kalem" selected={tool === 'pen'} onPress={() => onToolChange('pen')}>
        <Text style={styles.emoji}>✏️</Text>
      </RoundButton>
      <RoundButton label="Silgi" selected={tool === 'eraser'} onPress={() => onToolChange('eraser')}>
        <Text style={styles.emoji}>🧽</Text>
      </RoundButton>
      {onToggleCamera && (
        <RoundButton label={cameraOn ? 'Kamerayı kapat' : 'Kamerayı aç'} selected={cameraOn} disabled={status !== 'idle'} onPress={onToggleCamera}>
          <Text style={styles.emoji}>📷</Text>
        </RoundButton>
      )}
      <View style={column ? styles.dividerHorizontal : styles.dividerVertical} />
      {status === 'idle' && (
        <RoundButton label="Kaydı başlat" disabled={startDisabled} onPress={onStart}>
          <RecordIcon />
        </RoundButton>
      )}
      {status === 'recording' && (
        <RoundButton label="Duraklat" onPress={onPause}>
          <PauseIcon />
        </RoundButton>
      )}
      {status === 'paused' && (
        <RoundButton label="Devam et" onPress={onResume}>
          <PlayIcon />
        </RoundButton>
      )}
      {status !== 'idle' && (
        <RoundButton label="Kaydı bitir" onPress={onFinish}>
          <StopIcon />
        </RoundButton>
      )}
    </View>
  );
}

// Kayıt süresi: kayıt sürerken kırmızı nokta, duraklatılmışken duraklatma işareti.
export function RecordingTimer({ status, elapsedMs }: { status: RecordingStatus; elapsedMs: number }) {
  return (
    <View style={styles.timer} accessibilityLabel={`Kayıt süresi ${formatTime(elapsedMs)}`}>
      {status === 'paused' ? <PauseIcon size={10} color="#a1a1aa" /> : <View style={[styles.dot, status === 'recording' && styles.dotRecording]} />}
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
  roundDisabled: { opacity: 0.4 },
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
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#a1a1aa' },
  dotRecording: { backgroundColor: '#dc2626' },
  timerText: { fontSize: 13, fontVariant: ['tabular-nums'], color: '#27272a' },
});
