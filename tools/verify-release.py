"""Verify the actual signed Android APK. Reports booleans, never embedded SDK identifiers."""
from pathlib import Path
import hashlib,json,os,re,struct,subprocess,zipfile
root=Path(__file__).resolve().parent.parent
identity=json.loads((root/'native/android/release-identity.json').read_text())
apk=root/'android/app/build/outputs/apk/release/app-release.apk'
sdk=Path(os.environ.get('ANDROID_HOME') or os.environ['ANDROID_SDK_ROOT'])/'build-tools/36.0.0'
def command(args):
    result=subprocess.run([str(x) for x in args],capture_output=True,text=True)
    if result.returncode: raise RuntimeError('Release verification failed: '+Path(str(args[0])).name)
    return result.stdout
signing=command([sdk/'apksigner','verify','--verbose','--print-certs',apk])
certificate=re.search(r'Signer #1 certificate SHA-256 digest: ([a-fA-F0-9]+)',signing)
assert certificate and certificate[1].lower()==identity['certificateSha256'],'Unexpected signing certificate'
command([sdk/'zipalign','-c','-P','16','4',apk])
u16=lambda b,p:struct.unpack_from('<H',b,p)[0]
u32=lambda b,p:struct.unpack_from('<I',b,p)[0]
def manifest_attributes(b):
    strings=[];tags=[];pos=8
    while pos<len(b):
        kind,header,size=u16(b,pos),u16(b,pos+2),u32(b,pos+4)
        assert size>=8
        if kind==1:
            count,flags,start=u32(b,pos+8),u32(b,pos+16),u32(b,pos+20)
            def length8(p):
                x=b[p];return (((x&127)<<8)|b[p+1],p+2) if x&128 else (x,p+1)
            for i in range(count):
                p=pos+start+u32(b,pos+header+4*i)
                if flags&256:
                    _,p=length8(p);n,p=length8(p);strings.append(b[p:p+n].decode())
                else:
                    n=u16(b,p);strings.append(b[p+2:p+2+n*2].decode('utf-16le'))
        if kind==0x102:
            name=strings[u32(b,pos+20)];start,step,count=u16(b,pos+24),u16(b,pos+26),u16(b,pos+28);attrs={}
            for i in range(count):
                p=pos+16+start+i*step;n=strings[u32(b,p+4)];t=b[p+15];v=u32(b,p+16);attrs[n]=strings[v] if t==3 else v
            tags.append((name,attrs))
        pos+=size
    return tags
with zipfile.ZipFile(apk) as z:
    tags=manifest_attributes(z.read('AndroidManifest.xml'))
    manifest=next(a for n,a in tags if n=='manifest');app=next(a for n,a in tags if n=='application')
    activity=next(a for n,a in tags if n=='activity' and a.get('name','').endswith('MainActivity'))
    assert manifest['package']==identity['applicationId']
    assert manifest['versionCode']==identity['versionCode'] and manifest['versionName']==identity['versionName']
    assert not app.get('debuggable',False),'Release is debuggable'
    assert activity['screenOrientation']==1,'Portrait requirement lost'
    ads=json.loads(z.read('assets/road-ads.json'));assert ads['mode']=='live'
    for kind,name in [('banner','YANDEX_BANNER_AD_UNIT_ID'),('interstitial','YANDEX_INTERSTITIAL_AD_UNIT_ID'),('rewarded','YANDEX_REWARDED_AD_UNIT_ID')]:
        assert ads[kind]==os.environ[name].strip() and re.fullmatch(r'R-M-[A-Za-z0-9-]+',ads[kind]),'Live ad configuration mismatch'
    analytics=json.loads(z.read('assets/road-analytics.json'))
    assert analytics['apiKey']==os.environ['APPMETRICA_API_KEY'].strip() and re.fullmatch(r'[a-fA-F0-9-]{36}',analytics['apiKey']),'Analytics configuration mismatch'
    count=0
    for path in (root/'dist').rglob('*'):
        if path.is_file():
            name='assets/public/'+str(path.relative_to(root/'dist'));assert z.read(name)==path.read_bytes(), 'Web asset mismatch: '+name;count+=1
    scripts=b'\n'.join(z.read(n) for n in z.namelist() if n.startswith('assets/public/assets/') and n.endswith('.js'))
    for marker in [b'test-ad-pending',b'test-stream',b'test-ad-seq',b'test-banner-state',b'window.__perf']:
        assert marker not in scripts,'Development-only code in release'
report={'source':os.environ.get('GITHUB_SHA'),'package':manifest['package'],'versionCode':manifest['versionCode'],'versionName':manifest['versionName'],'debuggable':False,'portrait':True,'permissions':[a['name'] for n,a in tags if n=='uses-permission'],'sdk':next(a for n,a in tags if n=='uses-sdk'),'ad_mode':'live','ad_formats':{'banner':True,'interstitial':True,'rewarded':True},'analytics_configured':True,'certificate_sha256':certificate[1].lower(),'signature_verified':True,'zipalign_16k_verified':True,'matching_web_files':count,'apk_bytes':apk.stat().st_size,'apk_sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'limitations':['Native fill, earned/dismiss callbacks, phone feel and dashboard delivery require device acceptance; embedded config is not live delivery proof','Release uses the Capacitor template minify setting; R8 acceptance is not claimed']}
out=root/'.test-output/release-verification.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
