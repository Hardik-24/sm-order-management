package com.siliconmarketing.fleet;

import android.app.AlertDialog;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.gms.maps.model.LatLngBounds;
import com.google.android.gms.maps.model.MarkerOptions;
import com.google.android.libraries.navigation.SupportNavigationFragment;

import java.util.Locale;

public class NavigationActivity extends AppCompatActivity {

    private SupportNavigationFragment mNavFragment;
    private GoogleMap mGoogleMap;
    private TextView mTvRouteOverviewToggle;
    private String mTitle = "Customer Delivery";
    private String mOrderId = "";
    private String mOrderNumber = "";
    private long mStartTimeMs = 0;
    private double mDestLat = 0.0;
    private double mDestLng = 0.0;
    private double mCurrentDistanceKm = 0.0;
    private double mLastLat = 0.0;
    private double mLastLng = 0.0;
    private String mEtaFormatted = "Calculating...";
    private boolean mIsPreview = false;

    // Views
    private TextView mTvTitle;
    private TextView mTvStatus;
    private LinearLayout mLlPreview;
    private TextView mTvPreviewBadge;
    private TextView mTvPreviewOrderNum;
    private TextView mTvPreviewDestInfo;
    private TextView mTvPreviewRouteInfo;
    private Button mBtnStartTripNav;

    private LinearLayout mLlExpanded;
    private LinearLayout mLlCollapsed;
    private TextView mTvOrderNum;
    private TextView mTvDistance;
    private TextView mTvElapsed;
    private TextView mTvPayout;
    private TextView mTvEta;
    private TextView mTvSlimStats;
    private Button mBtnComplete;

