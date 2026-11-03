import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, chmodSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { releaseOptions, releaseGradle } from './android-release.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = process.argv.includes('--build');
const release = process.argv.includes('--release');
const releaseIdentity = JSON.parse(readFileSync(resolve(root,'native/android/release-identity.json'),'utf8'));
const releaseConfig = release ? releaseOptions(process.env, releaseIdentity) : null;
if (releaseConfig) for (const [name,value] of Object.entries(releaseConfig.values)) process.env[name] = value;
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (build) {
  const java = spawnSync('java', ['-version'], { encoding: 'utf8' });
  const major = Number((java.stderr || '').match(/version "(\d+)/)?.[1]);
  if (major < 21 || !major || !(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT)) {
    console.error('Android build requires JDK 21+ and ANDROID_HOME/ANDROID_SDK_ROOT (SDK 36). Use the Android CI workflow.');
    process.exit(1);
  }
  run(process.execPath, ['node_modules/vite/bin/vite.js', 'build']);
}
if (!existsSync(resolve(root, 'dist/index.html'))) throw Error('Build web assets first: npm run build');
const cap = ['node_modules/@capacitor/cli/bin/capacitor'];
if (!existsSync(resolve(root, 'android'))) run(process.execPath, [...cap, 'add', 'android']);

const app = resolve(root, 'android/app/src/main');
const javaDir = resolve(app, 'java/com/danilah/roadlines');
mkdirSync(javaDir, { recursive: true });
copyFileSync(resolve(root, 'native/android/MainActivity.java'), resolve(javaDir, 'MainActivity.java'));
copyFileSync(resolve(root, 'native/android/RoadFeedbackPlugin.java'), resolve(javaDir, 'RoadFeedbackPlugin.java'));
for (const name of ['RoadAnalyticsPlugin.java', 'RoadApplication.java']) copyFileSync(resolve(root, 'native/android', name), resolve(javaDir, name));
const analyticsKey = process.env.APPMETRICA_API_KEY?.trim() ?? '';
if (analyticsKey && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(analyticsKey)) throw Error('Invalid AppMetrica API key format');
const assets = resolve(app, 'assets'); mkdirSync(assets, { recursive: true });
// Explicit demo mode is only allowed in the side-by-side debug build. Missing live IDs disable formats.
const adMode = process.env.ROAD_LINES_AD_MODE ?? 'live';
if (!['demo', 'live'].includes(adMode)) throw Error('Unknown ad mode');
if (adMode === 'demo' && process.env.ROAD_LINES_PLAYTEST !== 'true') throw Error('Demo ads require the playtest build');
const adConfig = { mode: adMode };
for (const [kind, name] of [['banner','YANDEX_BANNER_AD_UNIT_ID'],['interstitial','YANDEX_INTERSTITIAL_AD_UNIT_ID'],['rewarded','YANDEX_REWARDED_AD_UNIT_ID']]) {
  const id = adMode === 'demo' ? `demo-${kind}-yandex` : process.env[name]?.trim() ?? '';
  if (id && adMode === 'live' && !/^R-M-[A-Za-z0-9-]+$/.test(id)) throw Error(`Invalid ${kind} ad configuration`);
  adConfig[kind] = id;
  console.info(`${kind} ads: ${id ? adMode : 'disabled (ID absent)'}`);
}
writeFileSync(resolve(assets, 'road-ads.json'), JSON.stringify(adConfig));
copyFileSync(resolve(root, 'native/android/RoadAdsPlugin.java'), resolve(javaDir, 'RoadAdsPlugin.java'));
copyFileSync(resolve(root, 'native/android/road-ads.gradle'), resolve(root, 'android/app/road-ads.gradle'));

writeFileSync(resolve(assets, 'road-analytics.json'), JSON.stringify({ apiKey: analyticsKey }));
console.info(analyticsKey ? 'Native analytics configured.' : 'Native analytics disabled: APPMETRICA_API_KEY is absent.');
copyFileSync(resolve(root, 'native/android/road-analytics.gradle'), resolve(root, 'android/app/road-analytics.gradle'));
const gradlePath = resolve(root, 'android/app/build.gradle');
let gradle = readFileSync(gradlePath, 'utf8');
// Install playtest builds alongside the user's existing app and its saves.
// Namespace and Java package stay unchanged; only the debug application ID differs.
const playtest = process.env.ROAD_LINES_PLAYTEST === 'true';
const debugKey = resolve(root, '.test-output/android-signing/debug.keystore');
if (playtest && build && !existsSync(debugKey)) {
  mkdirSync(dirname(debugKey), { recursive: true });
  run('keytool', ['-genkeypair', '-keystore', debugKey, '-storepass', 'android', '-keypass', 'android',
    '-alias', 'androiddebugkey', '-dname', 'CN=Android Debug,O=Android,C=US', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000']);
}
writeFileSync(resolve(root, 'android/app/road-playtest.gradle'), playtest
  ? "android { signingConfigs { debug { storeFile rootProject.file('../.test-output/android-signing/debug.keystore'); storePassword 'android'; keyAlias 'androiddebugkey'; keyPassword 'android' } }; buildTypes { debug { applicationIdSuffix '.playtest'; versionNameSuffix '-playtest'; signingConfig signingConfigs.debug } } }\n" : '');
const releaseKey = resolve(root, '.test-output/android-signing/release.jks');
if (releaseConfig) {
  mkdirSync(dirname(releaseKey), { recursive: true, mode: 0o700 });
  process.on('exit', () => { try { unlinkSync(releaseKey); } catch {} });
  writeFileSync(releaseKey, releaseConfig.key, { mode: 0o600 }); chmodSync(releaseKey,0o600);
  const cert = spawnSync('keytool', ['-exportcert','-keystore',releaseKey,'-storepass:env','ANDROID_KEYSTORE_PASSWORD','-alias',process.env.ANDROID_KEY_ALIAS], { encoding: null });
  if (cert.status !== 0 || createHash('sha256').update(cert.stdout ?? '').digest('hex') !== releaseIdentity.certificateSha256) throw Error('Release keystore does not match the committed signing certificate');
}
writeFileSync(resolve(root,'android/app/road-release.gradle'), releaseConfig ? releaseGradle(releaseIdentity) : '');
if (!gradle.includes("apply from: 'road-release.gradle'")) gradle += "\napply from: 'road-release.gradle'\n";
if (!gradle.includes("apply from: 'road-ads.gradle'")) gradle += "\napply from: 'road-ads.gradle'\n";
if (!gradle.includes("apply from: 'road-playtest.gradle'")) gradle += "\napply from: 'road-playtest.gradle'\n";
const stringsPath = resolve(app, 'res/values/strings.xml');
let strings = readFileSync(stringsPath, 'utf8').replaceAll(' · тест', '');
if (playtest) strings = strings.replace(/(<string name="(?:app_name|title_activity_main)">)([^<]+)(<\/string>)/g, '$1$2 · тест$3');
writeFileSync(stringsPath, strings);
if (!gradle.includes("apply from: 'road-analytics.gradle'")) { gradle += "\napply from: 'road-analytics.gradle'\n"; writeFileSync(gradlePath, gradle); }
writeFileSync(gradlePath, gradle);

mkdirSync(resolve(app, 'res/drawable-nodpi'), { recursive: true });
copyFileSync(resolve(root, 'native/android/road_lines_icon_art.png'), resolve(app, 'res/drawable-nodpi/road_lines_icon_art.png'));
copyFileSync(resolve(root, 'native/android/road_lines_icon.xml'), resolve(app, 'res/drawable/road_lines_icon.xml'));
copyFileSync(resolve(root, 'native/android/styles.xml'), resolve(app, 'res/values/styles.xml'));
const manifestPath = resolve(app, 'AndroidManifest.xml');
let manifest = readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:name=".RoadApplication"')) manifest = manifest.replace('<application', '<application android:name=".RoadApplication"');
manifest = manifest.replace('android:allowBackup="true"', 'android:allowBackup="false"');
manifest = manifest.replace(/android:icon="[^"]+"/, 'android:icon="@drawable/road_lines_icon"');
manifest = manifest.replace(/android:roundIcon="[^"]+"/, 'android:roundIcon="@drawable/road_lines_icon"');
if (!manifest.includes('android:screenOrientation="portrait"'))
  manifest = manifest.replace('<activity', '<activity android:screenOrientation="portrait"');
if (!manifest.includes('android.permission.VIBRATE')) manifest = manifest.replace('</manifest>', '    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>');
writeFileSync(manifestPath, manifest);
run(process.execPath, [...cap, 'sync', 'android']);
if (build) run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', ['--no-daemon', release ? 'assembleRelease' : 'assembleDebug'], resolve(root, 'android'));
