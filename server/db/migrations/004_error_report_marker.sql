-- Hata bildiriminde sorunun görseli üzerinde işaret: 0..1 arası oransal konum (görselin sol-üstüne göre).
-- Soru paketinde soru metni ve şıklar ayrı alan olarak bulunmadığından, "bu alanlara işaret etme" görsel üzerinde yapılır.
alter table error_reports add column marker_x numeric check (marker_x between 0 and 1);
alter table error_reports add column marker_y numeric check (marker_y between 0 and 1);
alter table error_reports add constraint error_reports_marker_pair check ((marker_x is null) = (marker_y is null));