    private final Handler mTimerHandler = new Handler(Looper.getMainLooper());
    private final Runnable mTimerRunnable = new Runnable() {
        @Override
        public void run() {
            if (!mIsPreview) {
                updateElapsedTime();
                mTimerHandler.postDelayed(this, 1000);
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_navigation);

        mTitle = getIntent().getStringExtra("title");
        if (mTitle == null || mTitle.trim().isEmpty()) {
            mTitle = "Customer Delivery";
        }
        mOrderId = getIntent().getStringExtra("orderId");
        mOrderNumber = getIntent().getStringExtra("orderNumber");
        if (mOrderNumber == null || mOrderNumber.trim().isEmpty()) {
            mOrderNumber = "#SO-TRIP";
        }
        mDestLat = getIntent().getDoubleExtra("destLat", 0.0);
        mDestLng = getIntent().getDoubleExtra("destLng", 0.0);
        mStartTimeMs = getIntent().getLongExtra("startTimeMs", 0);
        mCurrentDistanceKm = getIntent().getDoubleExtra("initialDistanceKm", 0.0);
        mIsPreview = getIntent().getBooleanExtra("isPreview", false);

        initViews();
        setupListeners();
        setupNavigationStream();

        if (!mIsPreview) {
            if (mStartTimeMs == 0) mStartTimeMs = System.currentTimeMillis();
            mTimerHandler.post(mTimerRunnable);
        }
    }

    private void initViews() {
        mTvTitle = findViewById(R.id.tv_nav_title);
        mTvStatus = findViewById(R.id.tv_nav_status);
        mTvRouteOverviewToggle = findViewById(R.id.tv_route_overview_toggle);
        if (mTvTitle != null) {
            mTvTitle.setText(mTitle);
        }

        // Preview Mode Views
        mLlPreview = findViewById(R.id.ll_banner_preview);
        mTvPreviewBadge = findViewById(R.id.tv_preview_badge);
        mTvPreviewOrderNum = findViewById(R.id.tv_preview_order_num);
        mTvPreviewDestInfo = findViewById(R.id.tv_preview_dest_info);
        mTvPreviewRouteInfo = findViewById(R.id.tv_preview_route_info);
        mBtnStartTripNav = findViewById(R.id.btn_start_trip_nav);

        // Active Trip Views
        mLlExpanded = findViewById(R.id.ll_banner_expanded);
        mLlCollapsed = findViewById(R.id.ll_banner_collapsed);
        mTvOrderNum = findViewById(R.id.tv_banner_order_num);
        mTvDistance = findViewById(R.id.tv_nav_distance);
        mTvElapsed = findViewById(R.id.tv_nav_elapsed);
        mTvPayout = findViewById(R.id.tv_nav_payout);
        mTvEta = findViewById(R.id.tv_nav_eta);
        mTvSlimStats = findViewById(R.id.tv_slim_stats);
        mBtnComplete = findViewById(R.id.btn_complete_nav);

        if (mTvOrderNum != null) {
            mTvOrderNum.setText(mOrderNumber);
        }
        if (mTvPreviewOrderNum != null) {
            mTvPreviewOrderNum.setText(mOrderNumber);
        }
        if (mTvPreviewDestInfo != null) {
            mTvPreviewDestInfo.setText(mTitle);
        }
        if (mTvDistance != null) {
            mTvDistance.setText(String.format(Locale.US, "%.1f km", mCurrentDistanceKm));
        }
        if (mTvPayout != null) {
            int payout = Math.max(50, (int) Math.round(mCurrentDistanceKm * 15));
            mTvPayout.setText("₹" + payout);
        }

        if (mIsPreview) {
            if (mTvStatus != null) {
                mTvStatus.setText("🗺️ ROUTE PREVIEW");
                mTvStatus.setTextColor(0xFF38BDF8); // Light Blue
            }
            if (mLlPreview != null) mLlPreview.setVisibility(View.VISIBLE);
            if (mLlExpanded != null) mLlExpanded.setVisibility(View.GONE);
            if (mLlCollapsed != null) mLlCollapsed.setVisibility(View.GONE);
            if (mTvPreviewRouteInfo != null) {
                mTvPreviewRouteInfo.setText("Loading route preview & road geometry...");
            }
        } else {
            if (mTvStatus != null) {
                mTvStatus.setText("🟢 LIVE NAVIGATION");
                mTvStatus.setTextColor(0xFF34D399); // Emerald
            }
            if (mLlPreview != null) mLlPreview.setVisibility(View.GONE);
            if (mLlExpanded != null) mLlExpanded.setVisibility(View.VISIBLE);
            if (mLlCollapsed != null) mLlCollapsed.setVisibility(View.GONE);
        }

        // Initialize Google Navigation Fragment
        mNavFragment = (SupportNavigationFragment) getSupportFragmentManager()
                .findFragmentById(R.id.navigation_fragment);

        if (mNavFragment != null) {
            mNavFragment.getMapAsync(googleMap -> {
                if (googleMap != null) {
                    mGoogleMap = googleMap;
                    try {
                        googleMap.setMyLocationEnabled(true);
                    } catch (Exception ignored) {}

                    if (mDestLat != 0.0 && mDestLng != 0.0) {
                        try {
                            LatLng destLatLng = new LatLng(mDestLat, mDestLng);
                            googleMap.addMarker(new MarkerOptions()
                                    .position(destLatLng)
                                    .title(mTitle));
                        } catch (Exception ignored) {}
                    }

                    if (mIsPreview) {
                        // Route preview mode: show complete route overview across screen
                        showRouteOverviewSafely();
                    } else {
                        // Active navigation mode: follow driver location with 3D driving camera
                        try {
                            googleMap.followMyLocation(GoogleMap.CameraPerspective.TILTED);
                        } catch (Exception ignored) {}
                    }
                }
            });
        }
    }

    private void setupListeners() {
        View.OnClickListener exitListener = v -> finish();

        ImageButton closeBtn = findViewById(R.id.btn_close_nav);
        if (closeBtn != null) {
            closeBtn.setOnClickListener(exitListener);
        }

        TextView exitText = findViewById(R.id.tv_exit_nav);
        if (exitText != null) {
            exitText.setOnClickListener(exitListener);
        }

        if (mTvRouteOverviewToggle != null) {
            mTvRouteOverviewToggle.setOnClickListener(v -> {
                showRouteOverviewSafely();
                Toast.makeText(this, "🗺️ Route overview centered", Toast.LENGTH_SHORT).show();
            });
        }

        // Preview Mode: Start Trip Button
        if (mBtnStartTripNav != null) {
            mBtnStartTripNav.setOnClickListener(v -> executeStartTripFromNav());
        }

        // Collapse / Expand toggle
        TextView btnToggleCollapse = findViewById(R.id.btn_toggle_collapse);
        if (btnToggleCollapse != null) {
            btnToggleCollapse.setOnClickListener(v -> setBannerCollapsed(true));
        }

        TextView btnToggleExpand = findViewById(R.id.btn_toggle_expand);
        if (btnToggleExpand != null) {
            btnToggleExpand.setOnClickListener(v -> setBannerCollapsed(false));
        }

        if (mLlCollapsed != null) {
            mLlCollapsed.setOnClickListener(v -> setBannerCollapsed(false));
        }

        // Complete Trip Button
        if (mBtnComplete != null) {
            mBtnComplete.setOnClickListener(v -> showCompleteConfirmation());
        }
    }

    private void executeStartTripFromNav() {
        if (mBtnStartTripNav != null) {
            mBtnStartTripNav.setEnabled(false);
            mBtnStartTripNav.setText("Starting Trip & Notifying Dispatch...");
        }

        double lat = mLastLat != 0.0 ? mLastLat : NavigationManager.getInstance().getLastLat();
        double lng = mLastLng != 0.0 ? mLastLng : NavigationManager.getInstance().getLastLng();

        NavigationManager.getInstance().startTripOnBackend(lat, lng, new NavigationManager.CompleteCallback() {
            @Override
            public void onSuccess(String message) {
                runOnUiThread(() -> {
                    mIsPreview = false;
                    mStartTimeMs = System.currentTimeMillis();
                    NavigationManager.getInstance().beginActiveGuidance();

                    if (mTvStatus != null) {
                        mTvStatus.setText("🟢 LIVE NAVIGATION");
                        mTvStatus.setTextColor(0xFF34D399);
                    }

                    if (mLlPreview != null) mLlPreview.setVisibility(View.GONE);
                    if (mLlExpanded != null) mLlExpanded.setVisibility(View.VISIBLE);
                    if (mLlCollapsed != null) mLlCollapsed.setVisibility(View.GONE);

                    if (mGoogleMap != null) {
                        try {
                            mGoogleMap.followMyLocation(GoogleMap.CameraPerspective.TILTED);
                        } catch (Exception ignored) {}
                    }

                    mTimerHandler.post(mTimerRunnable);
                    Toast.makeText(NavigationActivity.this, "✓ Trip started! Live tracking active.", Toast.LENGTH_LONG).show();
                });
            }

            @Override
            public void onError(String error) {
                runOnUiThread(() -> {
                    Toast.makeText(NavigationActivity.this, "⚠️ " + error, Toast.LENGTH_LONG).show();
                    if (mBtnStartTripNav != null) {
                        mBtnStartTripNav.setEnabled(true);
                        mBtnStartTripNav.setText("▶ START TRIP");
                    }
                });
            }
        });
    }

    private void setBannerCollapsed(boolean collapsed) {
        if (mIsPreview) return; // Only collapse in active trip mode
        if (collapsed) {
            if (mLlExpanded != null) mLlExpanded.setVisibility(View.GONE);
            if (mLlCollapsed != null) mLlCollapsed.setVisibility(View.VISIBLE);
        } else {
            if (mLlCollapsed != null) mLlCollapsed.setVisibility(View.GONE);
            if (mLlExpanded != null) mLlExpanded.setVisibility(View.VISIBLE);
        }
    }

    private void showRouteOverviewSafely() {
        if (mNavFragment != null) {
            try {
                mNavFragment.showRouteOverview();
            } catch (Exception e) {
                android.util.Log.w("NavigationActivity", "showRouteOverview error: " + e.getMessage());
            }
        }

        // Fit camera bounds between driver location and destination pin so both are immediately framed
        if (mGoogleMap != null && mDestLat != 0.0 && mDestLng != 0.0) {
            double startLat = mLastLat != 0.0 ? mLastLat : NavigationManager.getInstance().getLastLat();
            double startLng = mLastLng != 0.0 ? mLastLng : NavigationManager.getInstance().getLastLng();

            if (startLat != 0.0 && startLng != 0.0) {
                try {
                    LatLngBounds bounds = new LatLngBounds.Builder()
                            .include(new LatLng(startLat, startLng))
                            .include(new LatLng(mDestLat, mDestLng))
                            .build();
                    mGoogleMap.animateCamera(CameraUpdateFactory.newLatLngBounds(bounds, 180));
                } catch (Exception ignored) {}
            }
        }
    }

    private void setupNavigationStream() {
        NavigationManager.getInstance().setOnRouteReadyListener((remainingMeters, remainingSeconds) -> runOnUiThread(() -> {
            if (remainingMeters >= 0) {
                double remKm = Math.round((remainingMeters / 1000.0) * 10.0) / 10.0;
                int remMins = Math.round(remainingSeconds / 60.0f);
                mEtaFormatted = String.format(Locale.US, "%.1f km left (~%d min drive)", remKm, remMins);
                if (mTvPreviewRouteInfo != null && mIsPreview) {
                    mTvPreviewRouteInfo.setText("Route: " + mEtaFormatted + " • Tap START TRIP to begin guidance");
                }
            }

            if (mIsPreview) {
                showRouteOverviewSafely();
            }
        }));

        NavigationManager.getInstance().setLocationCallback((
                lat, lng, bearing, speedMps, accuracy, timestamp,
                isRoadSnapped, remainingMeters, remainingSeconds, distanceDrivenKm
        ) -> runOnUiThread(() -> {
            mLastLat = lat;
            mLastLng = lng;

            if (remainingMeters >= 0) {
                double remKm = Math.round((remainingMeters / 1000.0) * 10.0) / 10.0;
                int remMins = Math.round(remainingSeconds / 60.0f);
                mEtaFormatted = String.format(Locale.US, "%.1f km left (~%d min)", remKm, remMins);
            } else if (mDestLat != 0.0 && mDestLng != 0.0) {
                float[] res = new float[1];
                android.location.Location.distanceBetween(lat, lng, mDestLat, mDestLng, res);
                double remKm = Math.round((res[0] / 1000.0) * 10.0) / 10.0;
                float spd = Math.max(speedMps * 3.6f, 18.0f);
                int remMins = Math.max(1, (int) Math.round((remKm / spd) * 60));
                mEtaFormatted = String.format(Locale.US, "%.1f km left (~%d min)", remKm, remMins);
            }

            if (mIsPreview) {
                if (mTvPreviewRouteInfo != null) {
                    mTvPreviewRouteInfo.setText("📍 Destination ETA: " + mEtaFormatted);
                }
                return;
            }

            // In active trip mode:
            mCurrentDistanceKm = Math.max(mCurrentDistanceKm, distanceDrivenKm);

            if (mTvDistance != null) {
                mTvDistance.setText(String.format(Locale.US, "%.1f km", mCurrentDistanceKm));
            }

            int payout = Math.max(50, (int) Math.round(mCurrentDistanceKm * 15));
            if (mTvPayout != null) {
                mTvPayout.setText("₹" + payout);
            }

            if (mTvEta != null) {
                mTvEta.setText(mEtaFormatted);
            }

            updateSlimStatsText();
        }));
    }

    private void updateElapsedTime() {
        if (mIsPreview || mStartTimeMs == 0) return;
        long now = System.currentTimeMillis();
        long diffSec = Math.max(0, (now - mStartTimeMs) / 1000);
        long hrs = diffSec / 3600;
        long mins = (diffSec % 3600) / 60;
        long secs = diffSec % 60;

        String elapsedStr;
        if (hrs > 0) {
            elapsedStr = String.format(Locale.US, "%dh %02dm %02ds", hrs, mins, secs);
        } else {
            elapsedStr = String.format(Locale.US, "%dm %02ds", mins, secs);
        }

        if (mTvElapsed != null) {
            mTvElapsed.setText(elapsedStr);
        }

        updateSlimStatsText();
    }

    private void updateSlimStatsText() {
        if (mTvSlimStats != null && mTvElapsed != null) {
            String dist = String.format(Locale.US, "%.1f km", mCurrentDistanceKm);
            String elapsed = mTvElapsed.getText().toString();
            mTvSlimStats.setText("🟢 " + dist + " • " + elapsed + " • " + mEtaFormatted);
        }
    }

    private void showCompleteConfirmation() {
        new AlertDialog.Builder(this)
                .setTitle("Complete Delivery")
                .setMessage("Are you at " + mTitle + "? Mark order as DELIVERED and finalize your payout?")
                .setPositiveButton("Complete Delivery", (dialog, which) -> executeTripCompletion())
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void executeTripCompletion() {
        if (mBtnComplete != null) {
            mBtnComplete.setEnabled(false);
            mBtnComplete.setText("Finalizing Delivery...");
        }

        double lat = mLastLat != 0.0 ? mLastLat : NavigationManager.getInstance().getLastLat();
        double lng = mLastLng != 0.0 ? mLastLng : NavigationManager.getInstance().getLastLng();

        NavigationManager.getInstance().completeTripOnBackend(lat, lng, new NavigationManager.CompleteCallback() {
            @Override
            public void onSuccess(String message) {
                runOnUiThread(() -> {
                    Toast.makeText(NavigationActivity.this, "✓ " + message, Toast.LENGTH_LONG).show();
                    setResult(RESULT_OK);
                    finish();
                });
            }

            @Override
            public void onError(String error) {
                runOnUiThread(() -> {
                    Toast.makeText(NavigationActivity.this, "⚠️ " + error, Toast.LENGTH_LONG).show();
                    if (mBtnComplete != null) {
                        mBtnComplete.setEnabled(true);
                        mBtnComplete.setText("✓ COMPLETE TRIP");
                    }
                });
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        mTimerHandler.removeCallbacks(mTimerRunnable);
        NavigationManager.getInstance().setOnRouteReadyListener(null);
    }
}
