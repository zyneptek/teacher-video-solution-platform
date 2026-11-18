// Yönetici: öğretmen listesi, ekleme, güncelleme ve silme.
// Hesabı yönetici oluşturur; e-posta ve şifreyi o girer. Güncellemede şifre boş bırakılırsa değişmez.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BRANCHES, type Branch, type TeacherInfo } from '@app/shared';
import { api } from '../auth/session';

type FormState = { firstName: string; lastName: string; email: string; password: string; branch: Branch | '' };
const EMPTY: FormState = { firstName: '', lastName: '', email: '', password: '', branch: '' };

export function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // null: form kapalı, 'new': ekleme, aksi halde düzenlenen öğretmenin kimliği
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  function openNew() {
    setEditing('new');
    setForm(EMPTY);
    setFormError(null);
    setMessage(null);
  }

  function openEdit(t: TeacherInfo) {
    setEditing(t.id);
    setForm({ firstName: t.firstName, lastName: t.lastName, email: t.email, password: '', branch: t.branch ?? '' });
    setFormError(null);
    setMessage(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setBusy(true);
    const isNew = editing === 'new';
    try {
      const { teacher, email } = await api<{ teacher: TeacherInfo; email: 'sent' | 'not_configured' | 'failed' | null }>(isNew ? '/api/admin/teachers' : `/api/admin/teachers/${editing}`, {
        method: isNew ? 'POST' : 'PATCH',
        body: form,
      });
      await load(); // liste yenilendikten sonra mesaj gösterilir
      const mailText = email === 'sent' ? ' Giriş bilgileri öğretmene e-postayla gönderildi.' : email === 'not_configured' ? ' E-posta gönderilmedi (e-posta ayarı yapılmamış); giriş bilgilerini öğretmene siz iletin.' : email === 'failed' ? ' E-posta gönderilemedi; giriş bilgilerini öğretmene siz iletin.' : '';
      setMessage(`${teacher.firstName} ${teacher.lastName} ${isNew ? 'eklendi' : 'güncellendi'}.${mailText}`);
      setEditing(null);
      setForm(EMPTY);
      setBusy(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'İşlem yapılamadı.');
      setBusy(false);
    }
  }

  async function remove(t: TeacherInfo) {
    if (!window.confirm(`${t.firstName} ${t.lastName} silinsin mi? Hesap kapatılır ve öğretmen bir daha giriş yapamaz; kayıtları sistemde kalır.`)) return;
    setMessage(null);
    try {
      await api(`/api/admin/teachers/${t.id}`, { method: 'DELETE' });
      setMessage(`${t.firstName} ${t.lastName} silindi.`);
      if (editing === t.id) setEditing(null);
      await load();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Öğretmen silinemedi.');
    }
  }

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const isNew = editing === 'new';

  return (
    <section>
      <div className="row">
        <h2 style={{ margin: 0 }}>Öğretmenler</h2>
        <button type="button" className="primary" onClick={() => (editing ? setEditing(null) : openNew())} data-testid="add-teacher">
          {editing ? 'Vazgeç' : 'Öğretmen ekle'}
        </button>
      </div>

      {message && (
        <p className="notice" data-testid="added">
          {message}
        </p>
      )}

      {editing && (
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
            {isNew ? 'Şifre (en az 8 karakter; öğretmene e-postayla gönderilir)' : 'Yeni şifre (değişmeyecekse boş bırakın; değişirse öğretmene e-postayla gönderilir)'}
            <input type="text" value={form.password} onChange={(e) => set('password')(e.target.value)} minLength={8} required={isNew} autoComplete="off" data-testid="f-password" />
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
              {busy ? 'Kaydediliyor…' : 'Kaydet'}
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
              <th style={{ width: 150 }} />
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id} data-testid={`row-${t.email}`}>
                <td>
                  {t.firstName} {t.lastName}
                </td>
                <td>{t.email}</td>
                <td>{t.branch}</td>
                <td>
                  <button type="button" className="link" onClick={() => openEdit(t)} data-testid={`edit-${t.email}`}>
                    Düzenle
                  </button>
                  <button type="button" className="link danger" onClick={() => void remove(t)} data-testid={`delete-${t.email}`}>
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
