package org.bojes.blob

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.print.PrintAttributes
import android.print.PrintManager
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // The site gets exactly the space between the status bar, the navigation bar, the camera cut-out
    // and the keyboard (the page itself knows nothing about them). Behind the bars the window shows
    // the page colour (windowBackground in themes.xml).
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
      view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, keyboard.bottom))
      WindowInsetsCompat.CONSUMED
    }
    pinForTest(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    pinForTest(intent)
  }

  /**
   * Debug builds only (the emulator test, src-tauri/tests/e2e/android.mjs): `--es pin_widget today`
   * or `next` asks the home screen to add that widget, for screenshots of it where it lives.
   */
  private fun pinForTest(intent: Intent?) {
    if (!BuildConfig.DEBUG) return
    val which = intent?.getStringExtra("pin_widget") ?: return
    val manager = AppWidgetManager.getInstance(this)
    if (!manager.isRequestPinAppWidgetSupported) return
    val provider = ComponentName(this, if (which == "next") NextWidget::class.java else TodayWidget::class.java)
    manager.requestPinAppWidget(provider, null, null)
  }

  override fun onWebViewCreate(webView: WebView) {
    // window.BlobAndroid.print(): the system print dialog for the page, with "Save as PDF" (the CV).
    webView.addJavascriptInterface(PrintBridge(this, webView), "BlobAndroid")
    // window.BlobWidget.postMessage(json): the home screen widget's data (TodayWidget.kt). Only the
    // site's own pages get it (not frames of other sites, such as file previews).
    if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
      WebViewCompat.addWebMessageListener(webView, "BlobWidget", setOf(SITE)) { _, message, _, isMainFrame, _ ->
        if (isMainFrame) TodayWidget.save(applicationContext, message.data ?: "")
      }
    }
    // Back (button or swipe) goes back a page; on the first page it puts Blob in the background, as
    // Android does for apps opened from the home screen, instead of closing it. The app keeps its
    // place, and a link or the icon brings it straight back.
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        if (webView.canGoBack()) webView.goBack() else moveTaskToBack(true)
      }
    })
  }
}

/** The site the app shows (src-tauri/src/lib.rs SITE). */
private const val SITE = "https://blob.bojes.org"

private class PrintBridge(private val activity: MainActivity, private val webView: WebView) {
  @JavascriptInterface
  fun print() {
    activity.runOnUiThread {
      val manager = activity.getSystemService(Context.PRINT_SERVICE) as PrintManager
      val title = webView.title?.takeIf { it.isNotBlank() } ?: "Blob"
      manager.print(title, webView.createPrintDocumentAdapter(title), PrintAttributes.Builder().build())
    }
  }
}
