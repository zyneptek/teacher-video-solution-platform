-- Yöneticinin kafası karışmasın: bir video onaya gönderildikten (veya onaylandıktan / geri gönderildikten) sonra öğretmen onu
-- düzenler, geri alır, siler ya da yeniden çekerse bu an atamada saklanır. Yönetici ekranında videonun üstünde
-- "Video X tarafından yeniden yüklendi" etiketi görünür; eski çapraz kontrol bildirimleri de bu andan "video değişti" diye anlaşılır.
-- Atamada tutulur (kayıtta değil) çünkü kayıt silinip yeniden çekilince kayıt satırı yenilenir, an kaybolmamalı.
alter table assignments add column video_replaced_at timestamptz;
