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

### MVP kapsamı (video stüdyosu)

- Kalem ve silgi, tek renk ve tek kalınlık
- Başlat, duraklat, devam ettir, bitir
- Mikrofon izni yoksa kayıt bitirilemez, anlaşılır uyarı gösterilir
- Sunucuda MP4 üretimi, kırpma (baştan/sondan)
- **MVP sonrası:** kamera bindirmesi, ek renk/kalınlık

## Bekleyen kararlar

Aşağıdaki konularda karar verildikçe bu bölüm "Mimari kararlar"a taşınacaktır:

- Push servisi (Expo Push öneriliyor; gerçek cihaz gerektirir)
- Düzenleme veya silme sonrası atama durumu
- Çapraz atanan öğretmenin hangi videoları göreceği
- Öğretmenin cevap anahtarını ve kazanımları görüp görmeyeceği
- Hata bildirimi ekleri (hangi türlerde, dosya türü ve boyut sınırı)
- Branşı değişen öğretmenin mevcut atamaları
- Geri gönderme notu uzunluğu, onay/geri gönderme sonrası öğretmen bildirimi
- Yeni soru ekleme ekranı, kazanım ekleme/silme
- Video çıktısı: çözünürlük, en-boy oranı, kamera bindirme konumu
