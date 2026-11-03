import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseOptions, releaseGradle } from './android-release.mjs';
import { readFileSync } from 'node:fs';
const identity=JSON.parse(readFileSync('native/android/release-identity.json','utf8'));
const env={ROAD_LINES_AD_MODE:'live',YANDEX_BANNER_AD_UNIT_ID:'R-M-example-1',YANDEX_INTERSTITIAL_AD_UNIT_ID:'R-M-example-2',YANDEX_REWARDED_AD_UNIT_ID:'R-M-example-3',APPMETRICA_API_KEY:'00000000-0000-4000-8000-000000000000',ANDROID_KEYSTORE_BASE64:Buffer.alloc(64,1).toString('base64'),ANDROID_KEYSTORE_PASSWORD:'example-store-password',ANDROID_KEY_ALIAS:'roadlines-release',ANDROID_KEY_PASSWORD:'example-key-password'};
test('missing any required secret fails closed with its name only',()=>{
 for(const name of Object.keys(env).filter(x=>x!=='ROAD_LINES_AD_MODE')) {
  const input={...env};delete input[name];assert.throws(()=>releaseOptions(input,identity),new RegExp(name));
 }
});
test('rejects demo, playtest, malformed configuration, aliases and base64',()=>{
 for(const patch of [{ROAD_LINES_AD_MODE:'demo'},{ROAD_LINES_PLAYTEST:'true'},{YANDEX_BANNER_AD_UNIT_ID:'wrong'},{APPMETRICA_API_KEY:'wrong'},{ANDROID_KEY_ALIAS:"'; throw 'injection"},{ANDROID_KEYSTORE_BASE64:'not-a-key!'}]) assert.throws(()=>releaseOptions({...env,...patch},identity));
});
test('normalizes pasted terminal newlines without changing the underlying key',()=>{
 const input={...env,ANDROID_KEYSTORE_PASSWORD:env.ANDROID_KEYSTORE_PASSWORD+'\n',ANDROID_KEYSTORE_BASE64:env.ANDROID_KEYSTORE_BASE64+'\n'};
 const result=releaseOptions(input,identity);assert.equal(result.values.ANDROID_KEYSTORE_PASSWORD,env.ANDROID_KEYSTORE_PASSWORD);assert.deepEqual(result.key,Buffer.from(env.ANDROID_KEYSTORE_BASE64,'base64'));
});
test('version and application identity cannot be malformed or change to the test package',()=>{
 for(const patch of [{versionCode:0},{versionCode:2147483647},{versionName:"1.0.0';bad"},{applicationId:'com.danilah.roadlines.playtest'}]) assert.throws(()=>releaseOptions(env,{...identity,...patch}));
});
test('Gradle references environment secrets and contains no values or debug configuration',()=>{
 const text=releaseGradle(identity);for(const name of ['ANDROID_KEYSTORE_PASSWORD','ANDROID_KEY_ALIAS','ANDROID_KEY_PASSWORD']) {assert(text.includes(name));assert(!text.includes(env[name]));}
 assert(!text.includes(env.ANDROID_KEYSTORE_BASE64));assert(text.includes('debuggable false'));assert(!text.includes('applicationIdSuffix'));
});
