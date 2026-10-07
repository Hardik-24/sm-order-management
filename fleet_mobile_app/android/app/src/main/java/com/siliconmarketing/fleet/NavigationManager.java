package com.siliconmarketing.fleet;

import android.app.Activity;
import android.location.Location;
import android.util.Log;
import androidx.annotation.NonNull;

import com.google.android.libraries.navigation.ListenableResultFuture;
import com.google.android.libraries.navigation.NavigationApi;
import com.google.android.libraries.navigation.Navigator;
import com.google.android.libraries.navigation.RoadSnappedLocationProvider;
import com.google.android.libraries.navigation.TimeAndDistance;
import com.google.android.libraries.navigation.Waypoint;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class NavigationManager {
    private static final String TAG = "NavigationManager";
    private static NavigationManager sInstance;

    private Navigator mNavigator;
    private RoadSnappedLocationProvider mRoadSnappedProvider;
    private RoadSnappedLocationProvider.LocationListener mLocationListener;
    private OnRoadSnappedLocationCallback mLocationCallback;
    private boolean mIsNavigating = false;
    private double mCurrentDestLat = 0;
    private double mCurrentDestLng = 0;
    private String mCurrentDestTitle = "";
    private String mCurrentOrderId = "";
    private String mAuthToken = "";

    private ScheduledExecutorService mPingScheduler;
    private final List<JSONObject> mPendingPings = new ArrayList<>();
    private double mTotalDistanceDrivenMeters = 0.0;
    private double mLastLat = 0.0;
    private double mLastLng = 0.0;
    private int mLastRemainingMeters = -1;
    private int mLastRemainingSeconds = -1;
    private long mLastRoadSnappedTimestamp = 0;

    public interface OnRoadSnappedLocationCallback {
        void onLocationUpdate(
                double lat,
                double lng,
                float bearing,
                float speedMps,
                float accuracy,
                long timestamp,
                boolean isRoadSnapped,
                int remainingMeters,
                int remainingSeconds,
                double distanceDrivenKm
        );
    }

    public static synchronized NavigationManager getInstance() {
        if (sInstance == null) {
            sInstance = new NavigationManager();
        }
        return sInstance;
    }

    private NavigationManager() {}

    public void setLocationCallback(OnRoadSnappedLocationCallback callback) {
        this.mLocationCallback = callback;
    }

    public Navigator getNavigator() {
        return mNavigator;
    }

    public boolean isNavigating() {
        return mIsNavigating;
    }

    public void startNavigation(
            Activity activity,
            double destLat,
            double destLng,
            String title,
            String orderId,
            String authToken,
            Runnable onReady
    ) {
        this.mCurrentDestLat = destLat;
        this.mCurrentDestLng = destLng;
        this.mCurrentDestTitle = (title != null && !title.trim().isEmpty()) ? title : "Customer Delivery";
        this.mCurrentOrderId = (orderId != null) ? orderId : "";
        this.mAuthToken = (authToken != null) ? authToken : "";

        this.mTotalDistanceDrivenMeters = 0.0;
        this.mLastLat = 0.0;
        this.mLastLng = 0.0;
        this.mLastRemainingMeters = -1;
        this.mLastRemainingSeconds = -1;
        synchronized (mPendingPings) {
            mPendingPings.clear();
        }

        startBackgroundPingWorker();

        if (mRoadSnappedProvider == null && activity != null) {
            try {
                mRoadSnappedProvider = NavigationApi.getRoadSnappedLocationProvider(activity.getApplication());
                setupLocationListener();
            } catch (Exception e) {
                Log.w(TAG, "Failed to get RoadSnappedLocationProvider: " + e.getMessage());
            }
        }

        if (mNavigator != null) {
            applyDestinationAndStart(onReady);
            return;
        }

        NavigationApi.getNavigator(activity, new NavigationApi.NavigatorListener() {
            @Override
            public void onNavigatorReady(Navigator navigator) {
                mNavigator = navigator;
                applyDestinationAndStart(onReady);
            }

            @Override
            public void onError(@NavigationApi.ErrorCode int errorCode) {
                Log.e(TAG, "NavigationApi.getNavigator error: " + errorCode);
                if (onReady != null) onReady.run();
            }
        });
    }

    private void setupLocationListener() {
        if (mRoadSnappedProvider == null) return;

        if (mLocationListener == null) {
            mLocationListener = new RoadSnappedLocationProvider.LocationListener() {
                @Override
                public void onLocationChanged(@NonNull Location location) {
                    mLastRoadSnappedTimestamp = System.currentTimeMillis();
                    dispatchLocation(location, true);
                }

                @Override
                public void onRawLocationUpdate(@NonNull Location location) {
                    // Safety fallback: if no road-snapped point received in 2.5 seconds, use raw GPS
                    if (System.currentTimeMillis() - mLastRoadSnappedTimestamp > 2500) {
                        dispatchLocation(location, false);
                    }
                }
            };
        }

        try {
            mRoadSnappedProvider.addLocationListener(mLocationListener);
            Log.i(TAG, "Google Navigation SDK road-snapped location listener attached successfully.");
        } catch (Exception e) {
            Log.e(TAG, "Error adding location listener", e);
        }
    }

    private void updateTimeAndDistance() {
        if (mNavigator != null) {
            try {
                TimeAndDistance tad = mNavigator.getCurrentTimeAndDistance();
                if (tad != null) {
                    mLastRemainingMeters = tad.getMeters();
                    mLastRemainingSeconds = tad.getSeconds();
                }
            } catch (Exception e) {
                Log.w(TAG, "Error getting current time and distance: " + e.getMessage());
            }
        }
    }

    private void setupRemainingTimeOrDistanceListener() {
        if (mNavigator == null) return;
        try {
            mNavigator.addRemainingTimeOrDistanceChangedListener(5, 20, new Navigator.RemainingTimeOrDistanceChangedListener() {
                @Override
                public void onRemainingTimeOrDistanceChanged() {
                    updateTimeAndDistance();
                }
            });
        } catch (Exception e) {
            Log.w(TAG, "Could not register RemainingTimeOrDistanceChangedListener: " + e.getMessage());
        }
    }

    private void dispatchLocation(Location location, boolean isRoadSnapped) {
        double lat = location.getLatitude();
        double lng = location.getLongitude();
        float bearing = location.getBearing();
        float speed = location.getSpeed();
        float accuracy = location.getAccuracy();
        long timestamp = location.getTime() > 0 ? location.getTime() : System.currentTimeMillis();

        if (mLastLat != 0.0 && mLastLng != 0.0) {
            float[] results = new float[1];
            Location.distanceBetween(mLastLat, mLastLng, lat, lng, results);
            float deltaMeters = results[0];
            if (deltaMeters >= 3.0f && deltaMeters <= 1200.0f) {
                mTotalDistanceDrivenMeters += deltaMeters;
            }
        }
        mLastLat = lat;
        mLastLng = lng;

        updateTimeAndDistance();

        double distanceDrivenKm = Math.round((mTotalDistanceDrivenMeters / 1000.0) * 100.0) / 100.0;

        if (mLocationCallback != null) {
            mLocationCallback.onLocationUpdate(
                    lat,
                    lng,
                    bearing,
                    speed,
                    accuracy,
                    timestamp,
                    isRoadSnapped,
                    mLastRemainingMeters,
                    mLastRemainingSeconds,
                    distanceDrivenKm
            );
        }

        // Buffer for native background HTTP ping
        if (mIsNavigating && mCurrentOrderId != null && !mCurrentOrderId.isEmpty()) {
            try {
                JSONObject pt = new JSONObject();
                pt.put("lat", lat);
                pt.put("lng", lng);
                pt.put("speed", Math.round(speed * 3.6f)); // km/h
                pt.put("heading", bearing);
                pt.put("timestamp", timestamp);

                synchronized (mPendingPings) {
                    mPendingPings.add(pt);
                    if (mPendingPings.size() > 250) {
                        mPendingPings.remove(0);
                    }
                }
            } catch (Exception ignored) {}
        }
    }

    private void applyDestinationAndStart(Runnable onReady) {
        if (mNavigator == null || (mCurrentDestLat == 0 && mCurrentDestLng == 0)) {
            if (onReady != null) onReady.run();
            return;
        }

        Waypoint destination = Waypoint.builder()
                .setLatLng(mCurrentDestLat, mCurrentDestLng)
                .setTitle(mCurrentDestTitle)
                .build();

        ListenableResultFuture<Navigator.RouteStatus> pendingRoute = mNavigator.setDestination(destination);
        pendingRoute.setOnResultListener(new ListenableResultFuture.OnResultListener<Navigator.RouteStatus>() {
            @Override
            public void onResult(Navigator.RouteStatus routeStatus) {
                if (routeStatus == Navigator.RouteStatus.OK) {
                    try {
                        mNavigator.startGuidance();
                        mIsNavigating = true;
                        Log.i(TAG, "Guidance started to destination. Road-snapping active.");
                        setupRemainingTimeOrDistanceListener();
                        updateTimeAndDistance();
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to start guidance", e);
                    }
                } else {
                    Log.w(TAG, "Route status returned: " + routeStatus.name());
                }
                if (onReady != null) onReady.run();
            }
        });
    }

    private void startBackgroundPingWorker() {
        stopBackgroundPingWorker();
        mPingScheduler = Executors.newSingleThreadScheduledExecutor();
        mPingScheduler.scheduleWithFixedDelay(this::sendPendingPingsToBackend, 10, 10, TimeUnit.SECONDS);
    }

    private void stopBackgroundPingWorker() {
        if (mPingScheduler != null) {
            try {
                mPingScheduler.shutdownNow();
            } catch (Exception ignored) {}
            mPingScheduler = null;
        }
    }

    private void sendPendingPingsToBackend() {
        if (mCurrentOrderId == null || mCurrentOrderId.isEmpty() || mAuthToken == null || mAuthToken.isEmpty()) {
            return;
        }

        List<JSONObject> toSend;
        synchronized (mPendingPings) {
            if (mPendingPings.isEmpty()) return;
            toSend = new ArrayList<>(mPendingPings);
            mPendingPings.clear();
        }

        try {
            URL url = new URL("https://sm-order-management.vercel.app/api/driver/trip");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + mAuthToken);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setDoOutput(true);

            JSONObject body = new JSONObject();
            body.put("action", "ping");
            body.put("orderId", mCurrentOrderId);

            JSONArray points = new JSONArray();
            for (JSONObject pt : toSend) {
                points.put(pt);
            }
            body.put("points", points);

            byte[] outputBytes = body.toString().getBytes("UTF-8");
            try (OutputStream os = conn.getOutputStream()) {
                os.write(outputBytes);
                os.flush();
            }

            int code = conn.getResponseCode();
            if (code == 200) {
                Log.d(TAG, "Native GPS ping delivered successfully (" + toSend.size() + " points)");
            } else {
                Log.w(TAG, "Native GPS ping response code: " + code);
                synchronized (mPendingPings) {
                    mPendingPings.addAll(0, toSend);
                    while (mPendingPings.size() > 250) {
                        mPendingPings.remove(mPendingPings.size() - 1);
                    }
                }
            }
            conn.disconnect();
        } catch (Exception e) {
            Log.w(TAG, "Native GPS ping error: " + e.getMessage());
            synchronized (mPendingPings) {
                mPendingPings.addAll(0, toSend);
                while (mPendingPings.size() > 250) {
                    mPendingPings.remove(mPendingPings.size() - 1);
                }
            }
        }
    }

    public void stopNavigation() {
        mIsNavigating = false;
        stopBackgroundPingWorker();
        new Thread(this::sendPendingPingsToBackend).start();

        if (mRoadSnappedProvider != null && mLocationListener != null) {
            try {
                mRoadSnappedProvider.removeLocationListener(mLocationListener);
            } catch (Exception ignored) {}
        }
        if (mNavigator != null) {
            try {
                mNavigator.stopGuidance();
                mNavigator.clearDestinations();
                Log.i(TAG, "Navigation session stopped.");
            } catch (Exception e) {
                Log.e(TAG, "Error stopping navigation", e);
            }
        }

        mCurrentOrderId = "";
        mAuthToken = "";
        mTotalDistanceDrivenMeters = 0.0;
        mLastLat = 0.0;
        mLastLng = 0.0;
        mLastRemainingMeters = -1;
        mLastRemainingSeconds = -1;
    }
}
