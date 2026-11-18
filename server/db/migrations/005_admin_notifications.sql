-- Yöneticiye de bildirim gider: öğretmen videoyu onaya gönderince (recording_submitted) ve hata bildirince (error_reported).
-- Hata bildirimi bir atamaya bağlı olmadığından assignment_id boş olabilir; bildirim ya bir atamaya ya da bir hata bildirimine bağlıdır.
alter table notifications alter column assignment_id drop not null;
alter table notifications add column error_report_id uuid references error_reports (id);
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('assignment_created', 'recording_approved', 'recording_returned', 'recording_submitted', 'error_reported'));
alter table notifications add constraint notifications_target_check
  check (assignment_id is not null or error_report_id is not null);
