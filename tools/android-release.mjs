/** Release-only build inputs. Never serialize this returned object or log secret values. */
export function releaseOptions(env, identity) {
  if (env.ROAD_LINES_PLAYTEST === 'true') throw Error('Release cannot use ROAD_LINES_PLAYTEST');
  if (env.ROAD_LINES_AD_MODE !== 'live') throw Error('Release requires ROAD_LINES_AD_MODE=live');
  const required = ['YANDEX_BANNER_AD_UNIT_ID','YANDEX_INTERSTITIAL_AD_UNIT_ID','YANDEX_REWARDED_AD_UNIT_ID',
    'APPMETRICA_API_KEY','ANDROID_KEYSTORE_BASE64','ANDROID_KEYSTORE_PASSWORD','ANDROID_KEY_ALIAS','ANDROID_KEY_PASSWORD'];
  const values = {};
  for (const name of required) {
    const value = env[name]?.trim();
    if (!value) throw Error('Missing release secret: ' + name);
    values[name] = value;
  }
  for (const name of required.slice(0,3)) if (!/^R-M-[A-Za-z0-9-]+$/.test(values[name])) throw Error('Invalid release secret: ' + name);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(values.APPMETRICA_API_KEY)) throw Error('Invalid release secret: APPMETRICA_API_KEY');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(values.ANDROID_KEY_ALIAS)) throw Error('Invalid release secret: ANDROID_KEY_ALIAS');
  const encoded = values.ANDROID_KEYSTORE_BASE64.replace(/\s/g,'');
  const key = Buffer.from(encoded,'base64');
  if (key.length < 32 || key.length > 1024*1024 || key.toString('base64') !== encoded) throw Error('Invalid release secret: ANDROID_KEYSTORE_BASE64');
  if (identity.applicationId !== 'com.danilah.roadlines' || !/^[a-f0-9]{64}$/.test(identity.certificateSha256)) throw Error('Invalid release identity');
  if (!Number.isSafeInteger(identity.versionCode) || identity.versionCode < 1 || identity.versionCode > 2100000000 || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(identity.versionName)) throw Error('Invalid release version');
  return { values, key, identity };
}
export function releaseGradle(identity) {
  return `// Generated. Passwords are read only from the build environment, never embedded here.
android {
    defaultConfig {
        applicationId '${identity.applicationId}'
        versionCode ${identity.versionCode}
        versionName '${identity.versionName}'
    }
    signingConfigs {
        release {
            storeFile rootProject.file('../.test-output/android-signing/release.jks')
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }
    }
    buildTypes { release { debuggable false; signingConfig signingConfigs.release } }
}
`;
}
