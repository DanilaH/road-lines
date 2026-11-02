package com.danilah.roadlines;

import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Gravity;
import android.widget.FrameLayout;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yandex.mobile.ads.common.*;
import com.yandex.mobile.ads.banner.*;
import com.yandex.mobile.ads.interstitial.*;
import com.yandex.mobile.ads.rewarded.*;
import org.json.*;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Main-thread SDK owner. Earned data is synchronously journaled BEFORE notification or resolution. */
@CapacitorPlugin(name = "RoadAds")
public class RoadAdsPlugin extends Plugin {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private JSONObject config = new JSONObject();
    private SharedPreferences journal;
    private InterstitialAdLoader interLoader;
    private RewardedAdLoader rewardLoader;
    private InterstitialAd interstitial;
    private RewardedAd rewarded;
    private BannerAdView banner;
    private int bannerWidth;
    private long bannerGeneration;
    private boolean ready, destroyed, background, preparing, bannerLoaded, bannerWanted;
    private long bannerRetryAt;
    private Session session;
    private static class Session {
        final PluginCall call; final String kind, placement, id;
        boolean shown, earned, invoked;
        Session(PluginCall c, String k, String p, String id) { call=c; kind=k; placement=p; this.id=id; }
    }
    @Override public void load() {
        journal = getContext().getSharedPreferences("road-lines-ad-receipts-v1", 0);
        try (InputStream in = getContext().getAssets().open("road-ads.json")) {
            java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
            byte[] b = new byte[1024]; int n; while ((n=in.read(b))!=-1) bytes.write(b,0,n);
            config = new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
        } catch (Exception ignored) { /* Missing config disables all formats, not gameplay. */ }
        handler.post(() -> {
            YandexAds.setLocationTracking(false);
            YandexAds.initialize(getContext(), () -> handler.post(() -> {
                if (destroyed) return;
                ready=true; interLoader=new InterstitialAdLoader(getContext()); rewardLoader=new RewardedAdLoader(getContext());
            }));
        });
    }
    private String unit(String kind) { return config.optString(kind, ""); }
    private boolean available(String kind) { return ready && !destroyed && !unit(kind).isEmpty(); }
    private void event(String kind, String phase) {
        JSObject e=new JSObject(); e.put("kind",kind); e.put("phase",phase); notifyListeners("adEvent",e);
    }
    @PluginMethod public void status(PluginCall call) { handler.post(() -> {
        JSObject o=new JSObject(); o.put("ready",ready); o.put("rewarded",available("rewarded")); o.put("interstitial",available("interstitial"));
        o.put("banner",available("banner")); o.put("mode",config.optString("mode","disabled")); call.resolve(o);
    }); }
    @PluginMethod public void prepareInterstitial(PluginCall call) { handler.post(() -> {
        call.resolve();
        if (!available("interstitial") || preparing || interstitial!=null || session!=null || background) return;
        preparing=true; event("interstitial","request");
        interLoader.loadAd(new AdRequest.Builder(unit("interstitial")).build(),new InterstitialAdLoadListener() {
            public void onAdLoaded(@NonNull InterstitialAd ad) {
                preparing=false;
                if (destroyed) { ad.setAdEventListener(null); return; }
                interstitial=ad; event("interstitial","loaded");
            }
            public void onAdFailedToLoad(@NonNull AdRequestError error) { preparing=false; if (!destroyed) event("interstitial","load_error"); }
        });
    }); }
    @PluginMethod public void show(PluginCall call) { handler.post(() -> {
        String kind=call.getString("kind",""), placement=call.getString("placement",""), id=call.getString("session","");
        if ((!kind.equals("interstitial") && !kind.equals("rewarded")) || !id.matches("[a-zA-Z0-9_-]{1,100}") ||
            (kind.equals("rewarded") && !placement.equals("hint-coins") && !placement.equals("theme-coins"))) { call.reject("Invalid ad request"); return; }
        if (!available(kind) || session!=null || background || !getActivity().hasWindowFocus() || (journal.contains("pending") || pendingMemory!=null)) {
            resolve(call,false,"unavailable"); return;
        }
        Session s=new Session(call,kind,placement,id); session=s; hide();
        if (kind.equals("interstitial")) {
            if (interstitial==null) { finish(s,"unavailable"); return; }
            displayInterstitial(s);
        } else {
            event(kind,"request");
            rewardLoader.loadAd(new AdRequest.Builder(unit(kind)).build(),new RewardedAdLoadListener() {
                public void onAdLoaded(@NonNull RewardedAd ad) {
                    if (session!=s || destroyed) { ad.setAdEventListener(null); return; }
                    if (background || !getActivity().hasWindowFocus()) { ad.setAdEventListener(null); finish(s,"cancelled"); return; }
                    rewarded=ad; event(kind,"loaded"); displayRewarded(s);
                }
                public void onAdFailedToLoad(@NonNull AdRequestError error) { if (session==s) { event(kind,"load_error"); finish(s,"error"); } }
            });
            handler.postDelayed(() -> { if (session==s && !s.invoked) finish(s,"unavailable"); },12000);
        }
    }); }
    private void shown(Session s) { if (session==s) { s.shown=true; event(s.kind,"show"); } }
    private void beforeShow(Session s) {
        s.invoked=true;
        // Only time out a pre-show failure while our Activity still owns focus.
        // A displayed ad with a missing callback must never resume gameplay behind it.
        handler.postDelayed(() -> { if (session==s && !s.shown && getActivity().hasWindowFocus() && !background) finish(s,"error"); },8000);
    }
    private void displayInterstitial(Session s) {
        interstitial.setAdEventListener(new InterstitialAdEventListener() {
            public void onAdShown() { shown(s); }
            public void onAdFailedToShow(@NonNull AdError e) { if (session==s) { event(s.kind,"show_error"); finish(s,"error"); } }
            public void onAdDismissed() { if (session==s) { event(s.kind,"dismiss"); finish(s,"dismissed"); } }
            public void onAdClicked() {}
            public void onAdImpression(@Nullable ImpressionData data) { if (session==s) event(s.kind,"impression"); }
        });
        beforeShow(s); interstitial.show(getActivity());
    }
    private void displayRewarded(Session s) {
        rewarded.setAdEventListener(new RewardedAdEventListener() {
            public void onAdShown() { shown(s); }
            public void onAdFailedToShow(@NonNull AdError e) { if (session==s) { event(s.kind,"show_error"); finish(s,"error"); } }
            public void onAdDismissed() { if (session==s) { event(s.kind,"dismiss"); finish(s,"dismissed"); } }
            public void onAdClicked() {}
            public void onAdImpression(@Nullable ImpressionData data) { if (session==s) event(s.kind,"impression"); }
            public void onRewarded(@NonNull Reward reward) {
                if (session!=s || s.earned) return;
                // Ignore server-configured amount: this placement's reviewed app reward is exactly150.
                try {
                    String stream=journal.getString("stream",null);
                    if (stream==null) stream=UUID.randomUUID().toString();
                    long seq=journal.getLong("sequence",0)+1;
                    JSONObject r=new JSONObject(); r.put("schema",1); r.put("stream",stream); r.put("sequence",seq);
                    r.put("id",s.id); r.put("session",s.id); r.put("placement",s.placement); r.put("amount",150);
                    if (!journal.edit().putString("stream",stream).putLong("sequence",seq).putString("pending",r.toString()).commit()) {
                        // Retain the exact receipt in memory and retry on the main thread. Never notify before disk success.
                        retryReceipt(s,r); return;
                    }
                    s.earned=true; event(s.kind,"earned");
                } catch (Exception e) { event(s.kind,"show_error"); }
            }
        });
        beforeShow(s); rewarded.show(getActivity());
    }
    private void retryReceipt(Session s, JSONObject receipt) {
        // SharedPreferences.commit failure cannot be treated as a grant. Keep exact identity across retries.
        s.earned=true;
        pendingMemory=receipt;
        persistMemory();
    }
    private JSONObject pendingMemory;
    private void persistMemory() {
        if (pendingMemory==null) return;
        JSONObject r=pendingMemory;
        if (journal.edit().putString("stream",r.optString("stream")).putLong("sequence",r.optLong("sequence")).putString("pending",r.toString()).commit()) {
            pendingMemory=null; event("rewarded","earned");
        } else if (!destroyed) handler.postDelayed(this::persistMemory,1000);
    }
    @PluginMethod public void pending(PluginCall call) { handler.post(() -> {
        persistMemory();
        if (pendingMemory!=null) { call.reject("Native reward disk write pending"); return; }
        try { JSArray a=new JSArray(); String raw=journal.getString("pending",null); if (raw!=null) a.put(new JSONObject(raw));
            JSObject o=new JSObject(); o.put("receipts",a); call.resolve(o);
        } catch (Exception e) { call.reject("Invalid native reward journal"); }
    }); }
    @PluginMethod public void acknowledge(PluginCall call) { handler.post(() -> {
        try {
            String raw=journal.getString("pending",null);
            if (raw!=null) {
                if (!new JSONObject(raw).getString("id").equals(call.getString("id"))) { call.reject("Receipt ack mismatch"); return; }
                if (!journal.edit().remove("pending").commit()) { call.reject("Receipt ack failed"); return; }
            }
            call.resolve();
        } catch (Exception e) { call.reject("Receipt ack failed"); }
    }); }
    private void resolve(PluginCall c, boolean shown, String outcome) { JSObject o=new JSObject(); o.put("shown",shown); o.put("outcome",outcome); c.resolve(o); }
    private void finish(Session s, String outcome) {
        if (session!=s) return;
        session=null;
        if (rewarded!=null) { rewarded.setAdEventListener(null); rewarded=null; }
        if (interstitial!=null && s.kind.equals("interstitial")) { interstitial.setAdEventListener(null); interstitial=null; }
        resolve(s.call,s.shown,outcome);
    }
    @PluginMethod public void measureBanner(PluginCall call) { handler.post(() -> {
        if (!available("banner") || background || session!=null) { call.resolve(); return; }
        try {
            View web=getBridge().getWebView(); FrameLayout parent=(FrameLayout)getActivity().findViewById(android.R.id.content);
            double viewport=call.getDouble("viewportWidth",0.0), slot=call.getDouble("slotWidth",0.0);
            if (viewport<=0 || slot<=0 || web.getWidth()<=0) { call.resolve(); return; }
            int width=(int)Math.floor(web.getWidth()*slot/viewport);
            if (width<=0) { call.resolve(); return; }
            if (banner==null || width!=bannerWidth) {
                destroyBanner(); bannerWidth=width;
                banner=new BannerAdView(getActivity());
                int dp=(int)Math.floor(width/getContext().getResources().getDisplayMetrics().density);
                banner.setAdSize(BannerAdSize.sticky(getContext(),dp));
                banner.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(0,View.MeasureSpec.UNSPECIFIED));
            }
            int h=banner.getMeasuredHeight();
            if (h<=0) { call.resolve(); return; }
            int[] w=new int[2],p=new int[2]; web.getLocationOnScreen(w); parent.getLocationOnScreen(p);
            JSObject o=new JSObject();
            o.put("webView",rect(w[0]-p[0],w[1]-p[1],web.getWidth(),web.getHeight()));
            JSObject root=new JSObject(); root.put("width",parent.getWidth()); root.put("height",parent.getHeight()); o.put("root",root);
            JSObject padding=new JSObject(); padding.put("left",parent.getPaddingLeft()); padding.put("top",parent.getPaddingTop()); o.put("parentPadding",padding);
            JSObject safe=new JSObject(); safe.put("left",parent.getPaddingLeft()); safe.put("top",parent.getPaddingTop()); safe.put("right",parent.getPaddingRight()); safe.put("bottom",parent.getPaddingBottom()); o.put("safeInsets",safe);
            o.put("adHeight",h); call.resolve(o);
        } catch (Exception e) { call.reject("Banner measurement failed"); }
    }); }
    private JSObject rect(int x,int y,int width,int height) { JSObject r=new JSObject(); r.put("x",x);r.put("y",y);r.put("width",width);r.put("height",height);return r; }
    @PluginMethod public void placeBanner(PluginCall call) { handler.post(() -> {
        long generation=call.getLong("generation",0L);
        JSObject placement=call.getObject("placement");
        if (generation<bannerGeneration || banner==null || placement==null || !placement.optString("kind").equals("place") || background || session!=null || destroyed) { call.resolve(); return; }
        bannerGeneration=generation;
        try {
            JSONObject r=placement.getJSONObject("rect"); FrameLayout parent=(FrameLayout)getActivity().findViewById(android.R.id.content);
            int x=r.getInt("x"),y=r.getInt("y"),width=r.getInt("width"),height=r.getInt("height");
            View web=getBridge().getWebView(); int[] w=new int[2],p=new int[2]; web.getLocationOnScreen(w);parent.getLocationOnScreen(p);
            if (x<w[0]-p[0] || y<w[1]-p[1] || x+width>w[0]-p[0]+web.getWidth() || y+height>w[1]-p[1]+web.getHeight() || width!=bannerWidth || height<banner.getMeasuredHeight()) { hide(); call.resolve();return; }
            FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(width,height,Gravity.TOP|Gravity.LEFT);
            lp.leftMargin=x-parent.getPaddingLeft();lp.topMargin=y-parent.getPaddingTop();
            if (banner.getParent()==null) parent.addView(banner,lp); else banner.setLayoutParams(lp);
            bannerWanted=true;banner.setVisibility(bannerLoaded?View.VISIBLE:View.INVISIBLE);
            if (!bannerLoaded && android.os.SystemClock.elapsedRealtime()>=bannerRetryAt) {
                bannerRetryAt=Long.MAX_VALUE; final BannerAdView target=banner;
                target.setBannerAdEventListener(new BannerAdEventListener() {
                    public void onAdLoaded() { if (banner!=target || destroyed) return; bannerLoaded=true;target.setVisibility(bannerWanted && !background && session==null?View.VISIBLE:View.INVISIBLE);event("banner","loaded"); }
                    public void onAdFailedToLoad(@NonNull AdRequestError error) { if (banner!=target || destroyed) return;bannerRetryAt=android.os.SystemClock.elapsedRealtime()+60000;event("banner","load_error"); }
                    public void onAdClicked() {}
                    public void onImpression(@Nullable ImpressionData data) { if (banner==target) event("banner","impression"); }
                });
                event("banner","request");target.loadAd(new AdRequest.Builder(unit("banner")).build());
            }
            call.resolve();
        } catch (Exception e) { hide();call.reject("Banner placement failed"); }
    }); }
    private void hide() { bannerWanted=false; if (banner!=null) banner.setVisibility(View.INVISIBLE); }
    @PluginMethod public void hideBanner(PluginCall call) { handler.post(() -> { hide();call.resolve(); }); }
    private void destroyBanner() { if (banner!=null) { banner.setBannerAdEventListener(null);if (banner.getParent() instanceof FrameLayout) ((FrameLayout)banner.getParent()).removeView(banner);banner.destroy();banner=null; } bannerLoaded=false;bannerRetryAt=0; }
    @Override protected void handleOnPause() { background=true;hide(); if (session!=null && !session.invoked) finish(session,"cancelled"); }
    @Override protected void handleOnResume() { background=false;persistMemory(); }
    private void clean() { destroyed=true;hide();destroyBanner();handler.removeCallbacksAndMessages(null);if (session!=null) finish(session,"cancelled");if (interstitial!=null) interstitial.setAdEventListener(null);interstitial=null;interLoader=null;rewardLoader=null; }
    @PluginMethod public void dispose(PluginCall call) { handler.post(() -> { clean();call.resolve(); }); }
    @Override protected void handleOnDestroy() { clean(); }
}
