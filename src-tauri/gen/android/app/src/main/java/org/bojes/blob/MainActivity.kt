package org.bojes.blob

import android.content.Context
import android.os.Bundle
import android.print.PrintAttributes
import android.print.PrintManager
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

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
  }

  override fun onWebViewCreate(webView: WebView) {
    // window.BlobAndroid.print(): the system print dialog for the page, with "Save as PDF" (the CV).
    webView.addJavascriptInterface(PrintBridge(this, webView), "BlobAndroid")
  }
}

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
