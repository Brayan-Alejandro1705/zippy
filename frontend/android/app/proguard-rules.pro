# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ── Reglas para Capacitor (WebView + plugins nativos) ───────────────────
# Sin esto, R8 puede eliminar u ofuscar clases que Capacitor invoca por
# reflexion desde JS, rompiendo el bridge o los plugins en tiempo de
# ejecucion sin que el build falle en tiempo de compilacion.
-keep class com.getcapacitor.** { *; }
-keep class com.zippygo.app.** { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.PluginMethod public *;
}
-keepattributes *Annotation*
-keepattributes JavascriptInterface

# ── Firebase Cloud Messaging (@capacitor/push-notifications) ───────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── Google Maps (se usa la API key en el frontend) ──────────────────────
-keep class com.google.android.gms.maps.** { *; }
