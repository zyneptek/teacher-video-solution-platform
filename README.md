# Öğretmen Video Çözüm Platformu

İşler Yayınevi için hazırlanan, öğretmenlerin sorulara video çözüm kaydettiği ve yöneticinin bu videoları onayladığı bir teknik değerlendirme projesidir. Yönetici paneli ve öğretmen web uygulaması (React) ile öğretmen mobil/tablet uygulamasından (React Native, Expo) oluşur.

> **Durum:** Geliştirme aşamasında. Bu dosya şu an yalnızca alınan mimari kararları içerir; kurulum, çalıştırma ve diğer bölümler çalışan sürümle birlikte eklenecektir.

## Geliştirme yaklaşımı

Önce yalnızca **zorunlu özelliklerle çalışan bir MVP** çıkarılır, iyileştirmeler çalışan sürüm üzerinde yapılır. Her özellik tek tek eklenir, test edilir ve ardından commit'lenir. Örneğin web ve mobil stüdyo ilk sürümde basittir: kalem, silgi, tek renk ve tek kalınlık. Kamera bindirmesi gibi isteğe bağlı özellikler MVP sonrasına kalır.

## Mimari kararlar

### 1. Video kaydı ve MP4 üretimi: istemci olay günlüğü, sunucuda MP4

**Karar:** Web ve mobil istemci ekranı doğrudan video olarak kaydetmez. İki istemci de kayıt sırasında şunları toplayıp sunucuya yükler:

- **Çizim olayları:** kalem/silgi, noktalar, renk, kalınlık ve her olayın kayıt süresi içindeki zamanı
- **Mikrofon sesi** (zorunlu)
- **Kamera klibi** (isteğe bağlı)

Sunucu, soru görselini arka plan olarak alıp çizim olaylarını zamanına göre kare kare yeniden çizer ve **ffmpeg** ile sesi ekleyerek tek bir **MP4** üretir. Kamera açıldıysa küçük bir bindirme olarak eklenir.

**Gerekçe**

- Web ve mobil videoyu **aynı sunucu kodu** ürettiği için iki istemci birebir aynı sonucu verir.
- Çizim, canlı video kodlamasından bağımsız olduğu için akıcı kalır; istemci yalnızca nokta listesine ekleme yapar.
- Duraklatma sırasında yapılan çizimler, kayıt devam ettiğinde olay zamanıyla videoya girer. Silinen çizim, silme olayından sonraki karelerde çizilmez.
- Kırpma, MP4 üzerinde ffmpeg ile yapılır.
- Expo Go'da çalışır. Native ekran kaydı modülü ve development build gerekmez.

**Bilinen kısıtlar**

- Çıktı tarayıcı veya cihaz ekranının birebir kaydı değildir. Görev metni, kayda soru görseli ve çizimlerin girmesini yeterli saydığı için bu yaklaşım kabul edilmiştir.
- Önizleme, sunucunun ürettiği MP4 ile yapılır; kayıt bittikten sonra kısa bir işleme süresi olur.
- Canlı çizim (web canvas, mobil Skia) ile sunucudaki çizimin aynı görünmesi için çizgi yumuşatma kodu ortak tutulacaktır.

**Değerlendirilip seçilmeyen yöntemler**

- *Webde `MediaRecorder` ile gerçek kayıt, mobilde olay günlüğü:* iki ayrı hat gerektirdiği ve "aynı sonuç" beklentisini zorlaştırdığı için seçilmedi. Web tarafında sorun çıkarsa yedek plan olarak kullanılabilir.
- *Mobilde native ekran kaydı:* Expo Go'da çalışmadığı, development build gerektirdiği ve değerlendiricinin kurulumunu zorlaştırdığı için seçilmedi.

### 2. Sunucu, veritabanı, kimlik doğrulama ve dosya deposu

**Karar:** Sunucu **Node.js + Express**. Veri, kimlik doğrulama ve dosyalar tek bir **Supabase** projesinde (ücretsiz plan) tutulur:

- **Veritabanı:** Supabase'in barındırdığı PostgreSQL. Sunucu, Postgres bağlantı adresiyle doğrudan SQL çalıştırır; Supabase'in otomatik REST API'si ve RLS kuralları kullanılmaz.
- **Kimlik doğrulama:** Supabase Auth. Yönetici, öğretmen hesaplarını sunucu üzerinden (`service_role` anahtarıyla) oluşturur, günceller ve siler. Herkese açık kayıt yoktur. Branş ve rol bilgisi uygulamanın kendi tablosunda tutulur.
- **Dosya deposu:** Supabase Storage (özel bucket). Soru görselleri, kayıt dosyaları ve üretilen MP4'ler burada durur. Atanmamış soruya erişimi engellemek için dosyalara kısa süreli imzalı adresle erişilir.
- **Web ve mobil yalnızca Express API'siyle konuşur.** Supabase anahtarları (`service_role`, veritabanı şifresi) yalnızca sunucudadır, `.env` dosyasında durur ve repoya girmez.

**Gerekçe**

- Tek hesapta veritabanı, auth ve dosya deposu; Docker veya yerel Postgres kurulumu gerekmez.
- ffmpeg ile MP4 üretimi, e-posta ve push gibi işler Supabase'de yapılamayacağı için Express sunucusu kalır.

**Bilinen kısıtlar**

- Ücretsiz plan: tek dosya en fazla 50 MB, toplam dosya deposu 1 GB, veritabanı 500 MB. Bu yüzden videolar kısa tutulur.
- Ücretsiz projeler bir hafta kullanılmazsa duraklatılır; dashboard'dan devam ettirilir.
- Supabase Auth token'ı, kullanıcı silinse de süresi dolana kadar geçerlidir. "Silinen öğretmen giriş yapamamalı ve açık oturumu kapanmalı" şartı için sunucu her istekte kullanıcının uygulama tablosunda hâlâ var olduğunu kontrol eder; yoksa 401 döner, istemci oturumu kapatır.
- Değerlendirenin uygulamayı çalıştırması için kendi Supabase projesini açması gerekir; adımlar README'nin kurulum bölümünde anlatılacaktır.

**Supabase proje ayarları**

- **Data API kapalı.** Sunucu veritabanına doğrudan Postgres bağlantısıyla eriştiği ve web/mobil Supabase'e bağlanmadığı için tabloların REST olarak açılmasına gerek yoktur; böylece saldırı yüzeyi küçülür. Auth ve Storage bu ayardan etkilenmez.
- **Yeni kullanıcı kaydı kapalı** (Authentication > Sign In / Providers > "Allow new users to sign up"). Supabase'in kayıt uç noktası proje adresini bilen herkese açık olduğundan, "herkese açık kayıt formu olmamalı" şartı bu ayarla da güvence altına alınır. Hesapları yalnızca yönetici, sunucu üzerinden oluşturur.
- **Veritabanı bağlantısı: Session pooler (port 5432).** Direct connection ücretsiz planda yalnızca IPv6 destekler ve bazı ağlarda bağlanamaz; Transaction pooler prepared statement gibi oturum özelliklerini desteklemez. Session pooler IPv4'te çalışır ve `pg` kütüphanesini olduğu gibi kullanmamıza izin verir.
- Bağlantı SSL ile şifrelidir. Sertifika zinciri doğrulanmaz (`rejectUnauthorized: false`); ileride Supabase CA sertifikası eklenerek sıkılaştırılabilir.
- Bağlantı doğrulaması için `npm run check:supabase -w server` komutu veritabanı, Auth ve Storage'ı dener; geçici kayıtları oluşturup siler.
- Ortam değişkenleri `server/.env` dosyasındadır (örnek: `server/.env.example`). `SUPABASE_URL` sonundaki `/rest/v1/` gibi ekler kodda temizlenir.

### 3. E-posta

**Karar:** Nodemailer + Gmail SMTP (uygulama şifresiyle). Atama kaydedildiği anda öğretmene e-posta gider.

### 4. Web uygulaması

**Karar:** Vite + React, yönetici ve öğretmen ekranları **tek uygulamada**, role göre ayrılmış yollarla (`/admin`, `/teacher`). Giriş ve API kodu paylaşıldığı için iki ayrı uygulamaya göre tekrar azalır. Yetki kontrolü istemcide değil sunucudadır.

### 5. Mobil geliştirme ve test

**Karar:** Expo (React Native), telefon ve tablet için tek uygulama. Geliştirme MacBook üzerinde, Xcode'daki iOS ve iPad simülatörleriyle yapılır.

**Bilinen kısıtlar**

