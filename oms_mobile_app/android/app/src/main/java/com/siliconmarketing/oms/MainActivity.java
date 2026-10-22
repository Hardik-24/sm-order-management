package com.siliconmarketing.oms;

import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Bridge bridgeInstance = this.bridge;
        if (bridgeInstance != null) {
            this.bridge.setWebViewClient(new BridgeWebViewClient(bridgeInstance) {
                @Override
                public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                    super.onReceivedError(view, request, error);
                    // Prevent Chromium Dinosaur page on network dropout or server downtime
                    if (request != null && request.isForMainFrame()) {
                        view.loadUrl("file:///android_asset/public/offline.html");
                    }
                }
            });
        }
    }
}
