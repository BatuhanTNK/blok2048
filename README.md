# Blok 2048

Block Blast tarzı parça yerleştirmeyi 2048 birleşmeleriyle birleştiren tarayıcı oyunu.

## Çalıştırma

index.html dosyasını tarayıcıda açın. Kurulum ve derleme gerekmez.

## Kaynaklar

- index.html: oyun arayüzü
- src/styles.css: tasarım ve animasyonlar
- src/core.js: oyun kuralları
- src/game.js: etkileşimler ve kayıt

## GitHub Pages

Repository Settings → Pages → Deploy from a branch → main → / (root) → Save.

## Oyun

5×5, 6×6, 7×7 ve 8×8 tahtalar; dolu çizgilerde zincirleme birleşme; her 5 tepside bir kaydırma hakkı, en fazla 2 hak depolama. Büyük parçalar daha seyrek üretilir.

Kayıtlar tarayıcıda yerel olarak saklanır. Google Fonts erişilemezse sistem yazı tipi kullanılır.

## Android (Capacitor)

Paket kimliği: com.batuhantnk.blok2048. İlk Android sürümü: 1.0 (versionCode 1).

Güncel test sürümü: **1.7 (versionCode 8)**, `Blok-2048-v1.7-test.apk`.
1.7 üst şerit düzeltmesi (APK derlemesi, imzası ve paket kaynakları doğrulandı): Capacitor SystemBars'ın WebView sürümüne bağlı dış padding yönetimi kapatıldı. MainActivity WebView'u fiziksel ekran kenarında tutar; yalnızca kamera/çentik insets değerlerini CSS'e aktarır. Güvenli alan boşluğu html yerine body içinde tutulur, böylece sayfanın arka planı ekranın üstünden başlayarak çizilir ve kontroller çentiğin altında kalır. Java/kaynak derlemesi ve lint geçti (0 hata, 33 uyarı); `scripts/test-safe-area.cjs` dikey üst/alt ve yatay sol/sağ çentik payıyla tüm tahta boyutlarını doğrular. Gerçek cihaz doğrulaması yeni APK ile yapılmalıdır; APK yalnızca kullanıcı istediğinde oluşturulur.
1.6 başlık çubuğu düzeltmesi (APK derlemesi, imzası ve paket kaynakları doğrulandı): tam ekran pencere ayarı artık BridgeActivity başlıksız temayı kurduktan sonra uygulanır. Ana uygulama ve açılış temaları başlık/action bar oluşturmaz; splash sonrası tema açıkça başlıksız seçilmiştir. Java/kaynak derlemesi ve lint kontrolü geçti (0 hata); cihazda doğrulama bekleniyor. Yeni APK yalnızca kullanıcı istediğinde oluşturulur.
1.5 kare akıcılığı düzeltmesi (APK derlemesi, imzası ve web kaynaklarının eşleşmesi doğrulandı): blok konumu dış katmanda, birleşme büyümesi iç yüzeyde çizilir. Hareketler zamanlayıcı yerine Web Animations API'nin gerçek bitişiyle ilerler. Birleşmeler hücre bağımlılıklarına göre eşzamanlı gruplara ayrılır; büyük sonuç grupları kare başına en fazla 8 yüzey günceller. Yoğun hamlelerde aynı anda en fazla 4 büyüme efekti oynar; parçacıklar ve tek tek puan yazıları yerine halka ve toplam zincir bildirimi kullanılır. Skor her karede yeniden yazılmaz; ilerleme çubukları genişlik yerine transform ile hareket eder. Yeni APK yalnızca kullanıcı istediğinde oluşturulur.

Kare profili: `CPU_RATE=4 TRACE=1 MOTION=on node scripts/test-performance.cjs` (Playwright kurulumu ve yerel sunucu gerekir; isteğe bağlı `BOARD_SIZE=5/6/7/8`, `SCENARIO=slide/chain`). Dört kat CPU yavaşlatmalı 390×844 masaüstü Chromium'da başlangıç ölçümlerinde en uzun kare 50–117 ms aralığındaydı. Son 8×8 ölçümünde iki senaryonun %95 kare süresi 16,7–16,8 ms, en uzun kare yaklaşık 33 ms oldu; yoğun kaydırmada layout sayısı 48'den 16'ya indi. Profilin kendisi ek yük oluşturur, sonuçlar donanıma göre değişir ve gerçek Android'de sabit 60 FPS garantisi değildir. Telefona bağlı ADB cihazı bulunmadığı için cihaz/GPU ölçümü henüz yapılamadı.

