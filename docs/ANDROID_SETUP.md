# Android shell

## Требования
Node 24, JDK 21, Android SDK platform 36/build-tools 36.0.0. ANDROID_HOME или ANDROID_SDK_ROOT указывает на SDK. Закреплены Capacitor 8.5.3 и App plugin 8.1.2; стандартный шаблон использует AGP 8.13.0 и Gradle 8.14.3, minSdk 24.

## Генерация
`npm ci`, затем `npm run android:sync`.
Генератор при необходимости делает cap add android, применяет versioned файлы native/android, настраивает portrait/иконку и выполняет cap sync android. Изменения делаются в generator/overlays, не вручную внутри игнорируемой /android.
App id com.danilah.roadlines; launcher name Road Lines. Backup пока выключен: политика резервных сохранений ещё не реализована. Web assets локальные, dev-server URL в native config отсутствует.

## Сборка
`npm run android:build` делает production web build, sync и assembleDebug. APK: android/app/build/outputs/apk/debug/app-debug.apk.
GitHub Actions workflow Android debug build устанавливает JDK/SDK и загружает artifact road-lines-debug. Это debug identity, не магазинный release/signing. Публикация не выполняется.

## Insets/lifecycle
MainActivity включает edge-to-edge и применяет system/cutout insets как padding content root, возвращая consumed insets. WebView работает внутри безопасного прямоугольника. CSS safe-area env — browser fallback, а не второй native padding.
App plugin передаёт appStateChange и Back в общий lifecycle coordinator. Проверка на телефоне обязательна: status/navigation bars, вырезы, gesture/three-button navigation, фон, Back. Portrait restriction может иначе вести себя на больших дисплеях; это не проверка tablet support.

## Официальные источники
- https://capacitorjs.com/docs/getting-started
- https://capacitorjs.com/docs/updating/8-0
- https://capacitorjs.com/docs/apis/app
- https://docs.phaser.io/phaser/concepts/scale-manager

Также проверены исходники закреплённого @capacitor/android: JavaVersion.VERSION_21, compileSdk 36. Yandex Games web SDK не является нативной рекламой.
