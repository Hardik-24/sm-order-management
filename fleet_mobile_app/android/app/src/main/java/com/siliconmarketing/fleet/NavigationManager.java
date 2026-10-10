package com.siliconmarketing.fleet;

import android.app.Activity;
import android.content.Context;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Looper;
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
    private LocationListener mNativeGpsListener;
    private LocationManager mNativeLocationManager;
    private OnRoadSnappedLocationCallback mLocationCallback;
    private boolean mIsNavigating = false;
    private boolean mIsTripActive = false;
    private double mCurrentDestLat = 0;
    private double mCurrentDestLng = 0;
    private String mCurrentDestTitle = "";
    private String mCurrentOrderId = "";
    private String mAuthToken = "";
    private String mApiUrl = "https://sm-order-management.vercel.app";

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

    public interface CompleteCallback {
        void onSuccess(String message);
        void onError(String error);
    }

    public interface OnRouteReadyListener {
        void onRouteReady(int remainingMeters, int remainingSeconds);
    }

    private OnRouteReadyListener mRouteReadyListener;

    public void setOnRouteReadyListener(OnRouteReadyListener listener) {
        this.mRouteReadyListener = listener;
        if (listener != null && mLastRemainingMeters >= 0) {
            listener.onRouteReady(mLastRemainingMeters, mLastRemainingSeconds);
        }
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

    public boolean isTripActive() {
        return mIsTripActive;
    }

    public double getTotalDistanceDrivenKm() {
        return Math.round((mTotalDistanceDrivenMeters / 1000.0) * 100.0) / 100.0;
    }

    public double getLastLat() {
        return mLastLat;
    }

    public double getLastLng() {
        return mLastLng;
    }

    public void startNavigation(
            Activity activity,
            double destLat,
            double destLng,
            String title,
            String orderId,
            String authToken,
            String apiUrl,
            double initialDistanceKm,
            boolean isPreview,
            Runnable onReady
    ) {
        this.mCurrentDestLat = destLat;
        this.mCurrentDestLng = destLng;
        this.mCurrentDestTitle = (title != null && !title.trim().isEmpty()) ? title : "Customer Delivery";
        this.mCurrentOrderId = (orderId != null) ? orderId : "";
        this.mAuthToken = (authToken != null) ? authToken : "";
        if (apiUrl != null && !apiUrl.trim().isEmpty()) {
            this.mApiUrl = apiUrl.trim();
        }

        this.mIsTripActive = !isPreview;
        this.mTotalDistanceDrivenMeters = initialDistanceKm > 0 ? (initialDistanceKm * 1000.0) : 0.0;
        this.mLastLat = 0.0;
        this.mLastLng = 0.0;
        this.mLastRemainingMeters = -1;
        this.mLastRemainingSeconds = -1;
        synchronized (mPendingPings) {
            mPendingPings.clear();
        }

        if (mIsTripActive) {
            startBackgroundPingWorker();
        } else {
            stopBackgroundPingWorker();
        }

        setupNativeGpsFallback(activity);

        // Attempt Google Navigation SDK Road Snapped Provider
        if (mRoadSnappedProvider == null && activity != null) {
            try {
                mRoadSnappedProvider = NavigationApi.getRoadSnappedLocationProvider(activity.getApplication());
                setupLocationListener();
            } catch (Exception e) {
                Log.w(TAG, "NavigationApi RoadSnappedLocationProvider not available: " + e.getMessage());
            }
        }

        if (mNavigator != null) {
            applyDestinationAndStart(onReady);
            return;
        }

        try {
            NavigationApi.getNavigator(activity, new NavigationApi.NavigatorListener() {
                @Override
                public void onNavigatorReady(Navigator navigator) {
                    mNavigator = navigator;
                    applyDestinationAndStart(onReady);
                }

                @Override
                public void onError(@NavigationApi.ErrorCode int errorCode) {
                    Log.w(TAG, "NavigationApi.getNavigator errorCode: " + errorCode + " (Using native hardware GPS)");
                    if (onReady != null) onReady.run();
                }
            });
        } catch (Exception e) {
            Log.w(TAG, "NavigationApi getNavigator error: " + e.getMessage());
            if (onReady != null) onReady.run();
        }
    }

    /**
     * Rock-solid fallback: Uses Android's native LocationManager hardware GPS chip.
     * Ensures location updates and distance calculation NEVER stop, even if Google
     * Navigation SDK is licensing-restricted or paused.
     */
    private void setupNativeGpsFallback(Activity activity) {
        if (activity == null) return;
        try {
            if (mNativeLocationManager == null) {
                mNativeLocationManager = (LocationManager) activity.getSystemService(Context.LOCATION_SERVICE);
            }
            if (mNativeLocationManager != null && mNativeGpsListener == null) {
                mNativeGpsListener = new LocationListener() {
                    @Override
                    public void onLocationChanged(@NonNull Location location) {
                        // Use native GPS fix if no road-snapped point arrived in last 1.8 seconds
                        if (System.currentTimeMillis() - mLastRoadSnappedTimestamp > 1800) {
                            dispatchLocation(location, false);
                        }
                    }

                    @Override
                    public void onStatusChanged(String provider, int status, Bundle extras) {}
                    @Override
                    public void onProviderEnabled(@NonNull String provider) {}
                    @Override
                    public void onProviderDisabled(@NonNull String provider) {}
                };

                if (mNativeLocationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    mNativeLocationManager.requestLocationUpdates(
                            LocationManager.GPS_PROVIDER,
                            1000,
                            1.0f,
                            mNativeGpsListener,
                            Looper.getMainLooper()
                    );
                }
                if (mNativeLocationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    mNativeLocationManager.requestLocationUpdates(
                            LocationManager.NETWORK_PROVIDER,
                            2000,
                            2.0f,
                            mNativeGpsListener,
                            Looper.getMainLooper()
                    );
                }
                Log.i(TAG, "Native hardware GPS listener registered successfully.");
            }
        } catch (SecurityException se) {
            Log.w(TAG, "GPS permission not granted for native LocationManager: " + se.getMessage());
        } catch (Exception e) {
            Log.w(TAG, "Error attaching native GPS listener: " + e.getMessage());
        }
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
                    if (System.currentTimeMillis() - mLastRoadSnappedTimestamp > 2000) {
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
                    if (mRouteReadyListener != null) {
                        mRouteReadyListener.onRouteReady(mLastRemainingMeters, mLastRemainingSeconds);
                    }
                }
            } catch (Exception ignored) {}
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
        } catch (Exception ignored) {}
    }

    private void dispatchLocation(Location location, boolean isRoadSnapped) {
        double lat = location.getLatitude();
        double lng = location.getLongitude();
        float bearing = location.getBearing();
        float speed = location.getSpeed();
        float accuracy = location.getAccuracy();
        long timestamp = location.getTime() > 0 ? location.getTime() : System.currentTimeMillis();

        if (mIsTripActive && mLastLat != 0.0 && mLastLng != 0.0) {
            float[] results = new float[1];
            Location.distanceBetween(mLastLat, mLastLng, lat, lng, results);
            float deltaMeters = results[0];
            // Filter stationary GPS jitter (< 2.5m) and impossible teleportation (> 1500m)
            if (deltaMeters >= 2.5f && deltaMeters <= 1500.0f) {
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

        // Buffer for native background HTTP ping (ONLY while trip is officially active)
        if (mIsTripActive && mCurrentOrderId != null && !mCurrentOrderId.isEmpty()) {
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

        try {
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
                            if (mIsTripActive) {
                                mNavigator.startGuidance();
                                mIsNavigating = true;
                                Log.i(TAG, "Guidance started to destination. Road-snapping active.");
                            }
                            setupRemainingTimeOrDistanceListener();
                            updateTimeAndDistance();
                            if (mRouteReadyListener != null) {
                                mRouteReadyListener.onRouteReady(mLastRemainingMeters, mLastRemainingSeconds);
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "Failed to set guidance", e);
                        }
                    } else {
                        Log.w(TAG, "Route status returned: " + routeStatus.name());
                    }
                    if (onReady != null) onReady.run();
                }
            });
        } catch (Exception e) {
            Log.w(TAG, "applyDestinationAndStart error: " + e.getMessage());
            if (onReady != null) onReady.run();
        }
    }

    public void beginActiveGuidance() {
        mIsTripActive = true;
        startBackgroundPingWorker();
        if (mNavigator != null) {
            try {
                mNavigator.startGuidance();
                mIsNavigating = true;
            } catch (Exception e) {
                Log.w(TAG, "beginActiveGuidance error: " + e.getMessage());
            }
        }
    }

    private void startBackgroundPingWorker() {
        stopBackgroundPingWorker();
        mPingScheduler = Executors.newSingleThreadScheduledExecutor();
        mPingScheduler.scheduleWithFixedDelay(this::sendPendingPingsToBackend, 8, 10, TimeUnit.SECONDS);
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
        if (!mIsTripActive || mCurrentOrderId == null || mCurrentOrderId.isEmpty() || mAuthToken == null || mAuthToken.isEmpty()) {
            return;
        }

        List<JSONObject> toSend;
        synchronized (mPendingPings) {
            if (mPendingPings.isEmpty()) return;
            toSend = new ArrayList<>(mPendingPings);
            mPendingPings.clear();
        }

        try {
            String baseUrl = (mApiUrl.endsWith("/")) ? mApiUrl.substring(0, mApiUrl.length() - 1) : mApiUrl;
            URL url = new URL(baseUrl + "/api/driver/trip");
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

    public void startTripOnBackend(double lat, double lng, CompleteCallback callback) {
        new Thread(() -> {
            try {
                String baseUrl = (mApiUrl.endsWith("/")) ? mApiUrl.substring(0, mApiUrl.length() - 1) : mApiUrl;
                URL url = new URL(baseUrl + "/api/driver/trip");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + mAuthToken);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                conn.setDoOutput(true);

                JSONObject body = new JSONObject();
                body.put("action", "start");
                body.put("orderId", mCurrentOrderId);

                if (lat != 0.0 && lng != 0.0) {
                    JSONObject coords = new JSONObject();
                    coords.put("lat", lat);
                    coords.put("lng", lng);
                    body.put("coords", coords);
                }

                if (mCurrentDestLat != 0.0 && mCurrentDestLng != 0.0) {
                    JSONObject destCoords = new JSONObject();
                    destCoords.put("lat", mCurrentDestLat);
                    destCoords.put("lng", mCurrentDestLng);
                    body.put("destinationCoords", destCoords);
                }

                byte[] outputBytes = body.toString().getBytes("UTF-8");
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(outputBytes);
                    os.flush();
                }

                int code = conn.getResponseCode();
                if (code == 200) {
                    beginActiveGuidance();
                    if (callback != null) callback.onSuccess("Trip started successfully!");
                } else {
                    if (callback != null) callback.onError("Failed to start trip (Code " + code + ")");
                }
                conn.disconnect();
            } catch (Exception e) {
                if (callback != null) callback.onError(e.getMessage());
            }
        }).start();
    }

    public void completeTripOnBackend(double lat, double lng, CompleteCallback callback) {
        new Thread(() -> {
            try {
                String baseUrl = (mApiUrl.endsWith("/")) ? mApiUrl.substring(0, mApiUrl.length() - 1) : mApiUrl;
                URL url = new URL(baseUrl + "/api/driver/trip");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + mAuthToken);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                conn.setDoOutput(true);

                JSONObject body = new JSONObject();
                body.put("action", "complete");
                body.put("orderId", mCurrentOrderId);
                if (lat != 0.0 && lng != 0.0) {
                    JSONObject coords = new JSONObject();
                    coords.put("lat", lat);
                    coords.put("lng", lng);
                    body.put("coords", coords);
                }

                byte[] outputBytes = body.toString().getBytes("UTF-8");
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(outputBytes);
                    os.flush();
                }

                int code = conn.getResponseCode();
                if (code == 200) {
                    stopNavigation();
                    if (callback != null) callback.onSuccess("Trip completed successfully!");
                } else {
                    if (callback != null) callback.onError("Failed to complete trip (Code " + code + ")");
                }
                conn.disconnect();
            } catch (Exception e) {
                if (callback != null) callback.onError(e.getMessage());
            }
        }).start();
    }

    public void stopNavigation() {
        mIsNavigating = false;
        mIsTripActive = false;
        stopBackgroundPingWorker();
        new Thread(this::sendPendingPingsToBackend).start();

        if (mNativeLocationManager != null && mNativeGpsListener != null) {
            try {
                mNativeLocationManager.removeUpdates(mNativeGpsListener);
            } catch (Exception ignored) {}
            mNativeGpsListener = null;
        }

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
            } catch (Exception ignored) {}
        }

        mCurrentOrderId = "";
        mAuthToken = "";
    }
}
