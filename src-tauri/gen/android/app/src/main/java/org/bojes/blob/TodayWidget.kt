package org.bojes.blob

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.text.format.DateFormat
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * The "Today" home screen widget: what's next in Blob (events, due homework, exams), the learning
 * streak and the cards to review. The site hands over its data through window.BlobAndroid
 * (MainActivity.kt; src/lib/widget on the site), with the words in the account's language, and it
 * is kept here, so the widget works while Blob isn't running. It is drawn again whenever new data
 * comes and every half hour (and with "Next up", NextWidget.kt, at the moments things start and
 * end), leaving out what has ended. A tap opens that day or task in Blob.
 */
class TodayWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) draw(context, manager, id)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    draw(context, manager, id)
  }

  internal class Item(val title: String, val start: Long, val end: Long, val allDay: Boolean, val color: Int, val kind: String, val link: String, val place: String) {
    /** Under way: started, timed, not over. */
    fun running(now: Long) = !allDay && start <= now && end > now
  }

  companion object {
    private const val PREFS = "blob_widget"
    private const val KEY = "today"
    private const val MAX_JSON = 64 * 1024
    /** The pages a row may open (anything else opens the calendar). */
    private val LINKS = Regex("^/(calendar|tasks|notes|learn|home)(\\?[A-Za-z0-9=&_.:-]*)?$|^/p/[0-9a-fA-F-]{36}$")

    private val ROWS = arrayOf(
      intArrayOf(R.id.widget_row1, R.id.widget_bar1, R.id.widget_title1, R.id.widget_time1),
      intArrayOf(R.id.widget_row2, R.id.widget_bar2, R.id.widget_title2, R.id.widget_time2),
      intArrayOf(R.id.widget_row3, R.id.widget_bar3, R.id.widget_title3, R.id.widget_time3),
      intArrayOf(R.id.widget_row4, R.id.widget_bar4, R.id.widget_title4, R.id.widget_time4),
    )

    /** New data from the site ("" after signing out): both widgets are drawn again. */
    fun save(context: Context, json: String) {
      if (json.length > MAX_JSON) return
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply()
      drawAll(context)
      NextWidget.drawAll(context)
    }

    fun drawAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      for (id in manager.getAppWidgetIds(ComponentName(context, TodayWidget::class.java))) draw(context, manager, id)
    }

    private fun draw(context: Context, manager: AppWidgetManager, id: Int) {
      val views = RemoteViews(context.packageName, R.layout.widget_today)
      views.setOnClickPendingIntent(R.id.widget_root, open(context, "calendar", id * 8))
      val data = read(context)
      if (data == null) {
        views.setTextViewText(R.id.widget_day, context.getString(R.string.app_name))
        views.setTextViewText(R.id.widget_empty, context.getString(R.string.widget_open))
        views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
        manager.updateAppWidget(id, views)
        return
      }

      val now = System.currentTimeMillis()
      val words = data.optJSONObject("w") ?: JSONObject()
      fun word(key: String) = words.optString(key, "")
      val locale = Locale.forLanguageTag(data.optString("locale", "en"))
      val night = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
      val items = items(data, night).filter { it.end > now }

      // Header: "Today · Sun 11 Oct", and the streak.
      val date = SimpleDateFormat(DateFormat.getBestDateTimePattern(locale, "EEEdMMM"), locale).format(Date(now))
      views.setTextViewText(R.id.widget_day, "${word("today")} · $date")
      val streak = data.optInt("streak", 0)
      if (streak > 0) {
        views.setViewVisibility(R.id.widget_streak, View.VISIBLE)
        views.setTextViewText(R.id.widget_streak_text, streak.toString())
        views.setContentDescription(R.id.widget_streak, "$streak ${word("streak")}")
      }

      // Footer: the cards to review today.
      val cards = data.optInt("cards", 0)
      if (cards > 0) {
        views.setViewVisibility(R.id.widget_cards, View.VISIBLE)
        views.setTextViewText(R.id.widget_cards_text, "$cards ${word("cards")}")
        views.setOnClickPendingIntent(R.id.widget_cards, open(context, "notes", id * 8 + 6))
      }

      // As many rows as fit the widget's height.
      val options = manager.getAppWidgetOptions(id)
      val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0).takeIf { it > 0 } ?: 180
      val room = height - 50 - (if (cards > 0) 22 else 0)
      var rows = (room / 42).coerceIn(1, ROWS.size)
      if (items.size > rows && rows > 1 && room - rows * 42 < 18) rows -= 1

      if (items.isEmpty()) {
        views.setTextViewText(R.id.widget_empty, word("nothing"))
        views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
      }
      val time = DateFormat.getTimeFormat(context)
      for ((i, item) in items.take(rows).withIndex()) {
        val (row, bar, title, sub) = ROWS[i]
        views.setViewVisibility(row, View.VISIBLE)
        views.setInt(bar, "setColorFilter", item.color)
        views.setTextViewText(title, item.title)
        views.setTextViewText(sub, subtitle(item, now, words, locale, time))
        views.setOnClickPendingIntent(row, open(context, item.link, id * 8 + 1 + i))
      }
      if (items.size > rows) {
        views.setViewVisibility(R.id.widget_more, View.VISIBLE)
        views.setTextViewText(R.id.widget_more, word("more").replace("{n}", (items.size - rows).toString()))
      }
      manager.updateAppWidget(id, views)
    }

    internal fun read(context: Context): JSONObject? {
      val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
      if (raw.isNullOrEmpty()) return null
      return try {
        JSONObject(raw).takeIf { it.optInt("v") == 1 }
      } catch (e: Exception) {
        null
      }
    }

    internal fun items(data: JSONObject, night: Boolean): List<Item> {
      val list = data.optJSONArray("items") ?: return emptyList()
      val out = ArrayList<Item>()
      for (i in 0 until list.length()) {
        val o = list.optJSONObject(i) ?: continue
        val color = try {
          Color.parseColor(o.optString(if (night) "cd" else "c", "#6d3df5"))
        } catch (e: IllegalArgumentException) {
          Color.parseColor("#6d3df5")
        }
        val link = o.optString("l", "/calendar").takeIf { LINKS.matches(it) } ?: "/calendar"
        out.add(Item(o.optString("t"), o.optLong("s"), o.optLong("e"), o.optBoolean("a"), color, o.optString("k", "event"), link, o.optString("p", "").take(60)))
      }
      return out
    }

    /** "08:00 – 09:30 · R 204", "Now · until 09:30", "Tomorrow · All day", "Due 14:00", "Exam · Friday". */
    internal fun subtitle(item: Item, now: Long, words: JSONObject, locale: Locale, time: java.text.DateFormat): String {
      val place = if (item.place.isNotEmpty()) " · ${item.place}" else ""
      if (item.running(now) && item.kind == "event") {
        val until = words.optString("until", "").ifEmpty { "– {t}" }.replace("{t}", time.format(Date(item.end)))
        return "${words.optString("now", "").ifEmpty { "Now" }} · $until$place"
      }
      val day = dayLabel(item.start, now, words, locale)
      val today = daysBetween(now, item.start) <= 0
      val prefix = when (item.kind) {
        "exam" -> words.optString("exam")
        "task" -> words.optString("due")
        else -> ""
      }
      val clock = when {
        item.allDay -> if (prefix.isEmpty()) words.optString("allDay") else ""
        item.kind == "event" -> "${time.format(Date(item.start))} – ${time.format(Date(item.end))}"
        else -> time.format(Date(item.start))
      }
      return listOf(prefix, if (today) "" else day, clock).filter { it.isNotEmpty() }.joinToString(" · ") + place
    }

    internal fun daysBetween(from: Long, to: Long): Int {
      val a = Calendar.getInstance().apply { timeInMillis = from; set(Calendar.HOUR_OF_DAY, 12); set(Calendar.MINUTE, 0) }
      val b = Calendar.getInstance().apply { timeInMillis = to; set(Calendar.HOUR_OF_DAY, 12); set(Calendar.MINUTE, 0) }
      return Math.round((b.timeInMillis - a.timeInMillis) / 86_400_000.0).toInt()
    }

    internal fun dayLabel(at: Long, now: Long, words: JSONObject, locale: Locale): String =
      when (daysBetween(now, at)) {
        0 -> words.optString("today")
        1 -> words.optString("tomorrow")
        else -> SimpleDateFormat("EEEE", locale).format(Date(at))
      }

    /** Blob at that page (org.bojes.blob://calendar?date=…, which the app opens like any app link). */
    internal fun open(context: Context, path: String, code: Int): PendingIntent {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse("org.bojes.blob://" + path.trimStart('/')), context, MainActivity::class.java)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      return PendingIntent.getActivity(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
  }
}
