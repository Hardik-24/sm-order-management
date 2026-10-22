package com.siliconmarketing.oms;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OMSBridge")
public class OMSBridgePlugin extends Plugin {

    @PluginMethod
    public void shareImage(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String fileName = call.getString("fileName");
        String message = call.getString("message");
        String targetApp = call.getString("targetApp");
        String phoneNumber = call.getString("phoneNumber");

        try {
            ShareHelper.shareImage(getContext(), base64Data, fileName, message, targetApp, phoneNumber);
            call.resolve();
        } catch (Exception e) {
            call.reject("Share failed: " + e.getMessage(), e);
        }
    }
}
