package com.siliconmarketing.oms;

import android.content.Intent;
import android.net.Uri;
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
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    if (request == null || request.getUrl() == null) {
                        return false;
                    }
                    Uri uri = request.getUrl();
                    String scheme = uri.getScheme();
                    String url = uri.toString();

                    // Allow external apps for phone calls, WhatsApp, email, maps
                    if (scheme != null && (scheme.equals("tel") || scheme.equals("mailto") || scheme.equals("whatsapp") || url.startsWith("https://api.whatsapp.com") || url.startsWith("https://wa.me"))) {
                        try {
                            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                            view.getContext().startActivity(intent);
                            return true;
                        } catch (Exception e) {
                            return true;
                        }
                    }

                    // Keep ALL http and https URLs inside this app's WebView (NEVER open in Chrome/external browser)
                    if (scheme != null && (scheme.equals("http") || scheme.equals("https"))) {
                        return false; // Tells Android: load internally inside this WebView!
                    }

                    return super.shouldOverrideUrlLoading(view, request);
                }

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
