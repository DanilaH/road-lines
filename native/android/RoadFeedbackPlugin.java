package com.danilah.roadlines;

import android.content.Context;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RoadFeedback")
public class RoadFeedbackPlugin extends Plugin {
    private volatile boolean foreground = true;
    private long lastPulse = -1000;
    private Vibrator vibrator() {
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager manager = (VibratorManager) getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager == null ? null : manager.getDefaultVibrator();
        }
        return (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
    }
    @PluginMethod
    public void pulse(PluginCall call) {
        String cue = call.getString("cue", "button");
        Long issuedAt = call.getLong("issuedAt");
        if (issuedAt == null || Math.abs(System.currentTimeMillis() - issuedAt) > 350) { call.resolve(); return; }
        long now = SystemClock.uptimeMillis();
        if (!foreground || (!"win".equals(cue) && now - lastPulse < ("cell".equals(cue) ? 45 : 20))) { call.resolve(); return; }
        Vibrator v = vibrator();
        if (v == null || !v.hasVibrator()) { call.resolve(); return; }
        lastPulse = now;
        AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
        if ("win".equals(cue)) {
            long[] timings = {0, 28, 65, 34, 75, 48};
            if (Build.VERSION.SDK_INT >= 26 && v.hasAmplitudeControl())
                v.vibrate(VibrationEffect.createWaveform(timings, new int[]{0, 200, 0, 230, 0, 255}, -1), attributes);
            else if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(timings, -1), attributes);
            else v.vibrate(timings, -1, attributes);
        } else {
            int duration = "star".equals(cue) ? 26 : "progress".equals(cue) ? 30 : "cell".equals(cue) ? 14 : 10;
            int amplitude = "star".equals(cue) ? 230 : "progress".equals(cue) ? 210 : "cell".equals(cue) ? 165 : 110;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(duration,
                v.hasAmplitudeControl() ? amplitude : VibrationEffect.DEFAULT_AMPLITUDE), attributes);
            else v.vibrate(duration, attributes);
        }
        call.resolve();
    }
    @PluginMethod public void cancel(PluginCall call) { stop(); call.resolve(); }
    private void stop() { Vibrator v = vibrator(); if (v != null) v.cancel(); }
    @Override protected void handleOnPause() { foreground = false; stop(); }
    @Override protected void handleOnResume() { foreground = true; }
    @Override protected void handleOnDestroy() { foreground = false; stop(); }
}
