package com.zippygo.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Ignora el tamaño de letra/pantalla que el usuario tenga configurado
        // en accesibilidad de Android, para que la app siempre se vea igual
        // (sin botones ni textos gigantes que rompan el diseño) sin importar
        // el ajuste del teléfono.
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().getSettings().setTextZoom(100);
        }
    }
}
