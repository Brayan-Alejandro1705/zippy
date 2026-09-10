package com.zippygo.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();

            // Ignora el tamaño de letra que el usuario tenga configurado en
            // accesibilidad de Android, para que la app siempre se vea igual
            // sin importar el ajuste del teléfono.
            webView.getSettings().setTextZoom(100);

            // Obliga al WebView a usar el ancho real de la pantalla (el que
            // dice la etiqueta <meta name="viewport">) en vez de asumir un
            // ancho de escritorio, que es lo que causaba que la mitad de la
            // pantalla se viera en blanco en algunos teléfonos.
            webView.getSettings().setUseWideViewPort(true);
            webView.getSettings().setLoadWithOverviewMode(true);
        }
    }
}
