package ru.mayak.lastlight;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

/**
 * Оболочка для RuStore: игра (assets/index.html) открывается во встроенном WebView
 * по адресу https://appassets.androidplatform.net — так работают сохранения (localStorage) и звук.
 * Интернет не нужен.
 */
public class MainActivity extends Activity {
    private static final String GAME_URL = "https://appassets.androidplatform.net/assets/index.html";
    private WebView web;
    private RuStorePay pay;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }

        web = new WebView(this);
        web.setBackgroundColor(0xFF0B0A14);
        setContentView(web);
        hideSystemBars();

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100); // крупный системный шрифт не должен ломать интерфейс игры

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("appassets.androidplatform.net".equals(uri.getHost())) return false;
                // внешние ссылки — в браузере телефона
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }
        });
        pay = new RuStorePay(this, code -> {
            js(code);
            return kotlin.Unit.INSTANCE;
        });
        web.addJavascriptInterface(new Bridge(), "LLAndroid");

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else {
            web.loadUrl(GAME_URL);
            pay.onIntent(getIntent());
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (pay != null) pay.onIntent(intent);
    }

    /** Методы, доступные игре как window.LLAndroid. */
    private class Bridge {
        @JavascriptInterface
        public void exit() {
            runOnUiThread(MainActivity.this::finish);
        }

        @JavascriptInterface
        public String platform() {
            return "rustore";
        }

        // ---- платежи RuStore (ответы приходят в window.__LL_pay) ----

        @JavascriptInterface
        public boolean payConfigured() {
            return pay != null && pay.getConfigured();
        }

        @JavascriptInterface
        public void payInit(String idsCsv) {
            runOnUiThread(() -> pay.init(java.util.Arrays.asList(idsCsv.split(","))));
        }

        @JavascriptInterface
        public void payBuy(String productId) {
            runOnUiThread(() -> pay.buy(productId));
        }

        @JavascriptInterface
        public void payRestore() {
            runOnUiThread(() -> pay.restore());
        }

        @JavascriptInterface
        public void payConfirm(String purchaseId) {
            runOnUiThread(() -> pay.confirm(purchaseId));
        }
    }

    private void js(String code) {
        if (web != null) web.evaluateJavascript(code, null);
    }

    @Override
    public void onBackPressed() {
        // игра сама решает: закрыть окно, отменить стройку или открыть паузу (с кнопкой «Выйти»)
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript("(window.__LL_app && window.__LL_app.back()) ? 1 : 0", value -> {
            if (!"1".equals(value)) finish();
        });
    }

    @Override
    protected void onPause() {
        js("window.__LL_app && window.__LL_app.pause()");
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemBars();
        if (web != null) web.onResume();
        js("window.__LL_app && window.__LL_app.resume()");
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** Полноэкранный режим: панели скрыты, появляются свайпом от края. */
    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }
}
