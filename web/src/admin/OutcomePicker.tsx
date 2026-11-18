// Kazanım arama kutusu: yazdıkça veritabanındaki kazanım listesi süzülür; bir sonuca tıklayınca onSelect çağrılır.
import { useEffect, useState } from 'react';
import type { Branch, OutcomeInfo } from '@app/shared';
import { api } from '../auth/session';

const DEBOUNCE_MS = 250;

export function OutcomePicker({ branch, excludeIds, onSelect }: { branch: Branch; excludeIds: number[]; onSelect: (outcome: OutcomeInfo) => void }) {
  const [text, setText] = useState('');
  const [onlyBranch, setOnlyBranch] = useState(true);
  const [results, setResults] = useState<OutcomeInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Her yazımda (kısa bir gecikmeyle) sunucudan süzülmüş liste istenir; eski cevaplar yenisini ezmez.
  useEffect(() => {
    if (!text.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: text.trim(), ...(onlyBranch ? { branch } : {}) });
      api<{ outcomes: OutcomeInfo[] }>(`/api/admin/outcomes?${params}`)
        .then((r) => {
          if (cancelled) return;
          setResults(r.outcomes);
          setError(null);
          setSearched(true);
        })
        .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Arama başarısız.'));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, onlyBranch, branch]);

  const visible = results.filter((o) => !excludeIds.includes(o.id));

  return (
    <div className="picker">
      <input
        type="search"
        placeholder="Kazanım ara (kod veya açıklama yazın)…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-testid="outcome-search"
      />
      <label className="check">
        <input type="checkbox" checked={onlyBranch} onChange={(e) => setOnlyBranch(e.target.checked)} /> Yalnızca {branch} kazanımları
      </label>
      {error && <p className="error">{error}</p>}
      {searched && visible.length === 0 && <p className="muted">Sonuç yok.</p>}
      {visible.length > 0 && (
        <ul className="results" data-testid="outcome-results">
          {visible.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(o);
                  setText('');
                }}
                data-testid={`pick-${o.code}`}
              >
                <strong>{o.code}</strong> {o.description}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
