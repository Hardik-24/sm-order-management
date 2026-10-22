package com.siliconmarketing.oms;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.io.File;
import java.io.FileOutputStream;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Bridge bridgeInstance = this.bridge;
        if (bridgeInstance != null) {
            // Register native Android share bridge for seamless WhatsApp image + text sharing
            WebView webView = bridgeInstance.getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(new AndroidShareBridge(this), "AndroidBridge");
            }

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
            try {
                if (base64Data == null || base64Data.isEmpty()) {
                    return;
                }

                String cleanBase64 = base64Data;
                int commaIndex = cleanBase64.indexOf(",");
                if (commaIndex != -1) {
                    cleanBase64 = cleanBase64.substring(commaIndex + 1);
                }

                byte[] imageBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

                File cacheDir = new File(context.getCacheDir(), "shared_quotes");
                if (!cacheDir.exists()) {
                    cacheDir.mkdirs();
                }

                String safeFileName = (fileName != null && !fileName.trim().isEmpty()) ? fileName.trim() : "quotation_slip.png";
                if (!safeFileName.toLowerCase().endsWith(".png")) {
                    safeFileName += ".png";
                }

                File imageFile = new File(cacheDir, safeFileName);
                FileOutputStream fos = new FileOutputStream(imageFile);
                fos.write(imageBytes);
                fos.flush();
                fos.close();

                String authority = context.getPackageName() + ".fileprovider";
                Uri contentUri = FileProvider.getUriForFile(context, authority, imageFile);

                Intent sendIntent = new Intent(Intent.ACTION_SEND);
                sendIntent.setType("image/png");
                sendIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                if (message != null && !message.isEmpty()) {
                    sendIntent.putExtra(Intent.EXTRA_TEXT, message);
                }
                sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                sendIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                PackageManager pm = context.getPackageManager();

                if ("whatsapp".equalsIgnoreCase(targetApp)) {
                    boolean isWhatsApp = isAppInstalled("com.whatsapp", pm);
                    boolean isWhatsAppBiz = isAppInstalled("com.whatsapp.w4b", pm);

                    if (isWhatsApp) {
                        sendIntent.setPackage("com.whatsapp");
                        context.startActivity(sendIntent);
                    } else if (isWhatsAppBiz) {
                        sendIntent.setPackage("com.whatsapp.w4b");
                        context.startActivity(sendIntent);
                    } else {
                        Intent chooser = Intent.createChooser(sendIntent, "Share Quotation via");
                        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(chooser);
                    }
                } else {
                    Intent chooser = Intent.createChooser(sendIntent, "Share Quotation via");
                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(chooser);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        private boolean isAppInstalled(String packageName, PackageManager packageManager) {
            try {
                packageManager.getPackageInfo(packageName, 0);
                return true;
            } catch (PackageManager.NameNotFoundException e) {
                return false;
            }
        }
    }
}
