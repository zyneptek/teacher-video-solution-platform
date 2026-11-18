// Yönetici: öğretmen listesi ve yeni öğretmen ekleme (e-posta ve şifreyi yönetici girer).
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BRANCHES, type Branch, type TeacherInfo } from '@app/shared';
import { api } from '../auth/session';

const EMPTY = { firstName: '', lastName: '', email: '', password: '', branch: '' as Branch | '' };

export function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api<{ teachers: TeacherInfo[] }>('/api/admin/teachers');
      setTeachers(result.teachers);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Öğretmenler yüklenemedi.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      const { teacher } = await api<{ teacher: TeacherInfo }>('/api/admin/teachers', { method: 'POST', body: form });
      setAdded(`${teacher.firstName} ${teacher.lastName} eklendi.`);
      setForm(EMPTY);
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Öğretmen eklenemedi.');
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <section>
      <div className="row">
        <h2>Öğretmenler</h2>
        <button
          type="button"
          className="primary"
          onClick={() => {
            setShowForm((v) => !v);
            setFormError(null);
            setAdded(null);
          }}
          data-testid="add-teacher"
        >
          {showForm ? 'Vazgeç' : 'Öğretmen ekle'}
        </button>
      </div>

      {added && (
        <p className="notice" data-testid="added">
          {added}
        </p>
      )}

      {showForm && (
        <form onSubmit={(event) => void submit(event)} className="card grid" data-testid="teacher-form">
          <label>
            Ad
            <input value={form.firstName} onChange={(e) => set('firstName')(e.target.value)} required data-testid="f-first" />
          </label>
          <label>
            Soyad
            <input value={form.lastName} onChange={(e) => set('lastName')(e.target.value)} required data-testid="f-last" />
          </label>
          <label>
            E-posta
            <input type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} required data-testid="f-email" />
          </label>
          <label>
            Şifre (en az 8 karakter)
            <input type="text" value={form.password} onChange={(e) => set('password')(e.target.value)} minLength={8} required autoComplete="off" data-testid="f-password" />
          </label>
          <label>
            Branş
            <select value={form.branch} onChange={(e) => set('branch')(e.target.value)} required data-testid="f-branch">
              <option value="">Seçin…</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          {formError && (
            <p role="alert" className="error" data-testid="form-error" style={{ gridColumn: '1 / -1' }}>
              {formError}
            </p>
          )}
          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="primary" disabled={busy} data-testid="f-submit">
              {busy ? 'Ekleniyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      )}

      {loadError && (
        <p role="alert" className="error">
          {loadError}
        </p>
      )}
      {!teachers && !loadError && <p>Yükleniyor…</p>}
      {teachers && teachers.length === 0 && <p>Henüz öğretmen yok.</p>}
      {teachers && teachers.length > 0 && (
        <table data-testid="teacher-table">
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>E-posta</th>
              <th>Branş</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id}>
                <td>
                  {t.firstName} {t.lastName}
                </td>
                <td>{t.email}</td>
                <td>{t.branch}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
