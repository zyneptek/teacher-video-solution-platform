import { useRef, useState } from 'react';
import type { Stroke, Tool } from '@app/shared';
import { Board } from './studio/Board';

// Geçici deneme sayfası: tahtayı denemek için. Gerçek ekranlar giriş ve yönlendirme eklenince gelecek.
function App() {
  const [tool, setTool] = useState<Tool>('pen');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [summary, setSummary] = useState({ strokes: 0, points: 0 });
  const strokesRef = useRef<Stroke[]>([]);
  const startRef = useRef(performance.now());

  // Deneme için saat sayfa açıldığından itibaren işler; gerçek kayıtta kayıt saati kullanılacak.
  const getTimeMs = () => performance.now() - startRef.current;

  function handleStroke(stroke: Stroke) {
    strokesRef.current.push(stroke);
    setSummary({
      strokes: strokesRef.current.length,
      points: strokesRef.current.reduce((sum, s) => sum + s.points.length, 0),
    });
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    setImageUrl(URL.createObjectURL(file));
    strokesRef.current = [];
    setSummary({ strokes: 0, points: 0 });
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
          Çizim: {summary.strokes}, nokta: {summary.points}
        </span>
      </div>
      <Board key={imageUrl} imageUrl={imageUrl} tool={tool} getTimeMs={getTimeMs} onStrokeComplete={handleStroke} />
    </main>
  );
}

export default App;
