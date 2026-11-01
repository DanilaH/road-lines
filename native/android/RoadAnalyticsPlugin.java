package com.danilah.roadlines;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;
import io.appmetrica.analytics.AppMetrica;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONObject;

@CapacitorPlugin(name = "RoadAnalytics")
public class RoadAnalyticsPlugin extends Plugin {
    private static final Set<String> EVENTS = new HashSet<>(Arrays.asList(
        "app_ready", "startup_error", "level_start", "first_move", "level_complete", "level_exit", "level_pause", "level_reset",
        "hint_request", "hint_result", "hint_spent", "hint_repeat", "theme_purchase", "theme_selected", "wheel_reward",
        "save_error", "save_conflict", "language_change"));
    private static final Set<String> KEYS = new HashSet<>(Arrays.asList(
        "schema", "language", "reason", "level_id", "level_version", "set_id", "cells", "finish", "walls", "checkpoints",
        "attempt", "resumed", "replay", "active_ms", "first_clear", "reward", "resets", "undo_cells", "filled", "outcome",
        "remaining", "theme", "price", "sector", "amount", "recovered", "operation", "saved"));
    @PluginMethod public void status(PluginCall call) {
        JSObject result = new JSObject(); result.put("enabled", RoadApplication.analyticsEnabled()); call.resolve(result);
    }
    @PluginMethod public void report(PluginCall call) {
        String event = call.getString("event", ""); JSObject params = call.getObject("params", new JSObject());
        if (!EVENTS.contains(event) || params.length() > 24) { call.reject("Invalid analytics event"); return; }
        java.util.Iterator<String> keys = params.keys();
        while (keys.hasNext()) {
            String key = keys.next(); Object value = params.opt(key);
            if (!KEYS.contains(key) || !(value instanceof String || value instanceof Number || value instanceof Boolean)
                || (value instanceof String && ((String) value).length() > 80)) { call.reject("Invalid analytics parameters"); return; }
        }
        if (RoadApplication.analyticsEnabled()) {
            try { AppMetrica.reportEvent(event, params.toString()); }
            catch (RuntimeException ignored) { /* Telemetry is never a transaction dependency. */ }
        }
        call.resolve();
    }
}
