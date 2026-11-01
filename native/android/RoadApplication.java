package com.danilah.roadlines;

import android.app.Application;
import io.appmetrica.analytics.AppMetrica;
import io.appmetrica.analytics.AppMetricaConfig;
import java.nio.charset.StandardCharsets;
import java.io.InputStream;
import org.json.JSONObject;

/** One initialization per process, before the Capacitor bridge can send events. */
public class RoadApplication extends Application {
    private static boolean analyticsEnabled = false;
    public static boolean analyticsEnabled() { return analyticsEnabled; }
    @Override public void onCreate() {
        super.onCreate();
        try (InputStream in = getAssets().open("road-analytics.json")) {
            java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[1024]; int count;
            while ((count = in.read(buffer)) != -1) bytes.write(buffer, 0, count);
            String key = new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8)).optString("apiKey", "");
            if (key.isEmpty()) return;
            AppMetricaConfig config = AppMetricaConfig.newConfigBuilder(key)
                .withLocationTracking(false).withAdvIdentifiersTracking(false)
                .withCrashReporting(false).withNativeCrashReporting(false).build();
            AppMetrica.activate(this, config);
            AppMetrica.enableActivityAutoTracking(this);
            analyticsEnabled = true;
        } catch (Exception ignored) { /* Disabled analytics cannot prevent boot/save/gameplay. */ }
    }
}
