package com.siliconmarketing.fleet;

import android.app.Activity;
import android.location.Location;
import android.location.LocationListener;
import android.os.Bundle;
import android.util.Log;
import androidx.annotation.NonNull;

import com.google.android.libraries.navigation.ListenableResultFuture;
import com.google.android.libraries.navigation.NavigationApi;
import com.google.android.libraries.navigation.Navigator;
import com.google.android.libraries.navigation.Waypoint;

public class NavigationManager {
    private static final String TAG = "NavigationManager";
    private static NavigationManager sInstance;

    private Navigator mNavigator;
    private LocationListener mLocationListener;
    private OnRoadSnappedLocationCallback mLocationCallback;
    private boolean mIsNavigating = false;
    private double mCurrentDestLat = 0;
    private double mCurrentDestLng = 0;
    private String mCurrentDestTitle = "";

    public interface OnRoadSnappedLocationCallback {
        void onLocationUpdate(double lat, double lng, float bearing, float speedMps, float accuracy, long timestamp);
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

    public void startNavigation(Activity activity, double destLat, double destLng, String title, Runnable onReady) {
        this.mCurrentDestLat = destLat;
        this.mCurrentDestLng = destLng;
        this.mCurrentDestTitle = (title != null && !title.trim().isEmpty()) ? title : "Customer Delivery";

        try {
            NavigationApi.showTermsAndConditionsDialogIfNeeded(activity, "Silicon Marketing");
        } catch (Exception e) {
            Log.w(TAG, "Terms dialog check warning: " + e.getMessage());
        }

        if (mNavigator != null) {
            applyDestinationAndStart(onReady);
            return;
        }

        NavigationApi.getNavigator(activity, new NavigationApi.NavigatorListener() {
            @Override
            public void onNavigatorReady(Navigator navigator) {
                mNavigator = navigator;
                setupLocationListener();
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
        if (mNavigator == null) return;

        if (mLocationListener == null) {
            mLocationListener = new LocationListener() {
                @Override
                public void onLocationChanged(@NonNull Location location) {
                    if (mLocationCallback != null) {
                        mLocationCallback.onLocationUpdate(
                                location.getLatitude(),
                                location.getLongitude(),
                                location.getBearing(),
                                location.getSpeed(),
                                location.getAccuracy(),
                                location.getTime()
                        );
                    }
                }

                @Override
                public void onStatusChanged(String provider, int status, Bundle extras) {}

                @Override
                public void onProviderEnabled(@NonNull String provider) {}

                @Override
                public void onProviderDisabled(@NonNull String provider) {}
            };
        }

        try {
            mNavigator.addLocationListener(mLocationListener);
            Log.i(TAG, "Google Navigation SDK road-snapped location listener attached successfully.");
        } catch (Exception e) {
            Log.e(TAG, "Error adding location listener", e);
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

    public void stopNavigation() {
        mIsNavigating = false;
        if (mNavigator != null) {
            try {
                mNavigator.stopGuidance();
                mNavigator.clearDestinations();
                if (mLocationListener != null) {
                    mNavigator.removeLocationListener(mLocationListener);
                }
                Log.i(TAG, "Navigation session stopped and location listener detached.");
            } catch (Exception e) {
                Log.e(TAG, "Error stopping navigation", e);
            }
        }
    }
}
