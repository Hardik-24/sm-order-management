/**
 * SM Fleet - postinstall patch script
 * 
 * Runs automatically after every `npm install` to patch the
 * @capacitor-community/background-geolocation plugin so that:
 *
 * 1. A NotificationDismissReceiver.java is written into the plugin source
 *    so Android can catch swipe-dismiss events and re-post the notification.
 * 2. BackgroundGeolocationService.java gets a static `isRunning` flag and
 *    sets/clears it when the foreground service starts/stops.
 * 3. BackgroundGeolocation.java attaches a dismiss PendingIntent to the
 *    notification so Android fires the broadcast when the user swipes.
 *
 * This is needed because:
 *   - Android 13+ ignores setOngoing(true) for third-party apps.
 *   - node_modules is never committed to Git.
 *   - GitHub Actions runs npm install fresh every build.
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'node_modules/@capacitor-community/background-geolocation/android/src/main/java/com/equimaps/capacitor_background_geolocation');

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
 * instantly while a trip is active, making it functionally un-swipeable.
 */
public class NotificationDismissReceiver extends BroadcastReceiver {

    public static final String ACTION_NOTIFICATION_DISMISSED =
            "com.equimaps.capacitor_background_geolocation.NOTIFICATION_DISMISSED";

    public static final int NOTIFICATION_ID = 1;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_NOTIFICATION_DISMISSED.equals(intent.getAction())) return;
        if (!BackgroundGeolocationService.isRunning) return;

        NotificationManager nm =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    BackgroundGeolocationService.class.getPackage().getName(),
                    "Background Geolocation",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setSound(null, null);
            nm.createNotificationChannel(channel);
        }

        Intent launchIntent = context.getPackageManager()
                .getLaunchIntentForPackage(context.getPackageName());

        PendingIntent contentIntent = null;
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            contentIntent = PendingIntent.getActivity(
                    context, 0, launchIntent,
                    PendingIntent.FLAG_CANCEL_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
        }

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(context,
                    BackgroundGeolocationService.class.getPackage().getName());
        } else {
            builder = new Notification.Builder(context);
        }

        builder.setContentTitle("SM Fleet: Trip in Progress")
                .setContentText("GPS tracking active. Drive safe!")
                .setOngoing(true)
                .setPriority(Notification.PRIORITY_HIGH)
                .setSmallIcon(context.getApplicationInfo().icon)
                .setWhen(System.currentTimeMillis());

        if (contentIntent != null) {
            builder.setContentIntent(contentIntent);
        }

        nm.notify(NOTIFICATION_ID, builder.build());
    }
}
`;
fs.writeFileSync(receiverPath, receiverCode, 'utf8');
console.log('✓ Wrote NotificationDismissReceiver.java');

// ─── 2. Patch BackgroundGeolocationService.java ──────────────────────────────
const servicePath = path.join(BASE, 'BackgroundGeolocationService.java');
let serviceCode = fs.readFileSync(servicePath, 'utf8');

if (!serviceCode.includes('public static boolean isRunning')) {
    serviceCode = serviceCode.replace(
        'private static final int NOTIFICATION_ID = 28351;',
        'private static final int NOTIFICATION_ID = 28351;\n\n    // Checked by NotificationDismissReceiver\n    public static boolean isRunning = false;'
    );
    console.log('✓ Added isRunning flag to BackgroundGeolocationService');
} else {
    console.log('· isRunning flag already present in BackgroundGeolocationService');
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
    console.log('✓ Attached dismissPendingIntent to notification builder');
} else {
    console.log('· dismissPendingIntent already attached in BackgroundGeolocation');
}

fs.writeFileSync(pluginPath, pluginCode, 'utf8');

console.log('\n✅ All SM Fleet notification patches applied successfully!');
