/**
 * SM Fleet - postinstall patch script
 * 
 * Runs automatically after every `npm install` to patch the
 * @capacitor-community/background-geolocation plugin so that:
 *
 * 1. A NotificationDismissReceiver.java is written into the plugin source
 *    so Android catches swipe-dismiss events and continuously re-posts the notification.
 * 2. BackgroundGeolocationService.java exposes public static NOTIFICATION_ID and isRunning,
 *    and updates isRunning on start/stop.
 * 3. BackgroundGeolocation.java attaches a dismiss PendingIntent to the initial notification.
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'node_modules/@capacitor-community/background-geolocation/android/src/main/java/com/equimaps/capacitor_background_geolocation');

if (!fs.existsSync(BASE)) {
    console.log('Plugin directory not found, skipping postinstall patch.');
    process.exit(0);
}

// ─── 1. Write NotificationDismissReceiver.java ───────────────────────────────
const receiverPath = path.join(BASE, 'NotificationDismissReceiver.java');
const receiverCode = `package com.equimaps.capacitor_background_geolocation;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * SM Fleet - Notification Dismiss Receiver
 * Catches swipe-dismiss of the GPS tracking notification and re-posts it
 * continuously while a trip is active. Every re-posted notification has the
 * deleteIntent attached again, so it cannot be dismissed regardless of how many times swiped.
 */
public class NotificationDismissReceiver extends BroadcastReceiver {

    public static final String ACTION_NOTIFICATION_DISMISSED =
            "com.equimaps.capacitor_background_geolocation.NOTIFICATION_DISMISSED";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_NOTIFICATION_DISMISSED.equals(intent.getAction())) return;
        if (!BackgroundGeolocationService.isRunning) return;

        NotificationManager nm =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        String channelId = BackgroundGeolocationService.class.getPackage().getName();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    channelId,
                    "Background Geolocation",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setSound(null, null);
            channel.enableVibration(false);
            nm.createNotificationChannel(channel);
        }

        Intent launchIntent = context.getPackageManager()
                .getLaunchIntentForPackage(context.getPackageName());

        PendingIntent contentIntent = null;
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            contentIntent = PendingIntent.getActivity(
                    context, 0, launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
        }

        // CRITICAL: Re-attach deleteIntent so every subsequent swipe continues to fire this receiver
        Intent dismissIntent = new Intent(ACTION_NOTIFICATION_DISMISSED);
        dismissIntent.setClass(context, NotificationDismissReceiver.class);
        PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
                context,
                0,
                dismissIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(context, channelId);
        } else {
            builder = new Notification.Builder(context);
        }

        int appIcon = context.getApplicationInfo().icon;
        if (appIcon == 0) {
            appIcon = android.R.drawable.ic_menu_mylocation;
        }

        builder.setContentTitle("SM Fleet: Trip in Progress")
                .setContentText("GPS tracking active. Drive safe!")
                .setOngoing(true)
                .setPriority(Notification.PRIORITY_HIGH)
                .setSmallIcon(appIcon)
                .setWhen(System.currentTimeMillis())
                .setDeleteIntent(dismissPendingIntent);

        if (contentIntent != null) {
            builder.setContentIntent(contentIntent);
        }

        nm.notify(BackgroundGeolocationService.NOTIFICATION_ID, builder.build());
    }
}
`;
fs.writeFileSync(receiverPath, receiverCode, 'utf8');
console.log('✓ Wrote NotificationDismissReceiver.java (with recurring deleteIntent)');

// ─── 2. Patch BackgroundGeolocationService.java ──────────────────────────────
const servicePath = path.join(BASE, 'BackgroundGeolocationService.java');
let serviceCode = fs.readFileSync(servicePath, 'utf8');

// Ensure NOTIFICATION_ID is public static and isRunning is present
if (serviceCode.includes('private static final int NOTIFICATION_ID')) {
    serviceCode = serviceCode.replace(
        'private static final int NOTIFICATION_ID = 28351;',
        'public static final int NOTIFICATION_ID = 28351;\n    public static boolean isRunning = false;'
    );
    console.log('✓ Made NOTIFICATION_ID public and added isRunning');
} else if (!serviceCode.includes('public static boolean isRunning')) {
    serviceCode = serviceCode.replace(
        'public static final int NOTIFICATION_ID = 28351;',
        'public static final int NOTIFICATION_ID = 28351;\n    public static boolean isRunning = false;'
    );
    console.log('✓ Added isRunning flag');
}

if (!serviceCode.includes('isRunning = true;')) {
    serviceCode = serviceCode.replace(
        'startForeground(NOTIFICATION_ID, backgroundNotification);',
        'isRunning = true;\n                    startForeground(NOTIFICATION_ID, backgroundNotification);'
    );
    console.log('✓ Added isRunning=true on service start');
}

if (!serviceCode.includes('isRunning = false;')) {
    serviceCode = serviceCode.replace(
        'stopForeground(true);',
        'isRunning = false;\n                        stopForeground(true);'
    );
    console.log('✓ Added isRunning=false on service stop');
}

fs.writeFileSync(servicePath, serviceCode, 'utf8');

// ─── 3. Patch BackgroundGeolocation.java ─────────────────────────────────────
const pluginPath = path.join(BASE, 'BackgroundGeolocation.java');
let pluginCode = fs.readFileSync(pluginPath, 'utf8');

if (!pluginCode.includes('setDeleteIntent')) {
    pluginCode = pluginCode.replace(
        'backgroundNotification = builder.build();',
        `// Re-post notification if driver swipes it away during active trip
            Intent dismissIntent = new Intent(
                    NotificationDismissReceiver.ACTION_NOTIFICATION_DISMISSED
            );
            dismissIntent.setClass(getContext(), NotificationDismissReceiver.class);
            PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
                    getContext(),
                    0,
                    dismissIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            builder.setDeleteIntent(dismissPendingIntent);

            backgroundNotification = builder.build();`
    );
    console.log('✓ Attached dismissPendingIntent to initial notification builder');
} else {
    console.log('· dismissPendingIntent already attached in BackgroundGeolocation');
}

fs.writeFileSync(pluginPath, pluginCode, 'utf8');

console.log('\n✅ All SM Fleet notification patches applied successfully!');
