import { useRef, useState } from 'react';
import type { DrawingEvent, Tool } from '@app/shared';
import { Board } from './studio/Board';

// Geçici deneme sayfası: tahtayı denemek için. Gerçek ekranlar giriş ve yönlendirme eklenince gelecek.
function App() {
  const [tool, setTool] = useState<Tool>('pen');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [summary, setSummary] = useState({ strokes: 0, erases: 0, points: 0 });
  const eventsRef = useRef<DrawingEvent[]>([]);
  const startRef = useRef(performance.now());

  // Deneme için saat sayfa açıldığından itibaren işler; gerçek kayıtta kayıt saati kullanılacak.
  const getTimeMs = () => performance.now() - startRef.current;

  function handleEvent(event: DrawingEvent) {
    eventsRef.current.push(event);
    const events = eventsRef.current;
    setSummary({
      strokes: events.filter((e) => e.type === 'stroke').length,
      erases: events.filter((e) => e.type === 'erase').length,
      points: events.reduce((sum, e) => sum + (e.type === 'stroke' ? e.points.length : 0), 0),
    });
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    setImageUrl(URL.createObjectURL(file));
    eventsRef.current = [];
    setSummary({ strokes: 0, erases: 0, points: 0 });
  }

  return (
    <main style={{ padding: 16, maxWidth: 1312, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20 }}>Tahta denemesi</h1>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <input type="file" accept="image/jpeg,image/png" onChange={(e) => handleFile(e.target.files?.[0])} />
        <button onClick={() => setTool('pen')} aria-pressed={tool === 'pen'}>
          Kalem {tool === 'pen' ? '✓' : ''}
        </button>
        <button onClick={() => setTool('eraser')} aria-pressed={tool === 'eraser'}>
          Silgi {tool === 'eraser' ? '✓' : ''}
        </button>
        <span data-testid="summary">
          Çizgi: {summary.strokes}, silme: {summary.erases}, nokta: {summary.points}
        </span>
      </div>
      <Board key={imageUrl} imageUrl={imageUrl} tool={tool} getTimeMs={getTimeMs} onEvent={handleEvent} />
    </main>
  );
}

export default App;