1.4 tam ekran düzenlemesi: Android kamera/çentik alanına tam ekran çizimi açıldı; güvenli alanın arka planı siyah yerine uygulama rengiyle doldurulur. APK derlemesi, imzası ve paket içindeki web kaynaklarının eşleşmesi doğrulandı; Android lint: 0 hata, 34 uyarı; cihazda doğrulama bekleniyor. Yeni APK yalnızca kullanıcı istediğinde oluşturulur.
1.4 performans düzenlemesi: animasyon kapalı hamleler doğrudan son tahtayı çizer; bağımsız birleşmeler aynı anda oynar, zincir animasyonlarının toplam beklemesi sınırlandırılır. Zorunlu `offsetWidth` okumaları kaldırıldı; efekt sayısı en fazla 48, patlama başına parçacık sayısı 4. Puan yazıları animasyon kapalıyken üretilmez. Test: `scripts/test-performance.cjs` (Playwright; `PREVIEW_URL` ile yerel sunucu seçilebilir). 390×844 masaüstü Chromium ölçümünde yoğun kaydırma animasyon kapalı yaklaşık 1259 ms → 4 ms, açık 7421 ms → 1297 ms; bunlar animasyon beklemelerini de içeren hamle süreleridir, cihaz FPS ölçümü değildir. Altı ekran boyutunda mevcut testler ve yoğun kaydırma/zincir senaryolarında tahta-skor doğrulaması geçti. Gerçek Android cihaz performansı henüz doğrulanmadı.
Lobi, ekranı dolduran tahta, boyuta özel oyun kayıtları, tema/animasyon seçim kartları ve eğimli 2–4–8–16 uygulama simgesi içerir. Önceki test APK'sıyla aynı imzayı kullanır; güncelleme için uygulamayı kaldırmadan yeni APK kurulur.
1.2 sürümünde Android geçici sürükleyici tam ekran modu eklendi: durum ve gezinme çubukları gizlenir, ekran kenarından kaydırınca geçici olarak görünür ve Android tarafından tekrar gizlenir. Uygulamaya dönüşte, pencere odağı geri geldiğinde ve yön değişiminde tam ekran yeniden uygulanır.
1.3 sürümünde sürüklenen parça DOM'a eklenmeden önce konumlandırılır, hareketler ekran yenileme hızında birleştirilir ve hareketli gölge filtresi yerine hücre gölgesi kullanılır. Bekleyen hareket karesi bırakma/iptal sırasında temizlenir; bırakma konumu son işaretçi koordinatından hesaplanır.
1.3 derlemesi ve APK imzası doğrulanmıştır; altı ekran boyutunda oyun testleri ve dokunarak sürükleme/sabit tutma testi geçmiştir. 1.2 Android lint sonucu 0 hata, 34 uyarıdır. Gerçek cihazda titreme kontrolü beklenmektedir. Cihazda açılış, alttan kaydırarak gezinme çubuğunu gösterme ve otomatik gizlenmesi, arka plandan dönüş ve ekran döndürme de kontrol edilmelidir; hem üç tuşlu hem hareketle gezinme kullanılmalıdır.

Simge kaynakları `scripts/build-icon.py` ile oluşturulur (Pillow, fontTools ve Windows Segoe UI Bold gerekir). Android 8+ için vektör adaptive icon, eski sürümler için yoğunluğa göre PNG simgeler üretilir.

Gereksinimler: Node.js 22 veya üzeri, Java 21, Android Studio ve Android SDK 36.

Kurulum ve güncelleme:

```sh
npm ci
npm run android:sync
npm run android:open
```

Windows üzerinde deneme APK'sı: npm run android:apk

APK çıktısı: android/app/build/outputs/apk/debug/app-debug.apk
Bu APK geliştirme anahtarıyla imzalanır; mağaza yayını için ayrıca sürüm imzası ve AAB gerekir.

Oyun kaynağı index.html ve src/ klasörüdür. scripts/build-web.cjs bunları www/ içine kopyalar; Android paketinden çevrimiçi yazı tipi bağlantılarını çıkarır. www/ ve Android'e kopyalanan web dosyaları üretilen çıktılardır; doğrudan düzenlenmez.

Web ve Android kayıtları ayrı tutulur. Uygulama güncellemesi aynı paket kimliğiyle kurulduğunda yerel kayıt korunur; uygulamayı kaldırmak kayıtları silebilir.
