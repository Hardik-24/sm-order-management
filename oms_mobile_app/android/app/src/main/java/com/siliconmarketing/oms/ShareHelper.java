package com.siliconmarketing.oms;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.util.List;

public class ShareHelper {

    public static boolean isAppInstalled(String packageName, PackageManager packageManager) {
        try {
            packageManager.getPackageInfo(packageName, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public static void shareImage(Context context, String base64Data, String fileName, String message, String targetApp, String phoneNumber) throws Exception {
        if (base64Data == null || base64Data.trim().isEmpty()) {
            throw new IllegalArgumentException("Image data is empty");
        }

        String cleanBase64 = base64Data.trim();
        int commaIndex = cleanBase64.indexOf(",");
        if (commaIndex != -1) {
            cleanBase64 = cleanBase64.substring(commaIndex + 1);
        }
        cleanBase64 = cleanBase64.replaceAll("\\s+", "");

        byte[] imageBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

        // Prefer external cache directory so other apps (like WhatsApp) can read seamlessly, fallback to cacheDir
        File baseDir = context.getExternalCacheDir();
        if (baseDir == null) {
            baseDir = context.getCacheDir();
        }

        File shareDir = new File(baseDir, "shared_quotes");
        if (!shareDir.exists()) {
            shareDir.mkdirs();
        }

        String safeFileName = (fileName != null && !fileName.trim().isEmpty()) ? fileName.trim() : "quotation_slip.png";
        if (!safeFileName.toLowerCase().endsWith(".png") && !safeFileName.toLowerCase().endsWith(".jpg")) {
            safeFileName += ".png";
        }

        File imageFile = new File(shareDir, safeFileName);
        FileOutputStream fos = new FileOutputStream(imageFile);
        fos.write(imageBytes);
        fos.flush();
        fos.close();

        // Ensure file is world-readable
        imageFile.setReadable(true, false);

        String authority = context.getPackageName() + ".fileprovider";
        Uri contentUri = FileProvider.getUriForFile(context, authority, imageFile);

        Intent sendIntent = new Intent(Intent.ACTION_SEND);
        String mimeType = safeFileName.toLowerCase().endsWith(".jpg") ? "image/jpeg" : "image/png";
        sendIntent.setType(mimeType);
        sendIntent.putExtra(Intent.EXTRA_STREAM, contentUri);

        if (message != null && !message.trim().isEmpty()) {
            sendIntent.putExtra(Intent.EXTRA_TEXT, message);
        }

        // CRITICAL 1: Set ClipData for Android 10+ (API 29+) to grant read URI permissions to EXTRA_STREAM
        sendIntent.setClipData(ClipData.newRawUri("Quotation", contentUri));

        // CRITICAL 2: Flags to grant temporary read URI permission
        sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        sendIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        PackageManager pm = context.getPackageManager();
        boolean isWhatsApp = isAppInstalled("com.whatsapp", pm);
        boolean isWhatsAppBiz = isAppInstalled("com.whatsapp.w4b", pm);

        // Format clean phone number (India format: 10 digits -> 91xxxxxxxxxx)
        String jidNumber = null;
        if (phoneNumber != null && !phoneNumber.trim().isEmpty()) {
            String digitsOnly = phoneNumber.replaceAll("[^0-9]", "");
            if (digitsOnly.length() == 10) {
                jidNumber = "91" + digitsOnly;
            } else if (digitsOnly.length() > 10) {
                jidNumber = digitsOnly;
            }
        }

        if ("whatsapp".equalsIgnoreCase(targetApp) && (isWhatsApp || isWhatsAppBiz)) {
            // CRITICAL 3: Grant URI permission explicitly to both WhatsApp variants
            if (isWhatsApp) {
                context.grantUriPermission("com.whatsapp", contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }
            if (isWhatsAppBiz) {
                context.grantUriPermission("com.whatsapp.w4b", contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }

            // Target package (prefer standard WhatsApp, or use Business if that is the one installed)
            String targetPkg = (isWhatsAppBiz && !isWhatsApp) ? "com.whatsapp.w4b" : "com.whatsapp";
            sendIntent.setPackage(targetPkg);

            if (jidNumber != null) {
                sendIntent.putExtra("jid", jidNumber + "@s.whatsapp.net");
            }

            try {
                context.startActivity(sendIntent);
                return;
            } catch (Exception directErr) {
                directErr.printStackTrace();
                sendIntent.removeExtra("jid");
                sendIntent.setPackage(null);
            }
        }

        // Fallback or general sharing via system chooser: grant URI permission to all potential matching apps
        List<ResolveInfo> resInfoList = pm.queryIntentActivities(sendIntent, PackageManager.MATCH_DEFAULT_ONLY);
        for (ResolveInfo resolveInfo : resInfoList) {
            String packageName = resolveInfo.activityInfo.packageName;
            context.grantUriPermission(packageName, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }

        Intent chooser = Intent.createChooser(sendIntent, "Share Quotation Slip");
        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(chooser);
    }
}
