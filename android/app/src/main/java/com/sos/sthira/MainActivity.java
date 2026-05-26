package com.sos.sthira;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Honour the `width=device-width, initial-scale=1, viewport-fit=cover`
        // meta in index.html so the page lays out at the real device CSS
        // width instead of Android's legacy 980-px default. Both flags must
        // be true: setUseWideViewPort(true) tells the WebView to read the
        // viewport meta, setLoadWithOverviewMode(true) lets it scale to fit
        // when no scale is pinned. A prior revision set both to false to
        // "fix" innerWidth reporting ~1023 — that was the wrong knob; the
        // actual cause was a missing/incomplete viewport meta, which is now
        // in place. Setting them to false made the WebView render the page
        // at 980 CSS-px on a ~412 CSS-px screen, leaving a ~23% blank strip
        // on the right edge (reported 2026-05-26 on the Sthira APK).
        if (getBridge() != null && getBridge().getWebView() != null) {
            android.webkit.WebSettings settings =
                getBridge().getWebView().getSettings();
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(true);
        }
    }
}
