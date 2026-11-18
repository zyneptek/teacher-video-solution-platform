// Atama e-postası: Nodemailer + Gmail SMTP. SMTP_USER / SMTP_PASS tanımlı değilse e-posta gönderilmez
// (atama yine kaydedilir); sonuç yöneticiye bildirilir. Gönderim hatası atamayı geri almaz.
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { AssignmentDelivery } from '@app/shared';
import { config } from './config.js';

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  transporter =
    config.smtpUser && config.smtpPass
      ? nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: config.smtpUser, pass: config.smtpPass } })
      : null;
  return transporter;
}

export type AssignmentMail = {
  to: string;
  teacherName: string;
  branch: string;
  questionLabel: string; // örn. "Soru 18"
  outcomes: string[]; // kazanım kodları
};

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

// E-posta içeriği: en az branş ve soru bilgisi (görev şartı).
export function buildAssignmentMail(mail: AssignmentMail): { subject: string; text: string; html: string } {
  const subject = `Yeni soru atandı: ${mail.branch} - ${mail.questionLabel}`;
  const outcomeLine = mail.outcomes.length > 0 ? `Kazanımlar: ${mail.outcomes.join(', ')}` : '';
  const text = [
    `Merhaba ${mail.teacherName},`,
    '',
    `Size yeni bir soru atandı.`,
    `Branş: ${mail.branch}`,
    `Soru: ${mail.questionLabel}`,
    outcomeLine,
    '',
    `Çözüm videosunu kaydetmek için uygulamaya giriş yapın: ${config.appUrl}`,
  ]
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n');
  const html = `<p>Merhaba ${escapeHtml(mail.teacherName)},</p>
<p>Size yeni bir soru atandı.</p>
<ul><li><strong>Branş:</strong> ${escapeHtml(mail.branch)}</li><li><strong>Soru:</strong> ${escapeHtml(mail.questionLabel)}</li>${
    mail.outcomes.length > 0 ? `<li><strong>Kazanımlar:</strong> ${escapeHtml(mail.outcomes.join(', '))}</li>` : ''
  }</ul>
<p>Çözüm videosunu kaydetmek için <a href="${escapeHtml(config.appUrl)}">uygulamaya giriş yapın</a>.</p>`;
  return { subject, text, html };
}

export async function sendAssignmentEmail(mail: AssignmentMail): Promise<AssignmentDelivery['email']> {
  const transport = getTransporter();
  if (!transport) {
    console.warn('E-posta gönderilmedi: SMTP_USER/SMTP_PASS tanımlı değil (server/.env).');
    return 'not_configured';
  }
  try {
    const content = buildAssignmentMail(mail);
    await transport.sendMail({ from: config.mailFrom ?? config.smtpUser ?? undefined, to: mail.to, ...content });
    return 'sent';
  } catch (err) {
    console.error('E-posta gönderilemedi:', err instanceof Error ? err.message : err);
    return 'failed';
  }
}

// ---- Hesap e-postaları: yönetici öğretmen oluşturunca veya şifresini değiştirince giriş bilgileri öğretmene gider ----

export type AccountMail = { to: string; teacherName: string; branch: string; email: string; password: string; kind: 'created' | 'password-changed' };

export function buildAccountMail(mail: AccountMail): { subject: string; text: string; html: string } {
  const created = mail.kind === 'created';
  const subject = created ? 'Hesabınız oluşturuldu: Video Çözüm Platformu' : 'Şifreniz güncellendi: Video Çözüm Platformu';
  const intro = created ? 'Video Çözüm Platformu için öğretmen hesabınız oluşturuldu.' : 'Hesabınızın şifresi yönetici tarafından güncellendi.';
  const text = [
    `Merhaba ${mail.teacherName},`,
    '',
    intro,
    `Branş: ${mail.branch}`,
    `E-posta (kullanıcı adı): ${mail.email}`,
    `Şifre: ${mail.password}`,
    '',
    `Web: ${config.appUrl} (Öğretmen girişi sekmesinden giriş yapın). Mobil uygulamada da aynı bilgilerle giriş yapabilirsiniz.`,
  ].join('\n');
  const html = `<p>Merhaba ${escapeHtml(mail.teacherName)},</p>
<p>${intro}</p>
<ul><li><strong>Branş:</strong> ${escapeHtml(mail.branch)}</li><li><strong>E-posta (kullanıcı adı):</strong> ${escapeHtml(mail.email)}</li><li><strong>Şifre:</strong> <code>${escapeHtml(mail.password)}</code></li></ul>
<p><a href="${escapeHtml(config.appUrl)}">Uygulamaya giriş yapın</a> (Öğretmen girişi sekmesi). Mobil uygulamada da aynı bilgilerle giriş yapabilirsiniz.</p>`;
  return { subject, text, html };
}

export async function sendAccountEmail(mail: AccountMail): Promise<AssignmentDelivery['email']> {
  const transport = getTransporter();
  if (!transport) {
    console.warn('Hesap e-postası gönderilmedi: SMTP_USER/SMTP_PASS tanımlı değil (server/.env).');
    return 'not_configured';
  }
  try {
    await transport.sendMail({ from: config.mailFrom ?? config.smtpUser ?? undefined, to: mail.to, ...buildAccountMail(mail) });
    return 'sent';
  } catch (err) {
    console.error('Hesap e-postası gönderilemedi:', err instanceof Error ? err.message : err);
    return 'failed';
  }
}
