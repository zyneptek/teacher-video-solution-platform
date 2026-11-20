// Yönetici: kazanım listesi — arama, branş süzme ve bir kazanımın açıklamasını/branşını güncelleme.
import { useEffect, useState } from 'react';
import { BRANCHES, type Branch, type OutcomeInfo } from '@app/shared';
import { api } from '../auth/session';

export function OutcomesPage() {
  const [text, setText] = useState('');
  const [branch, setBranch] = useState<Branch | ''>('');
  const [outcomes, setOutcomes] = useState<OutcomeInfo[] | null>(null);
  const [limit, setLimit] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ description: '', branch: '' as Branch | '' });
  const [message, setMessage] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: text.trim(), ...(branch ? { branch } : {}) });
      api<{ outcomes: OutcomeInfo[]; limit: number }>(`/api/admin/outcomes?${params}`)
        .then((r) => {
          if (cancelled) return;
          setOutcomes(r.outcomes);
          setLimit(r.limit);
          setError(null);
        })
        .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Kazanımlar yüklenemedi.'));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, branch, version]);

  function startEdit(o: OutcomeInfo) {
    setEditing(o.id);
    setDraft({ description: o.description, branch: o.branch ?? '' });
    setMessage(null);
    setError(null);
  }

  async function save(o: OutcomeInfo) {
    try {
      await api(`/api/admin/outcomes/${o.id}`, { method: 'PATCH', body: { description: draft.description, branch: draft.branch || null } });
      setEditing(null);
      setMessage(`${o.code} güncellendi.`);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.');
    }
  }

  return (
    <div>
      <h2>Kazanımlar</h2>
      <div className="filters">
        <input type="search" placeholder="Kod veya açıklamada ara…" value={text} onChange={(e) => setText(e.target.value)} data-testid="outcomes-search" style={{ flex: 1 }} />
        <select value={branch} onChange={(e) => setBranch(e.target.value as Branch | '')}>
          <option value="">Tüm branşlar</option>
          {BRANCHES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
      {message && <p className="notice" data-testid="outcome-saved">{message}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {!outcomes && !error && <p>Yükleniyor…</p>}
      {outcomes && (
        <>
          <table data-testid="outcomes-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Kod</th>
                <th>Açıklama</th>
                <th style={{ width: 120 }}>Branş</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {outcomes.map((o) =>
                editing === o.id ? (
                  <tr key={o.id}>
                    <td>{o.code}</td>
                    <td>
                      <input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} style={{ width: '100%' }} data-testid="outcome-desc" />
                    </td>
                    <td>
                      <select value={draft.branch} onChange={(e) => setDraft((d) => ({ ...d, branch: e.target.value as Branch | '' }))}>
                        <option value="">Branşsız</option>
                        {BRANCHES.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="btn-row sm">
                        <button type="button" className="accent-btn sm" onClick={() => void save(o)} data-testid="outcome-save">Kaydet</button>
                        <button type="button" className="accent-btn sm" onClick={() => setEditing(null)}>Vazgeç</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={o.id}>
                    <td>{o.code}</td>
                    <td>{o.description}</td>
                    <td>{o.branch ?? '—'}</td>
                    <td>
                      <button type="button" className="accent-btn sm" onClick={() => startEdit(o)} data-testid={`edit-outcome-${o.code}`}>Düzenle</button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
          {outcomes.length === 0 && <p className="muted">Sonuç yok.</p>}
          {outcomes.length >= limit && <p className="muted small">İlk {limit} sonuç gösteriliyor; aramayı daraltın.</p>}
        </>
      )}
    </div>
  );
}
