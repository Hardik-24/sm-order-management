package com.siliconmarketing.fleet;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.libraries.navigation.ListenableResultFuture;
import com.google.android.libraries.navigation.NavigationApi;
import com.google.android.libraries.navigation.Navigator;
import com.google.android.libraries.navigation.SupportNavigationFragment;
import com.google.android.libraries.navigation.Waypoint;

public class NavigationActivity extends AppCompatActivity {

    private Navigator mNavigator;
    private SupportNavigationFragment mNavFragment;
    private double mDestLat;
    private double mDestLng;
    private String mTitle;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_navigation);

        mDestLat = getIntent().getDoubleExtra("destLat", 0.0);
        mDestLng = getIntent().getDoubleExtra("destLng", 0.0);
        mTitle = getIntent().getStringExtra("title");
        if (mTitle == null || mTitle.trim().isEmpty()) {
            mTitle = "Customer Delivery";
        }

        TextView titleView = findViewById(R.id.tv_nav_title);
        if (titleView != null) {
            titleView.setText(mTitle);
        }

        View.OnClickListener exitListener = v -> finish();

        ImageButton closeBtn = findViewById(R.id.btn_close_nav);
        if (closeBtn != null) {
            closeBtn.setOnClickListener(exitListener);
        }

        TextView exitText = findViewById(R.id.tv_exit_nav);
        if (exitText != null) {
            exitText.setOnClickListener(exitListener);
        }

        mNavFragment = (SupportNavigationFragment) getSupportFragmentManager()
                .findFragmentById(R.id.navigation_fragment);

        try {
            initializeNavigation();
        } catch (Exception e) {
            fallbackToGoogleMapsIntent();
        }
    }

    private void initializeNavigation() {
        NavigationApi.showTermsAndConditionsDialogIfNeeded(this, "Silicon Marketing");

        NavigationApi.getNavigator(this, new NavigationApi.NavigatorListener() {
            @Override
            public void onNavigatorReady(Navigator navigator) {
                mNavigator = navigator;
                if (mNavFragment != null) {
                    mNavFragment.getMapAsync(googleMap -> {
                        if (googleMap != null) {
                            googleMap.setFollowMyLocation(com.google.android.libraries.navigation.GoogleMap.CameraPerspective.TILTED);
                        }
                    });
                }
                setDestinationAndStart();
            }

            @Override
            public void onError(@NavigationApi.ErrorCode int errorCode) {
                fallbackToGoogleMapsIntent();
            }
        });
    }

    private void setDestinationAndStart() {
        if (mNavigator == null || (mDestLat == 0.0 && mDestLng == 0.0)) return;

        Waypoint destination = Waypoint.builder()
                .setLatLng(mDestLat, mDestLng)
                .setTitle(mTitle)
                .build();

        ListenableResultFuture<Navigator.RouteStatus> pendingRoute = mNavigator.setDestination(destination);
        pendingRoute.setOnResultListener(new ListenableResultFuture.OnResultListener<Navigator.RouteStatus>() {
            @Override
            public void onResult(Navigator.RouteStatus routeStatus) {
                if (routeStatus == Navigator.RouteStatus.OK) {
                    mNavigator.startGuidance();
                } else {
                    Toast.makeText(NavigationActivity.this, "Route status: " + routeStatus.name(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    private void fallbackToGoogleMapsIntent() {
        try {
            Uri gmmIntentUri = Uri.parse("google.navigation:q=" + mDestLat + "," + mDestLng + "&mode=d");
            Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
            mapIntent.setPackage("com.google.android.apps.maps");
            if (mapIntent.resolveActivity(getPackageManager()) != null) {
                startActivity(mapIntent);
            } else {
                Uri webUri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=" + mDestLat + "," + mDestLng + "&travelmode=driving");
                startActivity(new Intent(Intent.ACTION_VIEW, webUri));
            }
            finish();
        } catch (Exception ex) {
            Toast.makeText(this, "Unable to launch navigation: " + ex.getMessage(), Toast.LENGTH_LONG).show();
            finish();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (mNavigator != null) {
            try {
                mNavigator.stopGuidance();
                mNavigator.clearDestinations();
            } catch (Exception ignored) {}
        }
    }
}
