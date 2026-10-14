package com.batuhantnk.blok2048;

import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private Insets cutoutInsets = Insets.NONE;
    private boolean webContentReady;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // BridgeActivity installs the no-action-bar theme before we touch the decor view.
        super.onCreate(savedInstanceState);
        configureContentInsets();
        enterImmersiveMode();
    }

    @Override
    public void onResume() {
        super.onResume();
        enterImmersiveMode();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enterImmersiveMode();
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        enterImmersiveMode();
    }

    private void configureFullscreenWindow() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        // Immersive mode must also opt into the camera cutout area on older Android versions.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = getWindow().getAttributes();
            attributes.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attributes);
        }
        // Fallback color while the full-screen WebView loads.
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.parseColor("#141a2e")));
    }

    private void configureContentInsets() {
        if (bridge == null) return;
        // Keep the WebView at the physical screen edge on every WebView version.
        // Safe cutout space belongs INSIDE the page so its background paints it.
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, insets) -> {
            view.setPadding(0, 0, 0, 0);
            Insets next = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            if (!next.equals(cutoutInsets)) {
                cutoutInsets = next;
                publishSafeArea();
            }
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(), Insets.NONE)
                .build();
        });
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                webContentReady = true;
                publishSafeArea();
            }
        });
        ViewCompat.requestApplyInsets(getWindow().getDecorView());
    }

    private void publishSafeArea() {
        if (!webContentReady || bridge == null || bridge.getWebView() == null) return;
        float density = getResources().getDisplayMetrics().density;
        String script = String.format(Locale.US,
            "(() => { const s = document.documentElement.style; " +
            "s.setProperty('--safe-area-inset-top', '%.2fpx'); " +
            "s.setProperty('--safe-area-inset-right', '%.2fpx'); " +
            "s.setProperty('--safe-area-inset-bottom', '%.2fpx'); " +
            "s.setProperty('--safe-area-inset-left', '%.2fpx'); " +
            "window.dispatchEvent(new Event('resize')); })();",
            cutoutInsets.top / density, cutoutInsets.right / density,
            cutoutInsets.bottom / density, cutoutInsets.left / density);
        bridge.getWebView().evaluateJavascript(script, null);
    }

    private void enterImmersiveMode() {
        configureFullscreenWindow();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
            getWindow(), getWindow().getDecorView()
        );
        // Android reveals the bars over the game on an edge swipe, then hides them automatically.
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
