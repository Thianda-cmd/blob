package org.bojes.blob

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.os.SystemClock
import android.text.format.DateFormat
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.util.Date
import java.util.Locale

/**
 * The "Next up" home screen widget: one thing, big. What's on now (with how far through it is,
 * "until 09:30") or what comes next (a live countdown once it's within the hour, else its day and
 * time), with its room, and the learning streak. Same data as the Today widget (TodayWidget.kt).
 * It wakes itself at the moments it changes (an hour before, at the start, at the end, and every
 * few minutes while something runs), so the countdown and the progress stay right.
 */
class NextWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) draw(context, manager, id)
    schedule(context)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    draw(context, manager, id)
  }

  override fun onDisabled(context: Context) {
    context.getSystemService(AlarmManager::class.java)?.cancel(refresh(context))
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == REFRESH) {
      // The moment came: both widgets show what's true now.
      TodayWidget.drawAll(context)
      drawAll(context)
      return
    }
    super.onReceive(context, intent)
  }

  companion object {
    private const val REFRESH = "org.bojes.blob.widget.REFRESH"
    private const val HOUR = 3_600_000L
    private const val RUNNING_TICK = 5 * 60_000L

    fun drawAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, NextWidget::class.java))
      for (id in ids) draw(context, manager, id)
      if (ids.isNotEmpty()) schedule(context)
    }

    /** What the widget shows: what runs now, else the next timed thing today, else the next thing. */
    private fun pick(items: List<TodayWidget.Item>, now: Long): TodayWidget.Item? {
      items.firstOrNull { it.running(now) }?.let { return it }
      val timed = items.firstOrNull { !it.allDay && it.start > now }
      if (timed != null && TodayWidget.daysBetween(now, timed.start) <= 0) return timed
      return items.firstOrNull()
    }

    private fun draw(context: Context, manager: AppWidgetManager, id: Int) {
      val views = RemoteViews(context.packageName, R.layout.widget_next)
      views.setOnClickPendingIntent(R.id.next_root, TodayWidget.open(context, "calendar", 9000 + id))
      val data = TodayWidget.read(context)
      if (data == null) {
        views.setTextViewText(R.id.next_label, context.getString(R.string.app_name))
        views.setTextViewText(R.id.next_empty, context.getString(R.string.widget_open))
        views.setViewVisibility(R.id.next_empty, View.VISIBLE)
        views.setViewVisibility(R.id.next_item, View.GONE)
        manager.updateAppWidget(id, views)
        return
      }

      val now = System.currentTimeMillis()
      val words = data.optJSONObject("w") ?: JSONObject()
      fun word(key: String, fallback: String) = words.optString(key, "").ifEmpty { fallback }
      val locale = Locale.forLanguageTag(data.optString("locale", "en"))
      val night = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
      val time = DateFormat.getTimeFormat(context)

      val streak = data.optInt("streak", 0)
      if (streak > 0) {
        views.setViewVisibility(R.id.next_streak, View.VISIBLE)
        views.setTextViewText(R.id.next_streak_text, streak.toString())
        views.setContentDescription(R.id.next_streak, "$streak ${word("streak", "")}")
      }

      val item = pick(TodayWidget.items(data, night).filter { it.end > now }, now)
      if (item == null) {
        views.setTextViewText(R.id.next_label, word("today", "Today"))
        val cards = data.optInt("cards", 0)
        views.setTextViewText(R.id.next_empty, if (cards > 0) "${word("nothing", "")}\n$cards ${word("cards", "")}" else word("nothing", ""))
        views.setViewVisibility(R.id.next_empty, View.VISIBLE)
        views.setViewVisibility(R.id.next_item, View.GONE)
        manager.updateAppWidget(id, views)
        return
      }

      val running = item.running(now)
      views.setTextViewText(R.id.next_label, if (running) word("now", "Now") else word("next", "Next"))
      views.setInt(R.id.next_bar, "setColorFilter", item.color)
      views.setTextViewText(R.id.next_title, item.title)
      val where = listOfNotNull(
        if (item.allDay || item.kind != "event") null else "${time.format(Date(item.start))} – ${time.format(Date(item.end))}",
        item.place.ifEmpty { null },
      ).joinToString(" · ")
      views.setTextViewText(R.id.next_sub, where)
      views.setViewVisibility(R.id.next_sub, if (where.isEmpty()) View.GONE else View.VISIBLE)
      views.setOnClickPendingIntent(R.id.next_item, TodayWidget.open(context, item.link, 9500 + id))

      when {
        running -> {
          // How far through it is, and until when.
          val span = (item.end - item.start).coerceAtLeast(1)
          views.setViewVisibility(R.id.next_progress, View.VISIBLE)
          views.setProgressBar(R.id.next_progress, 1000, (((now - item.start) * 1000) / span).toInt().coerceIn(0, 1000), false)
          views.setTextViewText(R.id.next_when, word("until", "– {t}").replace("{t}", time.format(Date(item.end))))
        }
        !item.allDay && item.start - now <= HOUR -> {
          // Within the hour: counting down, live.
          views.setViewVisibility(R.id.next_when, View.GONE)
          views.setViewVisibility(R.id.next_timer, View.VISIBLE)
          views.setChronometer(R.id.next_timer, SystemClock.elapsedRealtime() + (item.start - now), word("soon", "in {t}").replace("{t}", "%s"), true)
          views.setChronometerCountDown(R.id.next_timer, true)
        }
        else -> {
          val days = TodayWidget.daysBetween(now, item.start)
          val day = if (days <= 0) word("today", "Today") else TodayWidget.dayLabel(item.start, now, words, locale)
          val prefix = when (item.kind) {
            "exam" -> word("exam", "")
            "task" -> word("due", "")
            else -> ""
          }
          val clock = if (item.allDay) (if (prefix.isEmpty()) word("allDay", "") else "") else time.format(Date(item.start))
          views.setTextViewText(R.id.next_when, listOf(prefix, day, clock).filter { it.isNotEmpty() }.joinToString(" · "))
        }
      }
      manager.updateAppWidget(id, views)
    }

    /** Wakes the widgets at the next moment something on them changes. */
    private fun schedule(context: Context) {
      val alarms = context.getSystemService(AlarmManager::class.java) ?: return
      val data = TodayWidget.read(context) ?: return alarms.cancel(refresh(context))
      val now = System.currentTimeMillis()
      val items = TodayWidget.items(data, false).filter { it.end > now }
      var next = Long.MAX_VALUE
      for (item in items) {
        if (item.allDay) {
          next = minOf(next, item.end)
          continue
        }
        for (t in longArrayOf(item.start - HOUR, item.start, item.end)) if (t > now + 1000) next = minOf(next, t)
        if (item.running(now)) next = minOf(next, now + RUNNING_TICK)
      }
      if (next == Long.MAX_VALUE) return alarms.cancel(refresh(context))
      // Not exact (no special permission needed); a minute late at most, usually.
      alarms.set(AlarmManager.RTC, next, refresh(context))
    }

    private fun refresh(context: Context): PendingIntent {
      val intent = Intent(context, NextWidget::class.java).setAction(REFRESH)
      return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
  }
}
