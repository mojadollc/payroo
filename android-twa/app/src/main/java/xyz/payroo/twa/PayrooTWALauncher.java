package xyz.payroo.twa;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebSettings;
import androidx.browser.customtabs.CustomTabsIntent;
import com.google.androidbrowserhelper.trusted.LauncherActivity;

public class PayrooTWALauncher extends LauncherActivity {
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Always launch with cache-busting parameter to ensure fresh content
        String baseUrl = "https://payroo.xyz/pos";
        String cacheBuster = "?v=" + System.currentTimeMillis();
        return Uri.parse(baseUrl + cacheBuster);
    }

    @Override
    protected void customizeCustomTabsIntent(CustomTabsIntent.Builder builder) {
        super.customizeCustomTabsIntent(builder);
        
        // Force no cache for fresh content
        builder.setShowTitle(false);
        builder.setUrlBarHidingEnabled(true);
        
        // Set custom colors
        builder.setToolbarColor(0xFFEFBF04); // Payroo yellow
        builder.setNavigationBarColor(0xFFFFFFFF); // White
    }

    @Override
    protected boolean shouldLaunchImmediately() {
        // Always launch immediately, don't wait for service connection
        return true;
    }

    @Override
    public void onResume() {
        super.onResume();
        
        // Clear any cached data when app resumes
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                // Clear WebView cache when app resumes
                android.webkit.CookieManager.getInstance().removeAllCookies(null);
                android.webkit.WebStorage.getInstance().deleteAllData();
            }
        } catch (Exception e) {
            // Ignore errors, not critical
        }
    }
}