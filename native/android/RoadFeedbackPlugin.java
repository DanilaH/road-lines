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
    private long celebrationUntil = 0;
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
        boolean celebration = "win".equals(cue) || "gift".equals(cue);
        long gap = celebration ? 20 : "coin".equals(cue) ? 90 : 70;
        if (!foreground || (!celebration && now < celebrationUntil) || now - lastPulse < gap) { call.resolve(); return; }
        Vibrator v = vibrator();
        if (v == null || !v.hasVibrator()) { call.resolve(); return; }
        lastPulse = now;
        AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
        if (celebration || "undo".equals(cue) || "reject".equals(cue) || "star".equals(cue)) {
            long[] timings;
            int[] amplitudes;
            if ("gift".equals(cue)) {
                timings = new long[]{0, 32, 45, 42, 50, 70, 70, 100};
                amplitudes = new int[]{0, 230, 0, 245, 0, 255, 0, 255};
            } else if ("win".equals(cue)) {
                timings = new long[]{0, 34, 45, 42, 55, 62};
                amplitudes = new int[]{0, 235, 0, 250, 0, 255};
            } else if ("undo".equals(cue)) {
                timings = new long[]{0, 14, 22, 20}; amplitudes = new int[]{0, 160, 0, 230};
            } else if ("reject".equals(cue)) {
                timings = new long[]{0, 24, 28, 24}; amplitudes = new int[]{0, 245, 0, 245};
            } else {
                timings = new long[]{0, 26, 28, 30}; amplitudes = new int[]{0, 235, 0, 255};
            }
            if (celebration) {
                long duration = 0; for (long timing : timings) duration += timing;
                celebrationUntil = now + duration;
            }
            if (Build.VERSION.SDK_INT >= 26 && v.hasAmplitudeControl())
                v.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1), attributes);
            else if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(timings, -1), attributes);
            else v.vibrate(timings, -1, attributes);
        } else {
            int duration = "progress".equals(cue) ? 30 : "cell".equals(cue) ? 24 : 14;
            int amplitude = "progress".equals(cue) ? 230 : "cell".equals(cue) ? 230 : "coin".equals(cue) ? 145 : 160;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(duration,
                v.hasAmplitudeControl() ? amplitude : VibrationEffect.DEFAULT_AMPLITUDE), attributes);
            else v.vibrate(duration, attributes);
        }
        call.resolve();
    }
    @PluginMethod public void cancel(PluginCall call) { stop(); call.resolve(); }
    private void stop() { celebrationUntil = 0; Vibrator v = vibrator(); if (v != null) v.cancel(); }
    @Override protected void handleOnPause() { foreground = false; stop(); }
    @Override protected void handleOnResume() { foreground = true; }
    @Override protected void handleOnDestroy() { foreground = false; stop(); }
}
