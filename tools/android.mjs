import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = process.argv.includes('--build');
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
copyFileSync(resolve(root, 'native/android/road_lines_icon.xml'), resolve(app, 'res/drawable/road_lines_icon.xml'));
copyFileSync(resolve(root, 'native/android/styles.xml'), resolve(app, 'res/values/styles.xml'));
const manifestPath = resolve(app, 'AndroidManifest.xml');
let manifest = readFileSync(manifestPath, 'utf8');
manifest = manifest.replace('android:allowBackup="true"', 'android:allowBackup="false"');
manifest = manifest.replace(/android:icon="[^"]+"/, 'android:icon="@drawable/road_lines_icon"');
manifest = manifest.replace(/android:roundIcon="[^"]+"/, 'android:roundIcon="@drawable/road_lines_icon"');
if (!manifest.includes('android:screenOrientation="portrait"'))
  manifest = manifest.replace('<activity', '<activity android:screenOrientation="portrait"');
if (!manifest.includes('android.permission.VIBRATE')) manifest = manifest.replace('</manifest>', '    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>');
writeFileSync(manifestPath, manifest);
run(process.execPath, [...cap, 'sync', 'android']);
if (build) run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', ['--no-daemon', 'assembleDebug'], resolve(root, 'android'));
