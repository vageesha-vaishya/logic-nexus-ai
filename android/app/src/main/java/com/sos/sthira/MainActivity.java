package com.sos.sthira;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // The Capacitor WebView defaults to setUseWideViewPort(true), which
        // makes `window.innerWidth` report ~1023 even on phones with a
        // ~400-CSS-px viewport. That breaks every responsive breakpoint
        // (useIsMobile / matchMedia / Tailwind's `md:` etc.) and forces
        // the desktop layout onto the phone. Disable wide-viewport so
        // the meta `width=device-width` actually wins.
        if (getBridge() != null && getBridge().getWebView() != null) {
            android.webkit.WebSettings settings =
                getBridge().getWebView().getSettings();
            settings.setUseWideViewPort(false);
            settings.setLoadWithOverviewMode(false);
        }
    }
}
