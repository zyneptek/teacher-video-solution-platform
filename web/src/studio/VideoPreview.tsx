// Kayıt önizlemesi: tarayıcının hazır video kontrolleri yerine kendi oynatıcımız.
// Oynat/Duraklat düğmesi her zaman görünür, video bitince "Baştan oynat" olur, konum çubuğuyla gezilebilir.
import { useRef, useState } from 'react';

function formatTime(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function VideoPreview({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    if (video.ended) video.currentTime = 0; // bitmiş videoyu baştan oynat
    void video.play();
  }

  function seek(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    setCurrent(seconds);
    setEnded(false);
  }

  const label = ended ? '↻ Baştan oynat' : playing ? '❚❚ Duraklat' : '▶ Oynat';

  return (
    <div style={{ width: '100%', maxWidth: 1280 }}>
      <video
        ref={videoRef}
        data-testid="preview"
        src={src}
        playsInline
        preload="auto"
        style={{ width: '100%', display: 'block', background: '#000', cursor: 'pointer' }}
        onClick={togglePlay}
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0' }}>
        <button data-testid="play-toggle" onClick={togglePlay} style={{ minWidth: 130 }}>
          {label}
        </button>
        <input
          data-testid="seek"
          type="range"
          aria-label="Videoda konum"
          min={0}
          max={duration || 0}
          step={0.01}
          value={Math.min(current, duration || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(current)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
