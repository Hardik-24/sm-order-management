package com.siliconmarketing.fleet;

import android.os.Bundle;
import android.view.View;
import android.widget.ImageButton;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.libraries.navigation.GoogleMap;
import com.google.android.libraries.navigation.Navigator;
import com.google.android.libraries.navigation.SupportNavigationFragment;

public class NavigationActivity extends AppCompatActivity {

    private SupportNavigationFragment mNavFragment;
    private String mTitle;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_navigation);

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

        if (mNavFragment != null) {
            mNavFragment.getMapAsync(googleMap -> {
                if (googleMap != null) {
                    try {
                        googleMap.setFollowMyLocation(GoogleMap.CameraPerspective.TILTED);
                    } catch (Exception ignored) {}
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        // NavigationManager continues guidance and road-snapping in background
    }
}
