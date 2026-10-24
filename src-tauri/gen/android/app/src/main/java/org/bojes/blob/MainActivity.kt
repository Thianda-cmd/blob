package org.bojes.blob

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
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
import java.io.ByteArrayOutputStream
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : TauriActivity() {
  /** Blob files opened with the app that the site hasn't taken yet (only touched on the UI thread). */
  private val openedFiles = mutableListOf<JSONObject>()
  private var webView: WebView? = null

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
    takeFiles(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    pinForTest(intent)
    takeFiles(intent)
  }

  /**
   * Blob files (.blob) opened with the app: "Open with" in Files or Downloads, or shared to it. They
   * are read in the background (they can be big) and kept for the site, which takes them through
   * window.BlobFiles and imports them (src/components/notes/useOpenedFiles.ts).
   */
  @Suppress("DEPRECATION")
  private fun takeFiles(intent: Intent?) {
    if (intent == null) return
    val uris: List<Uri> = when (intent.action) {
      Intent.ACTION_VIEW -> listOfNotNull(intent.data)
      Intent.ACTION_SEND -> listOfNotNull(intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM))
      Intent.ACTION_SEND_MULTIPLE -> intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM) ?: emptyList()
      else -> emptyList()
    }.filter { it.scheme == "content" || it.scheme == "file" }
    if (uris.isEmpty()) return
    Thread {
      val read = uris.mapNotNull { readBlobFile(it) }
      if (read.isNotEmpty()) runOnUiThread {
        openedFiles.addAll(read)
        webView?.evaluateJavascript("window.dispatchEvent(new Event('blob-opened-files'))", null)
      }
    }.start()
  }

  /** A Blob file's name and text, or null for another kind of file, one that's too big or unreadable. */
  private fun readBlobFile(uri: Uri): JSONObject? = try {
    val name = contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
      if (c.moveToFirst()) c.getString(0) else null
    } ?: uri.lastPathSegment ?: "Blob.blob"
    if (!name.endsWith(".blob", ignoreCase = true) && contentResolver.getType(uri) != BLOB_MIME) {
      null
    } else {
      contentResolver.openInputStream(uri)?.use { input ->
        val out = ByteArrayOutputStream()
        val buffer = ByteArray(64 * 1024)
        var total = 0L
        while (true) {
          val n = input.read(buffer)
          if (n < 0) break
          total += n
          if (total > MAX_OPENED_BYTES) return null
          out.write(buffer, 0, n)
        }
        JSONObject().put("name", name).put("text", out.toString("UTF-8"))
      }
    }
  } catch (e: Exception) {
    null
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
    this.webView = webView
    // window.BlobAndroid.print(): the system print dialog for the page, with "Save as PDF" (the CV).
    webView.addJavascriptInterface(PrintBridge(this, webView), "BlobAndroid")
    // window.BlobWidget.postMessage(json): the home screen widget's data (TodayWidget.kt). Only the
    // site's own pages get it (not frames of other sites, such as file previews).
    if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
      WebViewCompat.addWebMessageListener(webView, "BlobWidget", setOf(SITE)) { _, message, _, isMainFrame, _ ->
        if (isMainFrame) TodayWidget.save(applicationContext, message.data ?: "")
      }
      // window.BlobFiles.postMessage("take"): the Blob files opened with the app, as JSON
      // ([{ name, text }]), for the site's own pages only.
      WebViewCompat.addWebMessageListener(webView, "BlobFiles", setOf(SITE)) { _, message, _, isMainFrame, reply ->
        if (isMainFrame && message.data == "take") {
          val files = JSONArray(openedFiles.toList())
          openedFiles.clear()
          reply.postMessage(files.toString())
        }
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

/** Blob files (src/notes/blobFile.ts): their type, and how big a file the app reads. */
private const val BLOB_MIME = "application/vnd.blob+json"
private const val MAX_OPENED_BYTES = 100L * 1024 * 1024

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
