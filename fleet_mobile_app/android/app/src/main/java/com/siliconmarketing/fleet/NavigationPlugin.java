package com.siliconmarketing.fleet;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NavigationPlugin")
public class NavigationPlugin extends Plugin {

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
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

        if (Boolean.TRUE.equals(enableTurnByTurn)) {
            try {
                Intent intent = new Intent(getContext(), NavigationActivity.class);
                intent.putExtra("destLat", lat);
                intent.putExtra("destLng", lng);
                intent.putExtra("title", title);
                getActivity().startActivity(intent);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("mode", "in_app");
                call.resolve(ret);
            } catch (Exception e) {
                // Fallback to Google Maps app intent
                try {
                    Uri gmmIntentUri = Uri.parse("google.navigation:q=" + lat + "," + lng + "&mode=d");
                    Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
                    mapIntent.setPackage("com.google.android.apps.maps");
                    getContext().startActivity(mapIntent);

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("mode", "external_maps");
                    call.resolve(ret);
                } catch (Exception ex) {
                    call.reject("Failed to start navigation: " + ex.getMessage());
                }
            }
        } else {
            // Headless Mode: background tracking remains active without full-screen navigation takeover
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("mode", "headless");
            call.resolve(ret);
        }
    }
}
