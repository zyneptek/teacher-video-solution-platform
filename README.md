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

### MVP kapsamı (video stüdyosu)

- Kalem ve silgi, tek renk ve tek kalınlık
- Başlat, duraklat, devam ettir, bitir
- Mikrofon izni yoksa kayıt bitirilemez, anlaşılır uyarı gösterilir
- Sunucuda MP4 üretimi, kırpma (baştan/sondan)
- **MVP sonrası:** kamera bindirmesi, ek renk/kalınlık

## Bekleyen kararlar

Aşağıdaki konularda karar verildikçe bu bölüm "Mimari kararlar"a taşınacaktır:

- Proje klasör düzeni
- Push servisi (Expo Push öneriliyor; gerçek cihaz gerektirir)
- Atama, silinen öğretmen ve branş kuralları
