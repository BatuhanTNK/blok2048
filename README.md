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
