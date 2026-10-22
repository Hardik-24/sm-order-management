package com.siliconmarketing.oms;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    public MainActivity() {
        super();
        initialPlugins.add(OMSBridgePlugin.class);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OMSBridgePlugin.class);
        super.onCreate(savedInstanceState);

        Bridge bridgeInstance = this.bridge;
        if (bridgeInstance != null) {
            WebView webView = bridgeInstance.getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                String defaultUa = settings.getUserAgentString();
                if (defaultUa != null && !defaultUa.contains("SiliconOMSApp")) {
                    settings.setUserAgentString(defaultUa + " SiliconOMSApp");
                }
                webView.addJavascriptInterface(new AndroidShareBridge(this), "AndroidBridge");
            }

            this.bridge.setWebViewClient(new BridgeWebViewClient(bridgeInstance) {
                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    view.evaluateJavascript("window.isSiliconOMSApp = true;", null);
                }

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

    public static class AndroidShareBridge {
        private final Context context;

        public AndroidShareBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public boolean isAndroidApp() {
            return true;
        }

        @JavascriptInterface
        public void shareImage(String base64Data, String fileName, String message, String targetApp) {
            shareImage(base64Data, fileName, message, targetApp, null);
        }

        @JavascriptInterface
        public void shareImage(String base64Data, String fileName, String message, String targetApp, String phoneNumber) {
            try {
                ShareHelper.shareImage(context, base64Data, fileName, message, targetApp, phoneNumber);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
