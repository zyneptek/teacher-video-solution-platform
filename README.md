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

### MVP kapsamı (video stüdyosu)

- Kalem ve silgi, tek renk ve tek kalınlık
- Başlat, duraklat, devam ettir, bitir
- Mikrofon izni yoksa kayıt bitirilemez, anlaşılır uyarı gösterilir
- Sunucuda MP4 üretimi, kırpma (baştan/sondan)
- **MVP sonrası:** kamera bindirmesi, ek renk/kalınlık

## Bekleyen kararlar

Aşağıdaki konularda karar verildikçe bu bölüm "Mimari kararlar"a taşınacaktır:

- Backend ve veritabanı, dosya deposu
- E-posta ve push servisi
- Web uygulamasının yapısı (tek uygulama / iki uygulama)
- Proje klasör düzeni ve dil (TypeScript / JavaScript)
- Atama, silinen öğretmen ve branş kuralları
