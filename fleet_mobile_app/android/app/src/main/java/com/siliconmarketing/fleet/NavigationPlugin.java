package com.siliconmarketing.fleet;

import android.content.Intent;
import android.net.Uri;
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
        NavigationManager.getInstance().setLocationCallback((lat, lng, bearing, speedMps, accuracy, timestamp) -> {
            JSObject data = new JSObject();
            data.put("latitude", lat);
            data.put("longitude", lng);
            data.put("bearing", bearing);
            data.put("speed", Math.round(speedMps * 3.6)); // km/h
            data.put("accuracy", accuracy);
            data.put("timestamp", timestamp > 0 ? timestamp : System.currentTimeMillis());
            data.put("isRoadSnapped", true);

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

        if (lat == null || lng == null) {
            call.reject("Invalid destination coordinates");
            return;
        }

        NavigationManager.getInstance().startNavigation(getActivity(), lat, lng, title, () -> {
            if (Boolean.TRUE.equals(enableTurnByTurn)) {
                try {
                    Intent intent = new Intent(getContext(), NavigationActivity.class);
                    intent.putExtra("destLat", lat);
                    intent.putExtra("destLng", lng);
                    intent.putExtra("title", title);
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
        });
    }

    @PluginMethod
    public void stopNavigation(PluginCall call) {
        NavigationManager.getInstance().stopNavigation();
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }
}