- Simülatörde kamera yoktur ve uzaktan push bildirimi alınamaz. Kamera bindirmesi ve push için gerçek cihaz gerekir.
- Mobil uygulama Expo (SDK 58) boş TypeScript şablonuyla kuruldu; Expo Go ile iOS simülatöründe çalıştırılır (`npm run dev:mobile`, ardından `i` tuşu). Navigasyon kütüphanesi henüz seçilmedi.
- `shared/` paketi mobilde çalışır: Metro ortak paketi workspace üzerinden çözer, ek ayar gerekmez. iOS simülatöründe doğrulandı.

### 6. Dil: TypeScript

**Karar:** Sunucu, web ve mobilin tamamı TypeScript ile yazılır; hafif ayarlarla (tipleri susturmak için `any` kullanılmaz).

**Gerekçe**

- Üç parça (sunucu, web, mobil) aynı veriyi kullanır: çizim olayı formatı, atama durumları (Atandı / Onaya gönderildi / Onaylandı / Geri gönderildi), API cevapları. Tür tanımı, bu parçalar arasındaki uyumsuzlukları kod çalışmadan yakalar.
- Tipler kodun belgesi gibidir, kodu açıklamayı kolaylaştırır.
- JavaScript'ten TypeScript'e sonradan geçmek, baştan başlamaktan çok daha pahalıdır.

**Bilinen kısıtlar**

- Ek ayar dosyaları ve tip yazma zamanı.
- Ortak tiplerin mobil uygulamada (Metro) sorunsuz çalışması ilk iskelette doğrulanır; olmazsa küçük tip dosyaları kopyalanır.

### 7. Klasör düzeni: tek repo, ortak paket

**Karar:** Tek repoda npm workspaces ile dört paket:

```
server/   Express sunucusu
web/      Vite + React (yönetici ve öğretmen)
mobile/   Expo uygulaması
shared/   ortak tipler ve fonksiyonlar
```

`shared/` içinde sunucu, web ve mobilin ortak kullandığı tipler (çizim olayı formatı, atama durumları, branş listesi, API biçimleri) ve küçük ortak fonksiyonlar (özellikle çizgi yumuşatma) bulunur. Böylece ekranda çizilen çizgi ile sunucunun videoya işlediği çizgi aynı koddan çıkar.

**Bilinen kısıtlar**

- Mobil uygulamanın (Metro) `shared/` paketini tanıması ek ayar gerektirebilir. Sorun çıkarsa ortak paket bırakılır, tipler her pakette ayrı tutulur.

### 8. İş kuralları

**Atama**

- Bir soru yalnızca **sorunun branşındaki** öğretmenlere atanabilir (ilk atama dahil).
- Aynı soru aynı öğretmene **ikinci kez atanamaz.** Yönetici videoyu geri gönderirse atama aynı kalır; öğretmen aynı atama üzerinde videosunu yeniden çeker veya düzenleyip yeniden onaya gönderir.
- Aynı soru, aynı branştaki birden fazla öğretmene atanabilir; her öğretmen kendi kaydını üretir.

**Silinen öğretmen**

- Hesap **kapatılır** (Supabase Auth kaydı silinir, açık oturumlar geçersiz olur). Öğretmenin atamaları, kayıtları ve hata bildirimleri veritabanında **kalır** (yumuşak silme).

**Kazanımlar**

- Verilen JSON'daki **tüm kazanımlar** (6.411 kayıt) veritabanına yüklenir. JSON, anahtarı hiyerarşik kod olan düz bir listedir; kod ve açıklama olduğu gibi saklanır.
- Her kazanıma, kodunun ön ekine göre bir **branş** eşlenir:

