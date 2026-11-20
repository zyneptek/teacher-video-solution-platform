-- Atama geri alınınca öğretmene "Güncelleme: atama geri alındı" bildirimi (ve e-posta/push) gider. Atama silindiği için bu bildirim
-- bir atamaya bağlanamaz; bağlandığı soru question_id ile saklanır.
alter table notifications add column question_id uuid references questions (id);
alter table notifications drop constraint notifications_target_check;
alter table notifications add constraint notifications_target_check
  check (assignment_id is not null or error_report_id is not null or question_id is not null);
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('assignment_created', 'recording_approved', 'recording_returned', 'recording_submitted', 'error_reported', 'peer_checked', 'assignment_revoked'));
