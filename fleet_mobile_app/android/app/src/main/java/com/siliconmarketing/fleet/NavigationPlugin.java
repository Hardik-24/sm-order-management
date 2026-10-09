package com.siliconmarketing.fleet;

import android.content.Intent;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NavigationPlugin")
public class NavigationPlugin extends Plugin {
    private static final String TAG = "NavigationPlugin";

    @Override
    public void load() {
        super.load();

        // Connect road-snapped location stream directly to Capacitor JS listeners
        NavigationManager.getInstance().setLocationCallback((
                lat, lng, bearing, speedMps, accuracy, timestamp,
                isRoadSnapped, remainingMeters, remainingSeconds, distanceDrivenKm
        ) -> {
            JSObject data = new JSObject();
            data.put("latitude", lat);
            data.put("longitude", lng);
            data.put("bearing", bearing);
            data.put("speed", Math.round(speedMps * 3.6)); // km/h
            data.put("accuracy", accuracy);
            data.put("timestamp", timestamp > 0 ? timestamp : System.currentTimeMillis());
            data.put("isRoadSnapped", isRoadSnapped);

            if (remainingMeters >= 0) {
                double remKm = Math.round((remainingMeters / 1000.0) * 10.0) / 10.0;
                int remMins = Math.round(remainingSeconds / 60.0f);
                data.put("remainingMeters", remainingMeters);
                data.put("remainingSeconds", remainingSeconds);
                data.put("remainingDistanceKm", remKm);
                data.put("remainingTimeMinutes", remMins);
                data.put("distanceDrivenKm", distanceDrivenKm);
                data.put("etaFormatted", remKm + " km left (~" + remMins + " min)");
            } else {
                data.put("distanceDrivenKm", distanceDrivenKm);
            }

            notifyListeners("onRoadSnappedLocation", data);
        });
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        ret.put("isNavigating", NavigationManager.getInstance().isNavigating());
        call.resolve(ret);
    }

    @PluginMethod
    public void startNavigation(PluginCall call) {
        Double lat = call.getDouble("destLat");
        Double lng = call.getDouble("destLng");
        String title = call.getString("title", "Delivery Destination");
        Boolean enableTurnByTurn = call.getBoolean("enableTurnByTurn", false);
        String orderId = call.getString("orderId", "");
        String orderNumber = call.getString("orderNumber", "");
        String authToken = call.getString("authToken", "");
        String apiUrl = call.getString("apiUrl", "https://sm-order-management.vercel.app");
        Double initialDistanceKm = call.getDouble("initialDistanceKm", 0.0);
        Long startTimeMs = call.getLong("startTimeMs", System.currentTimeMillis());

        if (lat == null || lng == null) {
            call.reject("Invalid destination coordinates");
            return;
        }

        NavigationManager.getInstance().startNavigation(
                getActivity(),
                lat,
                lng,
                title,
                orderId,
                authToken,
                apiUrl,
                initialDistanceKm != null ? initialDistanceKm : 0.0,
                () -> {
                    if (Boolean.TRUE.equals(enableTurnByTurn)) {
                        try {
                            Intent intent = new Intent(getContext(), NavigationActivity.class);
                            intent.putExtra("destLat", lat);
                            intent.putExtra("destLng", lng);
                            intent.putExtra("title", title);
                            intent.putExtra("orderId", orderId);
                            intent.putExtra("orderNumber", orderNumber);
                            intent.putExtra("startTimeMs", startTimeMs != null ? startTimeMs : System.currentTimeMillis());
                            intent.putExtra("initialDistanceKm", initialDistanceKm != null ? initialDistanceKm : 0.0);
                            intent.putExtra("authToken", authToken);
                            intent.putExtra("apiUrl", apiUrl);
                            getActivity().startActivity(intent);
                        } catch (Exception e) {
                            Log.w(TAG, "NavigationActivity launch error: " + e.getMessage());
                        }
                    }

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("isRoadSnappedActive", true);
                    ret.put("mode", Boolean.TRUE.equals(enableTurnByTurn) ? "in_app" : "headless");
                    call.resolve(ret);
                }
        );
    }

    @PluginMethod
    public void stopNavigation(PluginCall call) {
        NavigationManager.getInstance().stopNavigation();
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }
}