| Kod ön eki | Ders (JSON'da) | Branş |
|---|---|---|
| TDE, TÜR | Türk Dili ve Edebiyatı, Türkçe | Türkçe |
| MAT, GEO | Matematik, Geometri | Matematik |
| FİZ | Fizik | Fizik |
| KİM | Kimya | Kimya |
| BİY | Biyoloji | Biyoloji |
| COG, TAR, FEL, DİN, İNG, ROOT | Coğrafya, Tarih, Felsefe, Din Kültürü, İngilizce, Tüm Dersler | Branş yok (boş) |

- Soruların branşı, sorunun kazanımının ön ekinden belirlenir (soru paketinde branş alanı yoktur).

**Hata bildirimi**

- Türler: *Soru metninde hata, Şıklarda hata, Yazım yanlışı, Kırpma hatası, Cevap anahtarı hatası, Kazanım hatası* ve serbest metin (*Diğer*).
- Soru paketinde soru metni ve şıklar bulunmadığı için bu alanlara işaret etme, ilgili **tür seçilerek** yapılır.

### 9. Veritabanı şeması

Şema düz SQL ile yazılır ve `server/db/migrations/` altındaki numaralı dosyalarla yönetilir; `npm run db:migrate -w server` bunları sırayla uygular (uygulananlar `schema_migrations` tablosunda tutulur, tekrar çalıştırmak zararsızdır). ORM kullanılmaz, sunucu `pg` ile SQL çalıştırır.

| Tablo | İçerik |
|---|---|
| `profiles` | Yönetici ve öğretmenler: ad, soyad, e-posta, rol, branş, `auth_user_id`, `deleted_at` |
| `learning_outcomes` | Kazanımlar: kod (benzersiz), açıklama, branş (boş olabilir) |
| `questions` | Sorular: görsel yolu, branş, cevap anahtarı (A–E), paketteki orijinal kimlik (`source_id`), sayfa ve soru no |
| `question_outcomes` | Soru–kazanım ilişkisi (bir soruda birden fazla kazanım) |
| `assignments` | Atama: soru, öğretmen, durum (`assigned`, `submitted`, `approved`, `returned`), geri gönderme notu. `(soru, öğretmen)` benzersiz |
| `recordings` | Atamanın güncel videosu (atama başına en fazla bir), durum (`processing`, `ready`, `failed`), `deleted_at` |
| `notifications` | Bildirim: alıcı, atama, tür, `read_at` (boşsa okunmamış). Metin saklanmaz, gösterilirken üretilir |
| `error_reports` | Hata bildirimi: soru, gönderen öğretmen, tür, açıklama, isteğe bağlı ek |

**Normalizasyon:** Şema **3NF**'yi, tabloların çoğunda BCNF'yi sağlar. Bilinçli tavizler:

- Kazanımın branşı koddan türetilir ama yükleme sırasında bir kez hesaplanıp saklanır (branşa göre hızlı arama için).
- Sorunun branşı yüklemede ilk kazanımdan alınır, sonra bağımsız bir bilgidir.
- Branş değerleri ayrı tablo yerine `CHECK` kısıtıyla sınırlanır.
- Soru metni ve şıklar pakette olmadığı için şemada yoktur; gerekirse ayrı bir `question_options` tablosu eklenir (şıkları tek sütunda liste tutmak 1NF'yi bozardı).

**Veritabanı kuralları:** Öğretmenin branşı zorunlu, yöneticinin branşı yoktur. E-posta yalnızca silinmemiş kullanıcılarda benzersizdir (silinen öğretmenin e-postası yeniden kullanılabilir). Aynı soru aynı öğretmene iki kez atanamaz. Hata bildiriminde ek dosya ile türü birlikte dolu ya da birlikte boştur.

**Uygulama kodunda denetlenen kurallar** (tek tabloyla ifade edilemediği için): öğretmen yalnızca sorunun branşındaki soruya atanabilir; her sorunun en az bir kazanımı olmalıdır.

**Güvenlik:** Tüm tablolarda satır düzeyi güvenlik (RLS) açıktır ve politika yoktur; Data API ileride açılsa bile `anon` ve `authenticated` roller hiçbir satıra erişemez. Sunucu `postgres` rolüyle bağlandığı için etkilenmez.

### 10. Örnek veri, hesaplar ve yükleme

**Yükleme:** `npm run db:seed -w server` (önce `npm run db:migrate -w server`). Script kazanımları, 10 soruyu (görselleriyle) ve örnek hesapları yükler. Tekrar çalıştırmak güvenlidir: var olan kayıtlara dokunulmaz, yöneticinin panelden yaptığı değişiklikler korunur.

**Alan eşlemesi (soru paketi → veritabanı):**

| Pakette | Veritabanında |
|---|---|
| `id` | `questions.source_id` |
| `answerKey` | `questions.answer_key` |
| `outcomeKeys` | `question_outcomes` (kod, `learning_outcomes.code` ile eşleşir) |
| `questionNumber`, `page_num` | `questions.question_number`, `questions.page_num` |
| `<id>.jpg` görseli | Supabase Storage, özel `question-images` bucket'ı; yolu `questions.image_path` |
| *(branş alanı yok)* | Sorunun ilk kazanımının kod ön ekinden belirlenir (bkz. Karar 8) |
| `learningOutcomes`, `s3imageUrl`, `bbox`, `createdAt`, `updatedAt`, `index`, `name`, `searchGrade`, `sourceId`, `sourceMetadata`, `type`, `userId` | Kullanılmaz (kazanım açıklamaları kazanım listesinden gelir) |

Kazanım dosyası: anahtar → `learning_outcomes.code`, değer → `learning_outcomes.description`. Dosyadaki 6.411 kaydın tamamı yüklenir; dağılım: Türkçe 1.627, Matematik 736, Fizik 686, Kimya 599, Biyoloji 630, branşsız 2.133.

Soru metni ve şıklar pakette bulunmadığı için saklanmaz; hata bildiriminde bu alanlar, hata türü seçilerek belirtilir.

**Örnek hesaplar** (herkese açık demo hesaplarıdır):

| Rol | Branş | E-posta | Şifre |
|---|---|---|---|
| Yönetici | – | `admin@example.com` | `Admin12345!` |
| Öğretmen | Türkçe | `turkce@example.com` | `Ogretmen12345!` |
| Öğretmen | Matematik | `matematik@example.com` | `Ogretmen12345!` |
| Öğretmen | Fizik | `fizik@example.com` | `Ogretmen12345!` |
| Öğretmen | Kimya | `kimya@example.com` | `Ogretmen12345!` |
| Öğretmen | Biyoloji | `biyoloji@example.com` | `Ogretmen12345!` |

**E-posta testi:** Örnek öğretmen adresleri (`example.com`) gerçek bir posta kutusuna ait değildir, e-posta almazlar. Atama e-postasının gerçekten ulaştığını görmek için yönetici panelinden **kendi e-posta adresinle yeni bir öğretmen oluşturup** ona soru atayın.

### 11. Video çıktısı ve çizim tahtası

**Karar**

- **Çıktı:** 1280×720 (16:9), 15 kare/sn, H.264/AAC MP4. Kayıt **en fazla 3 dakika** (ücretsiz Supabase planında tek dosya sınırı 50 MB).
- **Tahta:** Çizim yüzeyi, soru görselinden bağımsız, **sabit 1280×720 mantıksal koordinat sistemidir.** Soru görseli tahtanın sol tarafına oranı korunarak yerleştirilir; geri kalan alan çözümü yazmak için boştur. Çizimler ve silgi hareketleri bu tahta koordinatlarında, kayıt süresine göre zaman damgalı olarak saklanır.
- **Katmanlar:** Beyaz zemin, soru görseli, bunun üstünde şeffaf bir *çizim katmanı*. Silgi soru görseline dokunmaz.
- **Silgi parça silgisidir:** Çizgiye (kenarına, ucuna bile) değdiği anda o çizginin **tamamı** silinir; alan silgisi değildir. Video, çizginin silindiği andan itibaren onu göstermez.
- **Çizim günlüğü:** Olaylar gerçekleşme sırasıyla tutulur: `stroke` (kalemle çizilmiş çizgi: renk, kalınlık, zamanlı noktalar) ve `erase` (silinen çizgi ve zamanı). Sıra, zaman damgaları eşit olduğunda (örneğin duraklatma sırasında) neyin önce olduğunu belirler.
- **Duraklatma:** Kayıt saati durur. Duraklatma sırasında yapılan çizimler duraklatma anının zaman damgasını alır; kayıt devam ettiğinde videoda ilk karede görünür.

**Gerekçe**

- Soru görselleri 618–1386 piksel yükseklikte ve oranları çok farklıdır; sabit tahta sayesinde web, mobil ve tablet aynı koordinatlarla aynı videoyu üretir, ekran boyutu sonucu etkilemez.
- Görseller küçük olduğundan, çözümü yazmak için görselin dışında da boş alan gerekir.
- Kalem çizgisi, noktaların orta noktalarından geçen yumuşatılmış eğrilerle (ikinci derece Bézier, yuvarlak uçlu) çizilir; küçük ve hızlı el hareketlerinde (örneğin küçük bir "3") köşeli görünmez. Ekranda ve videoda aynı koddan çizilir.

**Bilinen kısıtlar**

- Çok uzun (dikey) soru görselleri 720 piksel yüksekliğe sığması için küçültülür (en uzun örnek yaklaşık %46); okunabilirlik gerçek videoda kontrol edilecek, gerekirse çözünürlük artırılır.

**Sunucu renderer'ı (`server/src/render/renderVideo.ts`)**

- Kareler `@napi-rs/canvas` ile çizilir, ham piksel olarak `ffmpeg`'e (`ffmpeg-static` paketi, ayrıca kurulum gerektirmez) verilir; H.264 + AAC, `yuv420p` MP4 üretilir. Çizim kodu (`shared/src/drawing.ts`) istemcilerle ortaktır.
- Her karede, o ana kadar gerçekleşen çizim adımları (çizgiler ve silmeler) çizim katmanına işlenir; bir çizgi silindiğinde katman temizlenip silinmemiş çizgiler yeniden çizilir. Değişiklik olmayan karelerde önceki kare yeniden kullanılır.
- Deneme: `npm run render:demo -w server -- <çıktı klasörü> [süre sn]` elle hazırlanmış olaylarla (kalem, silgi, duraklatma sırasında çizim, ses) MP4 üretir.
- **Doğrulandı:** MP4 1280×720, 15 kare/sn, ses akışı var ve sessiz değil; çizim zamanla ilerliyor; silgi bir çizgiye (yalnızca ucuna değse bile) değince çizginin tamamı silme anından itibaren videodan kalkıyor, soru görseline dokunmuyor ve geri gelmiyor; duraklatma sırasında yapılan çizim, devam anının ilk karesinde görünüyor; küçük bir "3" yalnızca 9 seyrek noktadan akıcı bir eğri olarak çiziliyor.
- **Ölçüm:** 3 dakikalık video yaklaşık 11 saniyede üretildi (~17 kat gerçek zamanlı), dosya 2,7 MB.

### 12. Web tahtası: HTML canvas

**Karar:** Web'de çözüm tahtası ham HTML canvas ile yapılır (`web/src/studio/Board.tsx`); SVG veya çizim kütüphanesi kullanılmaz.

**Gerekçe:** Çizim akıcılığı görevin en kritik ölçütlerinden biridir. Canvas'ta işaretçi olayları React'ten geçmeden doğrudan çizime çevrilir; böylece çizgi işaretçiyi gecikmeden izler ve silgi davranışı üzerinde tam kontrol kalır.

**Nasıl çalışır**

- İki katman: zemin (beyaz + soru görseli) ve şeffaf çizim katmanı. Katmanlar 1280×720 mantıksal çözünürlüktedir, CSS ile ekrana sığdırılır.
- Silgi parça silgisidir: silgi işaretçisi bir çizgiye değdiğinde (hızlı harekette üstünden atlamasın diye yolu küçük adımlarla taranır) çizginin tamamı silinir.
- Pointer Events kullanılır (fare, kalem ve dokunmatik aynı kodla). İşaretçi yakalanır, ikinci parmak yok sayılır.
- Hızlı harekette tarayıcının iki olay arasında biriktirdiği ara noktalar da alınır (`getCoalescedEvents`), çizgi kopmaz.
- Her noktanın kayıt süresi, olayın gerçekleştiği an esas alınarak hesaplanır ve geriye gitmez.
- Çizim, sunucudaki renderer'la aynı `InkPainter` sınıfıyla yapılır (`shared/`).
- `desynchronized` canvas ipucu ile tarayıcıdan çizimi daha düşük gecikmeyle ekrana göndermesi istenir.

**Doğrulama (Chrome, otomatik):** kalem çiziyor; silgi bir çizginin ucuna değince tüm çizgiyi siliyor, uzaktaki çizgilere ve soru görseline dokunmuyor; küçük bir "3" akıcı çıkıyor. Yoğun kalem hareketinde (1.500 `pointermove`) olay işleme süresi ortalama 0,13 ms, en yüksek 0,5 ms; 40 çizgi varken silgi hareketinde ortalama 0,37 ms, en yüksek 4 ms ölçüldü. Bu, yalnızca yazılımın olay işleme süresidir; ekrandaki algılanan gecikme gerçek fare, kalem veya dokunmatikle elle de denenmelidir.

### 13. Web kayıt akışı

**Akış:** Başlat → kayıt sürerken Duraklat / Devam et ve Bitir, süre göstergesi (en fazla 3:00) → Bitir sonrası sunucu MP4'ü üretir, önizleme sayfada oynatılır.

**Önizleme** (`web/src/studio/VideoPreview.tsx`): Tarayıcıların hazır video kontrolleri bitince yeniden oynatmayı her yerde göstermediği için kendi oynatıcımız vardır: her zaman görünen Oynat/Duraklat düğmesi (bitince "Baştan oynat"), konum çubuğu, süre göstergesi ve videoya tıklayarak oynat/duraklat. **Kaydet** düğmesi şimdilik MP4'ü bilgisayara indirir; sisteme kaydetme (atamaya bağlı) giriş ve atama sistemiyle gelecektir.

**Nasıl çalışır** (`web/src/studio/useRecorder.ts`)

- **Kayıt saati** yalnızca kayıt sürerken ilerler, duraklatınca donar. Çizim zaman damgaları bu saate göre alınır; bu yüzden duraklatma süresi videoya girmez ve duraklatma sırasında yapılan çizimler (hepsi duraklatma anının zamanını taşır) devam edildiğinde videoda belirir.
- **Ses** `MediaRecorder` ile kaydedilir (Chrome'da webm/opus, Safari'de mp4); duraklat/devam aynı ses dosyasına devam eder. Saat, ses kaydı gerçekten başladığı anda sıfırlanır; böylece ses ve çizim aynı anda başlar.
- **Kayıt başlamadan önce ve bittikten sonra tahtaya çizilemez.** Duraklatmada çizilebilir.
- Süre sınırına (3 dk) gelince kayıt kendiliğinden biter.

**Engelleyici durumlar:** Mikrofon izni verilmediyse, mikrofon bulunamazsa veya açılamazsa kayıt başlamaz ve anlaşılır bir uyarı gösterilir. Kayıt sırasında mikrofon bağlantısı kesilirse kayıt bitirilemez ve uyarı gösterilir. Soru görseli seçilmeden kayıt başlatılamaz.

**Geçici geliştirme uç noktaları:** Giriş ve atama sistemi henüz olmadığı için kayıt `POST /api/dev/render` ile sunucuya gönderilir (görsel, ses, çizim günlüğü, süre); sunucu MP4'ü üretir ve `{ id, renderMs, sizeBytes }` döndürür. Video, `GET /api/dev/video/:id` adresinden sunulur (aralık isteği destekli, yani oynatıcılarda ileri-geri sarma çalışır; kimlik biçimi doğrulanır, bir saat sonra silinir). Web ve mobil videoyu bu adresten oynatır. Bu uç nokta **kimlik doğrulaması ve atama kontrolü içermez**, yalnızca `NODE_ENV !== 'production'` iken açılır ve atamaya bağlı gerçek yükleme uç noktası yazılınca kaldırılacaktır. Sunucu, gelen çizim günlüğünü doğrular (şekil, sayı sınırları, zaman damgalarının geriye gitmemesi, yalnızca daha önce çizilmiş bir çizginin silinebilmesi); bozuk istekler 400 döner. Geliştirmede web, `/api` isteklerini Vite proxy'siyle sunucuya yönlendirir.

**Doğrulama (Chrome, sahte mikrofonla otomatik):** kayıt başlamadan çizim engelli; başlat–çiz–duraklat–duraklatmada çiz–devam–çiz–sil–bitir akışı çalışıyor; üretilen MP4 1280×720, 15 kare/sn, AAC ses akışı var ve sessiz değil; video süresi kayıt saatiyle aynı (duraklatma süresi çıkarılmış); duraklatmada çizilen çizgi devam anından itibaren görünüyor; silinen çizgi silme anından sonra videoda yok; mikrofon izni reddedilince Türkçe uyarı çıkıyor, kayıt başlamıyor.

**Doğrulanmadı:** gerçek mikrofonla ses–çizim eşzamanlılığı ve uzun kayıtlarda tarayıcı davranışı (elle denenmeli).

### 14. Mobil stüdyo: Skia ile çizim, expo-audio ile ses

**Karar:** Mobil stüdyoda çizim **`@shopify/react-native-skia`** ile yapılır; ses kaydı **`expo-audio`** ile yapılır. Çizim modeli (çizgi/silme olayları, yumuşatma, kayıt saati) web ile aynıdır; video yine sunucuda üretilir.

**Gerekçe:** Çizim akıcılığı görevin en kritik ölçütüdür. Skia GPU destekli çizim yapar. `react-native-svg` her noktada bileşen güncellemesi gerektirdiği için canlı çizimde gecikme riski taşır; WebView'a gömülen web tahtası ise hem dokunma gecikmesi getirir hem de "React Native uygulaması" olarak sayılmayabilir.

**Nasıl çalışır** (`mobile/src/studio/`)

- **Ortak çizim kodu:** `shared/` içindeki `InkPainter` (çizim) ve `InkController` (kalem/silgi etkileşimi) mobilde de aynen kullanılır; web, mobil ve sunucudaki video aynı koddan çıktığı için çizgiler aynıdır. `SkiaDrawingContext`, ortak kodun tarayıcı canvas'ına benzeyen çağrılarını (`moveTo`, `quadraticCurveTo`, `stroke`) Skia yoluna (`PathBuilder`) çeviren küçük bir adaptördür.
- **Çizim yüzeyi:** 1280×720 mantıksal boyutlu ekran dışı bir Skia yüzeyine çizilir; her ekran karesinde en fazla bir kez görüntüsü alınır ve paylaşılan değer (Reanimated) ile ekrandaki canvas'a verilir, böylece React her çizgi noktasında yeniden çizilmez.
- **Ekran yönü:** **Telefonda yalnızca yatay**, dikey ve yatay yalnızca **tablette** desteklenir. Uygulama açılınca ekranın kısa kenarına bakılır (600 birim ve üstü tablet sayılır); telefonda ekran yataya kilitlenir (`expo-screen-orientation`), tablette kilit kaldırılır. Kilit uygulanana kadar telefonda dikey arayüz hiç gösterilmez; sistem kilidi reddederse (iOS 27+'da yeniden boyutlanabilir iPhone uygulamalarında olabilir) kısa bir bekleyişten sonra mevcut yönde çalışmaya devam edilir. iPhone simülatöründe dikey açılan uygulamanın kendiliğinden yataya döndüğü, iPad simülatöründe kilitlenmediği ve iki yönde de çalıştığı doğrulandı. Not: yön kilidi çalışma zamanında uygulanır; mağaza yapısında başlangıç yönü `Info.plist` ile de sınırlanabilir.
- **Yerleşim:** Her iki yönde ve her cihazda **aynı** yerleşim kullanılır: soru tahtası ekrana oranını koruyarak sığar (durum çubuğu gizlenir), kalem/silgi/kayıt kontrolleri tahtanın sağ kenarında dikey sütun olarak yüzer, süre sağ üstte durur. Tahta video çıktısıyla aynı 16:9 oranındadır; bu yüzden tablet dikeyde tahta ekran genişliğini doldurur, yükseklikte boşluk kalır. Tüm kontroller aynı küçük yuvarlak düğme tasarımındadır (`StudioControls`), seçili araç mavi çerçevelidir. Ekran çentiği ve kenar boşlukları `react-native-safe-area-context` ile hesaplanır. Ekran dönse de aynı bileşen ağacı korunur; tahta yeniden oluşmaz ve çizimler kaybolmaz. Geliştirici deneme düğmeleri arayüzden kaldırıldı (otomatik deneme yalnızca `EXPO_PUBLIC_AUTO_DEMO` ile çalışır).
- **Kayıt kontrolleri:** ✏️ kalem, 🧽 silgi, ardından kayıt düğmeleri duruma göre değişir ve emoji yerine kendi çizdiğimiz sade simgelerdir (`icons.tsx`): bekleme kırmızı daire (başlat); kayıt sürerken iki çubuk (duraklat) ve kare (dur); duraklatılmışken üçgen (devam et) ve kare. Süre göstergesi (`00:12 / 03:00`) kayıtta kırmızı nokta, duraklatmada duraklatma simgesi gösterir ve duraklatınca donar. **Kayıt başlamadan da çizilebilir**; bu çizimler videonun ilk karesinden itibaren görünür (web'de şimdilik kayıttan önce çizilemez). Çizim kayıt sürerken ve duraklatmada da yapılır; kayıt 3 dakikada kendiliğinden biter.
- **Mikrofon:** `expo-audio` (`useRecorder.ts`). Başlatırken mikrofon izni istenir; izin verilmezse kayıt başlamaz ve Türkçe uyarı gösterilir. Duraklatma `pause()`, devam etme `record()` çağrısıyla yapılır (aynı ses dosyasına devam eder; deneyle doğrulandı: duraklatma süresi ses dosyasına girmez). Kayıt sırasında kaydedici hata bildirirse kayıt bitirilemez. Kayıt saati ses kaydı başladığı anda sıfırlanır.
- **Dur → hazırlama → izle → kaydet:** Dur (kare) ile ses dosyası, çizim günlüğü ve soru görseli sunucuya yüklenir (`/api/dev/render`); "Video hazırlanıyor…" katmanı gösterilir, hata olursa *Tekrar dene / Vazgeç* sunulur. Hazır olunca izleme ekranı açılır (`PreviewScreen`, `expo-video`): oynat/duraklat (bitince baştan oynatır), konum çubuğuna dokunarak ileri-geri sarma, süre. **Kaydet**, videoyu telefona indirir (`expo-file-system`) ve galeriye kaydeder (`expo-media-library`, `legacy` içe aktarması: güncel API'de `saveToLibraryAsync` kullanımdan kaldırılmıştır). **Yeni kayıt** tahtayı temizler. Yatayda video tam ekrandır ve kontroller altta yarı saydam bir şeritte durur.
- **Sunucu adresi:** `EXPO_PUBLIC_API_URL` (varsayılan `http://localhost:4000`, iOS simülatörü içindir). Gerçek telefonda bilgisayarın yerel ağ adresi verilmelidir.
- **Dokunma:** React Native'in kendi dokunma olayları (`onTouchStart/Move/End`) kullanılır: tanıma gecikmesi yoktur ve tek parmak izlenir. `react-native-gesture-handler` 3.x sürümünün API'si köklü biçimde değiştiği için ve çizim zaten JS tarafında yapıldığı için bu kütüphane çizimde kullanılmadı (kurulu; gerekirse navigasyon için kullanılabilir).
- **Ses kaydı:** `expo-audio` (`AudioRecorder`: `record`, `pause`, `stop`, `uri`); Expo Go'da çalıştığı Expo SDK 58 dokümanından doğrulandı.

**Doğrulama:** iOS simülatöründe (Expo Go) soru görseli, kalemle yumuşatılmış çizgiler (küçük bir "3" dahil) ve silgi, dokunmasız programatik denemeyle ekran görüntüleriyle doğrulandı: ucuna değen silgi çizginin tamamını sildi, diğer çizgiler kaldı. Gerçek dokunmayla akıcılık elle denenecektir.

**Bilinen kısıtlar**

- Expo SDK 58'in `fetch`'i, React Native'in eski `{ uri, name, type }` dosya biçimini **desteklemez** (hata: *Unsupported FormDataPart implementation*). Yükleme `expo/fetch` ve `expo-file-system`'ın `File` nesnesiyle yapılır.
- Simülatörde mikrofon, Mac'in mikrofonunu kullanır; test ortamında ses sessiz gelebilir (ses akışı yine de oluşur). Gerçek ses elle denenmelidir. Galeriye kaydetme ilk kullanımda fotoğraf izni ister.
- Expo Go'da galeri erişimi Android'de kısıtlıdır (Expo uyarısı); kaydetme iOS'ta doğrulandı.
- Çizim yüzeyi **CPU** destekli oluşturulur. GPU destekli yüzey (`MakeOffscreen`) denendi; çizim yüzeyde vardı (piksel okuma ile doğrulandı) ama iOS simülatöründe ekrandaki canvas'a yansımadı. Gerçek cihazda GPU yüzeyi ayrıca denenebilir.
- Etkileşim JS iş parçacığında işlenir; JS iş parçacığı meşgulse çizim gecikebilir. Akıcılık elle denenip gerekirse iyileştirilecektir.
- Geliştirmede Metro'yu `CI=1` ile başlatmayın: bu modda dosya değişiklikleri izlenmez ve uygulama eski kodu çalıştırır. `npm run dev:mobile` yeterlidir.

### MVP kapsamı (video stüdyosu)

- Kalem ve silgi, tek renk ve tek kalınlık
- Başlat, duraklat, devam ettir, bitir
- Mikrofon izni yoksa kayıt bitirilemez, anlaşılır uyarı gösterilir
- Sunucuda MP4 üretimi, kırpma (baştan/sondan)
- **MVP sonrası:** kamera bindirmesi, ek renk/kalınlık

## Açık noktalar ve kalan işler

Görevin açık bıraktığı noktaların çoğu karara bağlandı (Karar 15–27). **Hâlâ açık olanlar** (varsayılan davranış yazılıdır, değiştirilebilir):

- **Mevcut video görünürlüğü:** karara bağlandı (Karar 27): çapraz atanan öğretmen başkalarının videolarını görmez.
- **Branşı değişen öğretmenin mevcut atamaları:** şimdilik korunur (branş serbestçe değiştirilebilir).
- **Yeni soru ekleme ekranı** ve **kazanım ekleme/silme:** yapılmadı; demo "paketten soru açma" ile yapılır, kazanım için zorunlu olan güncelleme vardır.
- **Arka plana geçiş:** kayıt sırasında uygulama/sekme arka plana alınırsa, tarayıcıda ses kaydı sürebilir; mobilde işletim sistemi kaydı durdurabilir (gerçek cihazda ayrıca denenmelidir).
- **Doğrulanamayanlar (simülatör/başsız tarayıcı sınırı):** gerçek mikrofonla ses senkronu, gerçek kamera ve kamera+mikrofonun iOS'ta birlikte çalışması, Apple Pencil, gerçek cihazda push.

### Geçici uç noktalar kaldırıldı
Kimlik doğrulamasız `/api/dev/*` uç noktaları, atamaya bağlı gerçek yükleme (`POST /api/teacher/assignments/:id/recording`) yazıldığı için **kaldırıldı**. `npm run render:demo` yalnızca renderer'ı elle denemek içindir.

### Kamera bindirmesi ve tablet kalemi (uygulandı)
- Kamera yalnızca **web ve tablette** vardır (telefonda düğme çıkmaz); isteğe bağlıdır. Açıksa tahtanın sağ altında 240x180 px dikdörtgen olarak hem kayıt ekranında görünür hem de sunucuda ffmpeg ile videoya bindirilir. İzin yoksa/kamera kapalıysa ekran ve sesle devam eder.
- Web: kamera ayrı bir MediaRecorder klibidir, duraklat/devam ses ile birlikte yürür. Mobil: expo-camera kaydı duraklatamadığı için her duraklatmada klip kapanır, devamda yenisi açılır; sunucu klipleri art arda ekler.
- Tablet kalemi: Apple Pencil/S Pen normal işaretçi olarak çizer; kalem kullanılırken parmak/avuç dokunuşları 1,2 sn yok sayılır (iOS `touchType`, web `pointerType`).
- Doğrulanmadı: gerçek kamera (simülatörde yok), gerçek Apple Pencil, iOS'ta kamera + mikrofonun aynı anda çalışması.

### Karar 15 — Giriş, oturum ve öğretmen yönetimi (başlandı)
- **Tek web uygulaması, rol bazlı:** yönetici ve öğretmen aynı React uygulamasında, giriş yapan kullanıcının rolüne göre farklı ekranlar görür. Gerekçe: giriş, oturum ve stüdyo kodu tek yerde kalır; iki ayrı uygulama bakım ve zaman yükünü ikiye katlardı.
- **Ortak giriş ekranı, iki sekme:** "Yönetici girişi" ve "Öğretmen girişi". Sekme, hesabın gerçek rolüyle karşılaştırılır; yönetici hesabı öğretmen sekmesinden (veya tersi) giremez ve doğru sekmeyi seçmesi söylenir. Hatalı e-posta/şifre ve silinmiş hesap aynı genel mesajı alır.
- **Oturum:** istemciler Supabase'e bağlanmaz; `POST /api/auth/login` sunucuda Supabase Auth ile şifreyi doğrular, erişim + yenileme jetonu döner. Her istek `Authorization: Bearer` taşır, sunucu jetonu Supabase'e doğrulatır ve `profiles` kaydını (silinmemiş) okur. 401'de istemci bir kez yeniler, olmazsa oturumu kapatır. Web her 30 sn `/api/auth/me` sorgular (silinen öğretmenin oturumu otomatik kapanır).
- **Öğretmen ekleme:** yönetici ad, soyad, e-posta, şifre (en az 8) ve branşı girer; sunucu Auth kullanıcısını açar, profil satırını yazar (profil yazılamazsa Auth kaydı geri silinir). Aynı e-posta ikinci kez eklenemez.
- Şimdilik yapılan: giriş/çıkış, öğretmen listesi, öğretmen ekleme (web). **Sıradakiler:** mobil giriş, öğretmen güncelleme/silme.

### Karar 16 — Renk paleti ve yönetici sayfa düzeni
- **Renkler:** İşler Teknoloji sitesinden (islerteknoloji.com, CSS'inde en çok kullanılan renkler) alındı: turuncu `#f14e13` (ana vurgu, düğmeler), koyu patlıcan `#1a0e1c` (sol menü, başlıklar), adaçayı `#b5cbc8` (kenarlık, tablo başlığı), koyu bordo `#4f0006` (uyarı/geri gönderildi). İşler Yayınevi'nin ayrı bir kurumsal kılavuzuna ulaşılamadığı için aynı grubun sitesindeki palet esas alındı. Tüm renkler `web/src/index.css` başındaki CSS değişkenlerindedir; değiştirmek için orayı düzenlemek yeterli.
- **Yönetici düzeni:** sol menülü tek sayfa uygulaması. Menü, görevdeki yönetici akışını izler: Panel, Öğretmenler, Sorular, Kazanımlar, Atamalar, Onay kuyruğu, Hata bildirimleri. Sayfa adreste `#/...` ile seçilir (yenilemede aynı sayfada kalır). Panel gerçek verilerle çalışır (öğretmen/soru/kazanım sayısı, atama durumu dağılımı, hata bildirimi sayısı); Öğretmenler listesi ve ekleme çalışır; diğer sayfalar yerleşim olarak hazır, içerikleri sıradaki adımlarda yapılacak.
- Sıra: yönetici ekranları → öğretmen ekranları → mobil ve tablet.

### Karar 17 — Öğretmen güncelleme ve silme
- **Güncelleme:** ad, soyad, e-posta, branş ve şifre değiştirilebilir (şifre boş bırakılırsa değişmez). E-posta/şifre Supabase Auth'ta da güncellenir.
- **Silme (yumuşak):** profil `deleted_at` ile işaretlenir ve Auth hesabı silinir; atama, kayıt ve hata bildirimleri yerinde kalır. Silinen öğretmen giriş yapamaz; açık oturumu bir sonraki istekte (en geç ~30 sn içinde) otomatik kapanır ve giriş ekranında "Oturumunuz sonlandırıldı" mesajı görünür. Silinen öğretmenin e-postası yeniden kullanılabilir.
- **Branş değişikliği:** şimdilik serbest; mevcut atamalar korunur (bekleyen karar: branş değişince atamalara ne olacağı).

### Karar 18 — Sorular, kazanım arama ve cevap anahtarı (yönetici)
- **Sorular:** 10 soru veritabanından kart olarak listelenir (görsel, branş, cevap anahtarı, kazanım sayısı); karta tıklayınca detay açılır (`#/sorular/<id>`). Görseller özel Storage bucket'ındadır; ekrana 1 saatlik imzalı adresle verilir.
- **Cevap anahtarı** (A–E) ve **kazanımlar** her değişiklikte anında veritabanına yazılır, ardından soru yeniden okunur; yenilemede kalıcıdır. Bir sorunun **en az bir kazanımı** olmalıdır: son kazanım çıkarılamaz (sunucu 409 döner).
- **Kazanım ekleme:** arama kutusuna yazdıkça (250 ms gecikmeyle) sunucu, veritabanındaki kazanım listesini kod/açıklamaya göre süzer (ilk 30 sonuç); sonuca tıklayınca kazanım soruya eklenir. Varsayılan olarak yalnızca sorunun branşındaki kazanımlar aranır (onay kutusuyla tüm branşlar). Bir soruya birden fazla kazanım eklenebilir.
- **Kazanımlar sayfası:** arama + branş süzme; bir kazanımın **açıklaması ve branşı** güncellenebilir (kod değişmez). Kazanım ekleme/silme yapılmadı (görevde zorunlu olan yalnızca güncelleme).
- Soru paketinde soru metni ve şıklar yoktur (yalnızca görsel), bu yüzden hata bildiriminde bu alanlara işaret etme, görselin hangi bölümünü işaret ettiği olarak yorumlanacaktır (hata bildirimi adımında karara bağlanacak).

### Karar 19 — Atama, e-posta ve push
- **Atama kuralları:** soru yalnızca **kendi branşındaki** aktif öğretmene atanır; aynı soru **aynı öğretmene ikinci kez atanamaz** (409); aynı soru **farklı öğretmenlere** atanabilir, her öğretmen kendi kaydını üretir. Yeni atama durumu "Atandı"dır.
- **Atamada olanlar:** atama ve bildirim satırı aynı veritabanı işleminde yazılır (biri başarısızsa ikisi de geri alınır). Ardından e-posta ve push ayrıca denenir; bunların hatası atamayı geri almaz, sonuç yöneticiye gösterilir ("E-posta gönderildi / gönderilmedi", "Push N cihaza gönderildi").
- **Yönetici ekranları:** Atamalar sayfası (tüm atamalar, duruma göre süzme, yeni atama: soru seçince yalnızca o branştaki öğretmenler listelenir) ve soru detayında o soruya ait atamalar + atama formu. Sorular listesinde branş, cevap anahtarı, atanma durumu ve metin (soru no, kazanım kodu/açıklaması) süzgeçleri vardır.

**E-posta yaklaşımı ve kurulumu (Nodemailer + Gmail SMTP):** e-posta içeriği branş, soru ve kazanım kodlarını ve uygulama bağlantısını içerir. Kurulum: Google Hesabı'nda 2 Adımlı Doğrulama açık olmalı; Güvenlik > Uygulama şifreleri'nden 16 haneli bir şifre üretilir ve `server/.env` dosyasına `SMTP_USER` (Gmail adresi) ile `SMTP_PASS` (uygulama şifresi, normal şifre değil) yazılır; isteğe bağlı `MAIL_FROM` ve `APP_URL` tanımlanır (`server/.env.example`). Bu değerler tanımlı değilse atama yine yapılır ve ekranda "E-posta ayarı yapılmamış" uyarısı görünür. Test için alıcı olarak kendi e-posta adreslerinizle öğretmen oluşturulabilir.

**Push yaklaşımı ve kurulumu (Expo Push):** mobil uygulama öğretmen girişi yapınca Expo push jetonunu `POST /api/push-token` ile sunucuya kaydeder (`push_tokens` tablosu, bir öğretmenin birden fazla cihazı olabilir). Atamada sunucu o öğretmenin jetonlarına Expo Push API'siyle (`exp.host`) bildirim gönderir; jeton yoksa (uygulama yüklü değil) sessizce geçilir. Expo Go'da ek anahtar gerekmez. Sunucu tarafı hazırdır; jetonu alıp gönderen mobil kısım mobil adımında yapılacak. Not: push, simülatörde değil gerçek cihazda denenebilir.

### Karar 20 — Hız iyileştirmeleri
Veritabanı ve Storage uzak (Supabase) olduğundan her ağ gidiş-dönüşü ~0,3 sn tutuyordu; liste 3,5 sn + görseller 2 sn sürüyordu. Yapılanlar:
- **Jeton yerel doğrulanır:** erişim jetonu Supabase'in açık anahtarlarıyla (JWKS, önbellekli) sunucuda doğrulanır; her istekte Supabase Auth'a gidilmez. Profil 10 sn önbelleğe alınır (silinen hesap en geç 10 sn sonra reddedilir; silme anında önbellek temizlenir).
- **Tek sorgu:** soru listesi, kazanımları ve atama sayılarıyla tek SQL sorgusunda okunur.
- **Görseller sunucudan:** soru görselleri Storage'dan bir kez alınıp sunucu belleğinde tutulur (açılışta ısıtılır) ve HMAC imzalı, süreli, tarayıcı önbellekli bir adresle (`/api/question-images/...`) verilir. Görsel hâlâ özel bucket'tadır; adres yalnızca yetkili kullanıcıya üretilir.
- **Ekran:** soru listesi bellekte tutulur; listeden detaya geçişte ekran hemen dolar, arkada yenilenir.
Sonuç: liste görselleriyle birlikte ~0,4 sn, detay anında açılır.

### Karar 21 — Öğretmen dashboard'u (web)
- **Ekranlar:** Panel (atama durumu sayıları, okunmamış bildirimler, sorular), Sorularım (liste) ve soru sayfası, Bildirimler. Yönetici ve öğretmen aynı menülü düzeni (`AppShell`) kullanır.
- **Soru listesi:** branş, soru bilgisi (soru no, kazanım kodları), görsel ve çözüm durumu (Atandı, Onaya gönderildi, Onaylandı, Geri gönderildi; "Kayıt bekleniyor" ipucuyla). Soru atanmamışsa liste boş kalır ve kısa bir açıklama gösterilir.
- **Bildirimler:** okunmamışlar vurgulanır, menüde rozet görünür; bildirime tıklayınca okundu olur ve ilgili soruya gidilir. Liste 30 sn'de bir yenilenir (yeni atama kısa sürede görünür). "Tümünü okundu yap" vardır.
- **Görünürlük:** öğretmen yalnızca kendi atamalarını görür; başkasının atamasına erişim 404 döner (varlığı belli edilmez), yönetici rotalarına erişim 403 döner.
- **Varsayım (açık nokta):** öğretmene **cevap anahtarı gösterilmez**, sorunun **kazanımları gösterilir**.
- Soru sayfasındaki "Kayıt oluştur" stüdyoyu açar ve soru görselini otomatik yükler. Kaydı sisteme kaydetme, izleme, silme, kırpma ve onaya gönderme sıradaki adımdır.

### Karar 22 — Hesap e-postası (giriş bilgileri öğretmene gider)
- Yönetici öğretmen **oluşturunca** öğretmenin e-postasına hesap bilgileri gönderilir: e-posta (kullanıcı adı), yöneticinin girdiği şifre, branş ve giriş bağlantısı. Yönetici bir öğretmenin **şifresini değiştirirse** yeni şifre de e-postayla bildirilir (şifre boş bırakılırsa e-posta gitmez).
- E-posta hatası hesabı geri almaz; sonuç yöneticiye gösterilir ("gönderildi / gönderilmedi (ayar yok) / gönderilemedi"), gerekirse bilgileri öğretmene yönetici iletir.
- **Güvenlik notu:** şifrenin düz metin e-postayla gitmesi bilinçli bir kolaylıktır (yönetici şifreyi belirliyor ve öğretmene iletmesi gerekiyor). Canlıda daha güvenli yol, öğretmene tek kullanımlık "şifre belirle" bağlantısı göndermek olurdu; şifre değiştirme ekranı yapılırsa öğretmenden ilk girişte şifresini değiştirmesi istenebilir.

### Karar 23 — Çözüm kaydını sisteme kaydetme, onaya gönderme ve onay akışı
- **Kaydet = sisteme kaydet:** öğretmen kaydı bitirince sunucu MP4'ü üretir ve **otomatik olarak sisteme kaydeder** (özel `recordings` Storage bucket'ı + `recordings` tablosu, atama başına tek güncel kayıt). Cihaza indirme yoktur (yalnızca geçici geliştirme akışında kaldı). Kayıt sonrası seçenekler: **Onaya gönder**, **Taslak olarak kaydet** (soru sayfasına dön), **Yeniden çek**. Yükleme başarısız olursa kayıt bellekte tutulur ve "Tekrar dene" ile yeniden gönderilir.
- **Öğretmen erişimi:** kendi soru sayfasında kaydını izler, yeniden kaydeder, **siler** ve onaya gönderir. Başkasının kaydına erişemez (404).
- **Video sunumu:** `<video>` kimlik başlığı gönderemediğinden video, HMAC imzalı + süreli adresle (`/api/recording-videos/...`) ve Range desteğiyle sunulur; adres yalnızca yetkili kullanıcıya üretilir, sunucu diskinde önbelleklenir. Silinen kaydın dosyası Storage'dan kaldırılır, eski adres 404 döner (yönetici izleyemez).
- **Onaya gönderme:** yalnızca hazır kaydı olan ve "Atandı" ya da "Geri gönderildi" durumundaki atama gönderilebilir. Gönderilmeyen kayıt yönetici kuyruğunda görünmez.
- **Yönetici — Onay kuyruğu:** onaya gönderilen videolar tarayıcı içinde izlenir (harici oynatıcı yok). **Onayla** veya **Geri gönder** (not zorunlu, en fazla 500 karakter, öğretmene görünür). Her iki işlemde öğretmene bildirim (ve push) gider ("Videonuz onaylandı / geri gönderildi"). Atamalar sayfasında ve soru detayında da kaydı olan atamalar için "İzle" vardır.
- **Düzenleme sonrası durum (açık nokta kararı):** kayıt yeniden çekilir veya silinirse, *Onaya gönderildi / Onaylandı* durumundaki atama **Atandı**'ya (taslak) döner ve yeniden onaya gönderilmelidir; *Geri gönderildi* durumundaki atama **Geri gönderildi** kalır (yönetici notu görünmeye devam eder), öğretmen düzeltip yeniden gönderir; gönderince not temizlenir.

### Karar 24 — Açılır kapanır menü ve bildirim düğmesi
- **Menü:** sol koyu menü, üst çubuktaki düğmeyle açılıp kapanır (yönetici ve öğretmen); tercih tarayıcıda hatırlanır, dar ekranda varsayılan kapalıdır.
- **Bildirimler:** ayrı sayfa kaldırıldı; sağ üstte zil düğmesi ve okunmamış sayısı rozeti vardır. Tıklayınca bildirimler açılır liste olarak gelir (Esc veya dışarı tıklayınca kapanır); bildirime tıklamak onu okundu yapar ve ilgili soruya götürür; "Tümünü okundu yap" vardır. Okunmamış bildirimler vurgulanır, okunanlar listede soluk kalır.

### Karar 25 — Hata bildirimi
- **Türler:** Soru metninde hata, Şıklarda hata, Yazım yanlışı, Kırpma hatası, Cevap anahtarı hatası, Kazanım hatası + **Diğer** (serbest metin). Kısa açıklama yazılır (en fazla 1000 karakter); yalnızca "Diğer"de zorunludur.
- **Ek (açık nokta kararı):** ek her türde eklenebilir (görev yalnızca serbest bildirimi şart koşuyor, bu bir üst kümedir). Ek tek dosyadır: **ekran görüntüsü** (JPEG/PNG/WebP, en fazla 5 MB) **veya en fazla 1 dakikalık video** (MP4/WebM/MOV, en fazla 30 MB). Süre hem tarayıcıda hem sunucuda (ffmpeg ile) denetlenir; süre okunamayan dosyalar (bazı tarayıcı kayıtları) kabul edilir. Ekler özel Storage bucket'ında (`error-attachments`) saklanır, imzalı süreli adresle sunulur.
- **"Soru metni ve şıklara işaret etme":** soru paketinde metin ve şıklar ayrı alan olarak yoktur (yalnızca görsel), bu yüzden öğretmen sorunun **görseli üzerinde hatanın yerini işaretler** (oransal konum olarak saklanır: `marker_x/marker_y`); ayrıca "Soru metninde hata" / "Şıklarda hata" türleri vardır. Yönetici işareti görsel üzerinde kırmızı halka olarak görür.
- **Görünürlük:** yalnızca soruyu atanmış öğretmen o soru için bildirim gönderebilir (başkası 404). Öğretmen kendi gönderdiklerini soru sayfasında görür. Yönetici bildirimleri hem **ilgili sorunun üzerinde** (soru detayı) hem **Hata bildirimleri** sayfasında (türe göre süzme), **gönderen öğretmenin adıyla** görür; panelde toplam sayı vardır.
- Yapılmadı: bildirimin "çözüldü" işaretlenmesi ve yöneticiye anlık bildirim (isteğe bağlı iyileştirme).

### Karar 26 — Yöneticiye bildirim
- Öğretmen **videoyu onaya gönderince** veya **hata bildirimi oluşturunca** tüm aktif yöneticilere bildirim yazılır: "<Öğretmen> videoyu onaya gönderdi: <Branş - Soru>" ve "<Öğretmen> hata bildirdi (<tür>): <Branş - Soru>". Yönetici de sağ üstteki zil düğmesinde okunmamış sayısını görür; bildirime tıklayınca okundu olur ve ilgili sayfaya gider (video için Onay kuyruğu, hata için sorunun detayı).
- Bildirim sistemi iki role ortaktır (`/api/notifications`): bildirim bir atamaya veya bir hata bildirimine bağlıdır, metin ve gidilecek sayfa türden üretilir. Yöneticiye push gönderilmez (yönetici mobil uygulamaya girmez).
- Hata türü "Diğer (serbest metin)" etiketi "Diğer" olarak sadeleştirildi.

### Karar 27 — Çapraz atama ve kırpma
- **Çapraz atama:** yönetici, videosu olan bir soruyu **aynı branştan başka bir öğretmene** de atayabilir (atama formu yalnızca sorunun branşındaki öğretmenleri listeler; aynı öğretmene ikinci kez atanamaz). Her öğretmen soruyu açar, **kendi kaydını** üretir ve onaya gönderir; her atamanın durumu (Atandı, Onaya gönderildi, Onaylandı, Geri gönderildi) hem o öğretmene hem yöneticiye görünür.
- **Açık nokta kararı — mevcut video görünürlüğü:** çapraz atanan öğretmen, aynı soru için **başka öğretmenlerin videolarını görmez** (onaylanmış olsa bile). Öğretmen yalnızca kendi kayıtlarını görür (görevdeki "öğretmen yalnızca kendi kayıtlarını görür" kuralıyla tutarlı); tüm videoları yalnızca yönetici izler. *(İlk sürümde yalnızca onaylı videolar referans olarak gösteriliyordu; kullanıcı kararıyla kaldırıldı.)*
- **Kırpma:** öğretmen kayıt sayfasında "Kırp"a basar, başlangıç ve bitiş kaydırıcılarıyla (veya "mevcut konumu başlangıç/bitiş yap" ile) aralığı seçer; sunucu ffmpeg ile aralığı keser (yeniden kodlama, kare hassasiyeti) ve **kırpılmış MP4 kaydın yerine geçer**; yönetici kırpılmış videoyu izler. Kırpma geri alınamaz; aradaki süre en az 1 sn olmalıdır. Kırpma da bir düzenlemedir: onaya gönderilmiş/onaylanmış atama taslağa (Atandı) döner ve yeniden gönderilmelidir (Karar 23).

### Karar 28 — Mobil uygulama (öğretmen)
- **Ekranlar:** Giriş (öğretmen; yönetici web panelini kullanır) → Ana sayfa (atama durumu sayıları, sorular, sağ üstte bildirim zili ve çıkış) → Soru sayfası (görsel, durum, yönetici notu, kayıt izleme, yeniden kaydet, kırp, sil, onaya gönder, çapraz atamada onaylı örnek video, kazanımlar, hata bildirimi) → Kayıt stüdyosu, Kırpma, Hata bildirimi. Web ile **aynı hesap, aynı soru listesi, bildirimler ve kayıtlar**; aynı sunucu uç noktaları ve kurallar (web'den gönderilen video mobilde, mobilden gönderilen video webde ve yönetici panelinde görünür).
- **Oturum:** jetonlar `expo-secure-store` ile güvenli depoda tutulur; 401'de bir kez yenilenir; açıkken 30 sn'de bir hesap kontrol edilir, **silinen öğretmenin oturumu otomatik kapanır** ve giriş ekranında bilgilendirilir.
- **Kaydet = sisteme kaydet:** stüdyoda Dur'dan sonra sunucu MP4'ü üretir ve sisteme kaydeder (galeriye indirme yoktur); izleme ekranında **Onaya gönder / Taslak olarak kaydet / Yeniden çek**. Yükleme hatasında "Tekrar dene".
- **Ekran yönü:** telefonda yalnızca kayıt stüdyosu yataydır, diğer ekranlar dikeydir; tablette serbesttir.
- **Hata bildirimi:** web ile aynı türler ve kurallar; hatanın yeri sorunun görseline dokunarak işaretlenir; ek `expo-image-picker` ile seçilir (ekran görüntüsü veya en fazla 1 dk video; süre/boyut istemcide ve sunucuda denetlenir; sunucu dosya türünü baytlardan da anlar).
- **Kırpma:** `@react-native-community/slider` ile başlangıç/bitiş; sunucu kırpılmış MP4'ü kaydın yerine koyar.
- **Push:** giriş yapınca izin istenir ve Expo push jetonu `POST /api/push-token` ile kaydedilir; bildirime tıklanınca ilgili soru açılır. **Kurulum notu:** Expo Go'da push yalnızca gerçek cihazda ve (iOS'ta) Expo hesabına bağlı proje kimliğiyle çalışır; simülatörde izin penceresi çıkar ama jeton alınamaz ve sessizce atlanır. Tam doğrulama için gerçek cihaz gerekir.
- **Geliştirici doğrulama yardımcıları** (üretimde etkisizdir): `EXPO_PUBLIC_DEV_EMAIL/PASSWORD/AUTOLOGIN=1` otomatik giriş, `EXPO_PUBLIC_DEV_OPEN=question|record|trim|report` ilk atamayı doğrudan açar (dokunma enjekte edilemeyen simülatör doğrulaması için).

### Karar 29 — Yükleme sınırları ve çizim günlüğü boyutu
- **Sorun:** 26 saniyelik bir kayıt "Yükleme geçersiz veya çok büyük" hatası verdi. Sebep: çok parçalı yüklemede çizim günlüğü bir metin alanı olarak gidiyor ve sunucunun varsayılan metin alanı sınırı 1 MB'tı; yoğun çizimde (kalem/fare, yüksek örnekleme, uzun ondalıklı koordinatlar) günlük bunu aşabiliyordu.
- **Çözüm:** (1) alan sınırı **16 MB**'a çıkarıldı (günlük en fazla 200.000 nokta taşıyabilir); dosya başına sınır 60 MB. (2) İstemciler günlüğü **sıkıştırarak** gönderir: koordinatlar 0,1 piksele, zaman damgaları 1 ms'ye yuvarlanır (tahta 1280x720 olduğundan görsel fark yoktur; sıra ve zaman monotonluğu korunur). (3) Web kamera klibinin bit hızı 0,8 Mb/sn ile sınırlandı (3 dk ≈ 15 MB). (4) Hata mesajları nedenini söyler ("Yüklenen dosya çok büyük", "Çizim verisi çok büyük") ve sunucu günlüğüne neden yazılır.
- **Ek düzeltme (video üretici kilitlenmesi):** test sırasında, ses dosyası çizim süresinden kısa kaldığında ffmpeg'in erken kapanması yüzünden yazma döngüsünün sonsuza kadar beklediği bir hata bulundu (gerçek kayıtlarda ses süresi çizim süresinden milisaniyelerle kısa olabildiği için aralıklı bir risk). Yazma artık akışın kapanmasını/hatasını da bekleme bitişi sayar; gerçek hata ffmpeg çıkış kodundan bildirilir.

### Karar 30 — Kayıt düzenleme (kırpma + ortadan kesme)
- Kırpma yetmediği için (yalnızca baştan/sondan kesiyordu ve kayıttan hemen sonra görünmüyordu) **kayıt düzenleyici** yapıldı. Öğretmen soru sayfasında **Düzenle (kırp / bölüm sil)** ile videoda bir aralık seçer (kaydırıcılar veya "mevcut konumu başlangıç/bitiş yap") ve iki işlemden birini yapar: **Yalnızca bu aralığı tut** (baştan/sondan kırpma) veya **Bu aralığı sil** (ortadan kesme; kalan parçalar art arda birleştirilir). Düzenleme kayıttan hemen sonraki ekranda da bir bağlantı olarak sunulur. Web ve mobilde aynı işlem ve aynı uç nokta (`POST /api/teacher/assignments/:id/recording/edit`).
- Sunucu, görüntü ve sesi aynı aralıklarla keser ve yeniden kodlar (ffmpeg `trim/atrim + concat`, kare hassasiyeti); düzenlenmiş MP4 kaydın yerine geçer ve yönetici düzenlenmiş videoyu izler. Arka arkaya birden fazla düzenleme yapılabilir; düzenleme geri alınamaz (arayüz uyarır). Düzenlemeden sonra videoda en az 1 sn kalmalıdır. Düzenleme de bir düzenleme sayıldığı için onaylı/onaya gönderilmiş atama taslağa döner ve yeniden onaya gönderilmelidir (Karar 23).
- "Düzenleyip yeniden kaydetme" (görev 6.8): düzenleme + **Yeniden kaydet** (stüdyo yeniden açılır) birlikte bu gereksinimi karşılar. Kayıtlı videonun çizimlerini tek tek değiştirmek (çizgi düzenleme) kapsam dışıdır: sistemde video MP4 olarak saklanır, çizim günlüğü saklanmaz.
