// Yönetici: öğretmen listesi ve ekleme. (Güncelleme ve silme sonraki adımda.)
// Hesabı yönetici oluşturur; e-posta ve şifreyi o girer. Auth kullanıcısı Supabase'de, profil satırı veritabanında tutulur.
import { Router } from 'express';
import { BRANCHES, type Branch, type TeacherInfo } from '@app/shared';
import { requireAuth } from '../auth.js';
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
