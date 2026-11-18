// Yönetici: öğretmen listesi ve ekleme. (Güncelleme ve silme sonraki adımda.)
// Hesabı yönetici oluşturur; e-posta ve şifreyi o girer. Auth kullanıcısı Supabase'de, profil satırı veritabanında tutulur.
import { Router } from 'express';
import { BRANCHES, type Branch, type TeacherInfo } from '@app/shared';
import { forgetProfile, requireAuth } from '../auth.js';
import { pool } from '../db.js';
import { supabase } from '../supabase.js';

export const adminTeachersRouter = Router();
adminTeachersRouter.use(requireAuth('admin'));

type TeacherRow = { id: string; first_name: string; last_name: string; email: string; branch: Branch; created_at: Date };

function toTeacher(row: TeacherRow): TeacherInfo {
  return { id: row.id, firstName: row.first_name, lastName: row.last_name, email: row.email, branch: row.branch, createdAt: row.created_at.toISOString() };
}

adminTeachersRouter.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query<TeacherRow>(
      `select id, first_name, last_name, email, branch, created_at from profiles
       where role = 'teacher' and deleted_at is null order by first_name, last_name`,
    );
    res.json({ teachers: rows.map(toTeacher) });
  } catch (err) {
    console.error('Öğretmenler listelenemedi:', err);
    res.status(500).json({ error: 'Öğretmenler listelenemedi.' });
  }
});

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

adminTeachersRouter.post('/', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const branch = body.branch;

  if (!firstName || !lastName) {
    res.status(400).json({ error: 'Ad ve soyad gerekli.' });
    return;
  }
  if (!EMAIL_PATTERN.test(email)) {
    res.status(400).json({ error: 'Geçerli bir e-posta adresi girin.' });
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.` });
    return;
  }
  if (typeof branch !== 'string' || !(BRANCHES as readonly string[]).includes(branch)) {
    res.status(400).json({ error: 'Branş Türkçe, Matematik, Fizik, Kimya veya Biyoloji olmalı.' });
    return;
  }

  try {
    // Aynı e-posta aktif başka bir kullanıcıda varsa Auth'ta da vardır; önce açık bir mesajla reddet.
    const existing = await pool.query('select 1 from profiles where lower(email) = $1 and deleted_at is null', [email]);
    if (existing.rowCount) {
      res.status(409).json({ error: 'Bu e-posta adresiyle kayıtlı bir kullanıcı var.' });
      return;
    }
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) {
      const duplicate = error?.message?.toLowerCase().includes('already');
      res.status(duplicate ? 409 : 400).json({ error: duplicate ? 'Bu e-posta adresiyle kayıtlı bir kullanıcı var.' : 'Hesap oluşturulamadı: şifre veya e-posta kabul edilmedi.' });
      return;
    }
    try {
      const { rows } = await pool.query<TeacherRow>(
        `insert into profiles (auth_user_id, role, first_name, last_name, email, branch)
         values ($1, 'teacher', $2, $3, $4, $5) returning id, first_name, last_name, email, branch, created_at`,
        [data.user.id, firstName, lastName, email, branch],
      );
      res.status(201).json({ teacher: toTeacher(rows[0] as TeacherRow) });
    } catch (err) {
      await supabase.auth.admin.deleteUser(data.user.id); // profil yazılamazsa Auth kaydı yetim kalmasın
      throw err;
    }
  } catch (err) {
    console.error('Öğretmen eklenemedi:', err);
    res.status(500).json({ error: 'Öğretmen eklenemedi.' });
  }
});

// Güncelleme: gönderilen alanlar değişir (şifre boşsa değişmez). E-posta ve şifre Supabase Auth'ta da güncellenir.
adminTeachersRouter.patch('/:id', async (req, res) => {
  const id = req.params.id;
  if (!UUID_PATTERN.test(id)) {
    res.status(400).json({ error: 'Geçersiz öğretmen.' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const branch = body.branch;

  if (!firstName || !lastName) {
    res.status(400).json({ error: 'Ad ve soyad gerekli.' });
    return;
  }
  if (!EMAIL_PATTERN.test(email)) {
    res.status(400).json({ error: 'Geçerli bir e-posta adresi girin.' });
    return;
  }
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.` });
    return;
  }
  if (typeof branch !== 'string' || !(BRANCHES as readonly string[]).includes(branch)) {
    res.status(400).json({ error: 'Branş Türkçe, Matematik, Fizik, Kimya veya Biyoloji olmalı.' });
    return;
  }

  try {
    const current = await pool.query<{ auth_user_id: string | null; email: string }>(
      "select auth_user_id, email from profiles where id = $1 and role = 'teacher' and deleted_at is null",
      [id],
    );
    const teacher = current.rows[0];
    if (!teacher) {
      res.status(404).json({ error: 'Öğretmen bulunamadı.' });
      return;
    }
    const taken = await pool.query('select 1 from profiles where lower(email) = $1 and deleted_at is null and id <> $2', [email, id]);
    if (taken.rowCount) {
      res.status(409).json({ error: 'Bu e-posta adresiyle kayıtlı bir kullanıcı var.' });
      return;
    }
    if (teacher.auth_user_id && (password || email !== teacher.email.toLowerCase())) {
      const { error } = await supabase.auth.admin.updateUserById(teacher.auth_user_id, { email, email_confirm: true, ...(password ? { password } : {}) });
      if (error) {
        res.status(400).json({ error: 'Hesap güncellenemedi: e-posta veya şifre kabul edilmedi.' });
        return;
      }
    }
    const { rows } = await pool.query<TeacherRow>(
      `update profiles set first_name = $1, last_name = $2, email = $3, branch = $4 where id = $5
       returning id, first_name, last_name, email, branch, created_at`,
      [firstName, lastName, email, branch, id],
    );
    res.json({ teacher: toTeacher(rows[0] as TeacherRow) });
  } catch (err) {
    console.error('Öğretmen güncellenemedi:', err);
    res.status(500).json({ error: 'Öğretmen güncellenemedi.' });
  }
});

// Silme (yumuşak): profil işaretlenir, Auth hesabı silinir. Atama ve kayıtlar yerinde kalır;
// öğretmen bir daha giriş yapamaz ve açık oturumu bir sonraki istekte kapanır.
adminTeachersRouter.delete('/:id', async (req, res) => {
  const id = req.params.id;
  if (!UUID_PATTERN.test(id)) {
    res.status(400).json({ error: 'Geçersiz öğretmen.' });
    return;
  }
  try {
    const { rows } = await pool.query<{ auth_user_id: string | null }>(
      "update profiles set deleted_at = now() where id = $1 and role = 'teacher' and deleted_at is null returning auth_user_id",
      [id],
    );
    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: 'Öğretmen bulunamadı.' });
      return;
    }
    forgetProfile(row.auth_user_id);
    if (row.auth_user_id) await supabase.auth.admin.deleteUser(row.auth_user_id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Öğretmen silinemedi:', err);
    res.status(500).json({ error: 'Öğretmen silinemedi.' });
  }
});
