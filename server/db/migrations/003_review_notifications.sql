-- Yönetici onaylayınca veya geri gönderince öğretmene bildirim gider: yeni bildirim türleri.
alter table notifications drop constraint notifications_type_check;
alter table notifications
  add constraint notifications_type_check check (type in ('assignment_created', 'recording_approved', 'recording_returned'));
