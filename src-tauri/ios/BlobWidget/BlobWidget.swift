import SwiftUI
import WidgetKit

// Blob's widgets on iPhone and iPad: "Today" on the home screen (what's next, the streak, the cards
// to review) and on the lock screen (the next thing, the streak). The site works the data out (src/lib/widget)
// and the app keeps it in the app group's settings (set_widget in src-tauri/src/lib.rs), with the
// words in the account's language, so the widgets work while Blob isn't running. What has ended
// drops off on its own; a tap opens that day or task in Blob.
//
// The extension is added to the generated Xcode project by src-tauri/ios/add-widget.rb.

private let appGroup = "group.org.bojes.blob"

struct BlobData: Decodable {
  struct Item: Decodable, Hashable {
    /// Title, start and end (ms since 1970), all day, colour (light, dark), kind, link, place.
    let t: String
    let s: Double
    let e: Double
    let a: Bool
    let c: String
    let cd: String
    let k: String
    let l: String
    var p: String? = nil

    var start: Date { Date(timeIntervalSince1970: s / 1000) }
    var end: Date { Date(timeIntervalSince1970: e / 1000) }
    /// Under way at `date`: started, timed, not over.
    func running(at date: Date) -> Bool { !a && start <= date && end > date }
    /// Only the pages a row may open (anything else opens the calendar).
    var url: URL? {
      let allowed = l.range(of: "^/(calendar|tasks|notes|learn|home)(\\?[A-Za-z0-9=&_.:-]*)?$|^/p/[0-9a-fA-F-]{36}$", options: .regularExpression) != nil
      let path = allowed ? l : "/calendar"
      return URL(string: "org.bojes.blob://" + path.drop(while: { $0 == "/" }))
    }
  }

  struct Words: Decodable {
    let today: String
    let tomorrow: String
    let nothing: String
    let allDay: String
    let due: String
    let exam: String
    let next: String
    let streak: String
    let cards: String
    let more: String
    let open: String
    /// "Now", "until {t}", "in {t}" (newer data has them).
    var now: String? = nil
    var until: String? = nil
    var soon: String? = nil
  }

  let v: Int
  let locale: String
  let items: [Item]
  let streak: Int
  let practisedToday: Bool
  let cards: Int
  let w: Words

  static func load() -> BlobData? {
    guard let raw = UserDefaults(suiteName: appGroup)?.string(forKey: "today"), let json = raw.data(using: .utf8), !json.isEmpty else { return nil }
    guard let data = try? JSONDecoder().decode(BlobData.self, from: json), data.v == 1 else { return nil }
    return data
  }

  /// What's still to come at `date`.
  func upcoming(at date: Date) -> [Item] { items.filter { $0.end > date } }

  /// For the widget gallery.
  static var sample: BlobData {
    let day = Calendar.current.startOfDay(for: Date())
    func at(_ hour: Double) -> Double { (day.timeIntervalSince1970 + hour * 3600) * 1000 }
    let english = Locale.current.languageCode != "de"
    return BlobData(
      v: 1,
      locale: english ? "en" : "de",
      items: [
        Item(t: english ? "Biology" : "Biologie", s: at(8), e: at(9.5), a: false, c: "#3f78b3", cd: "#3f78b3", k: "event", l: "/calendar", p: "R 204"),
        Item(t: english ? "Choir" : "Chor", s: at(14.5), e: at(16), a: false, c: "#5d8a4c", cd: "#5d8a4c", k: "event", l: "/calendar"),
        Item(t: english ? "Maths worksheet p. 42" : "Mathe Arbeitsblatt S. 42", s: at(24), e: at(48), a: true, c: "#c4653e", cd: "#c4653e", k: "task", l: "/tasks"),
      ],
      streak: 5,
      practisedToday: false,
      cards: 12,
      w: english
        ? Words(today: "Today", tomorrow: "Tomorrow", nothing: "Nothing planned. Enjoy it!", allDay: "All day", due: "Due", exam: "Exam", next: "Next", streak: "day streak", cards: "cards to review", more: "+{n} more", open: "Open Blob to see your day", now: "Now", until: "until {t}", soon: "in {t}")
        : Words(today: "Heute", tomorrow: "Morgen", nothing: "Nichts geplant. Genieß es!", allDay: "Ganztägig", due: "Fällig", exam: "Prüfung", next: "Als Nächstes", streak: "Tage in Folge", cards: "Karten zum Wiederholen", more: "+{n} weitere", open: "Öffne Blob, um deinen Tag zu sehen", now: "Jetzt", until: "bis {t}", soon: "in {t}")
    )
  }
}

struct BlobEntry: TimelineEntry {
  let date: Date
  let data: BlobData?
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> BlobEntry {
    BlobEntry(date: Date(), data: .sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (BlobEntry) -> Void) {
    let data = BlobData.load()
    completion(BlobEntry(date: Date(), data: data ?? (context.isPreview ? .sample : nil)))
  }

  /// An entry now, an hour before something starts (the countdown), when it starts ("Now") and
  /// when it ends (it drops off), and at midnight (a new day). The app asks for a new timeline
  /// whenever the data changes; otherwise once an hour.
  func getTimeline(in context: Context, completion: @escaping (Timeline<BlobEntry>) -> Void) {
    let now = Date()
    let data = BlobData.load()
    let midnight = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: now)) ?? now.addingTimeInterval(86400)
    var dates: Set<Date> = [now, midnight]
    for item in data?.items ?? [] where item.end > now {
      for date in [item.start.addingTimeInterval(-3600), item.start, item.end] where date > now && date < midnight {
        dates.insert(date)
      }
    }
    let entries = dates.sorted().prefix(24).map { BlobEntry(date: $0, data: data) }
    completion(Timeline(entries: Array(entries), policy: .after(min(midnight, now.addingTimeInterval(3600)))))
  }
}

// MARK: - Looks

enum Palette {
  static func background(_ scheme: ColorScheme) -> Color { Color(hex: scheme == .dark ? "#1a1a18" : "#fdfcfa") }
  static func ink(_ scheme: ColorScheme) -> Color { Color(hex: scheme == .dark ? "#edebe4" : "#1c1b18") }
  static func ink3(_ scheme: ColorScheme) -> Color { Color(hex: scheme == .dark ? "#7d7b73" : "#8b8981") }
  static func accent(_ scheme: ColorScheme) -> Color { Color(hex: scheme == .dark ? "#b8a1ff" : "#6d3df5") }
  static func accentSoft(_ scheme: ColorScheme) -> Color { Color(hex: scheme == .dark ? "#272040" : "#efe9ff") }
}

extension Color {
  init(hex: String) {
    var value: UInt64 = 0
    Scanner(string: hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))).scanHexInt64(&value)
    self.init(red: Double((value >> 16) & 0xff) / 255, green: Double((value >> 8) & 0xff) / 255, blue: Double(value & 0xff) / 255)
  }
}

extension View {
  /// The widget's background (iOS 17 asks for it this way; before, the widget pads itself).
  @ViewBuilder func blobBackground(_ color: Color, pad: Bool) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget) { color }
    } else if pad {
      padding(16).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).background(color)
    } else {
      self
    }
  }
}

/// Blob himself, small: the purple drop with eyes.
struct BlobMark: View {
  var size: CGFloat = 16
  var body: some View {
    ZStack {
      Ellipse().fill(Color(hex: "#6d3df5")).frame(width: size, height: size * 0.98)
      HStack(spacing: size * 0.14) {
        eye
        eye
      }
      .offset(y: -size * 0.08)
    }
    .accessibilityHidden(true)
  }

  private var eye: some View {
    ZStack {
      Circle().fill(Color.white).frame(width: size * 0.3, height: size * 0.3)
      Circle().fill(Color(hex: "#1d1030")).frame(width: size * 0.15, height: size * 0.15).offset(x: size * 0.03, y: size * 0.03)
    }
  }
}

/// "08:00 – 09:30 · R 204", "Now · until 09:30", "Tomorrow · All day", "Due · Friday".
func subtitle(_ item: BlobData.Item, data: BlobData, now: Date) -> String {
  let cal = Calendar.current
  let time = DateFormatter()
  time.timeStyle = .short
  time.dateStyle = .none
  let place = (item.p ?? "").isEmpty ? "" : " · \(item.p ?? "")"
  if item.running(at: now) && item.k == "event" {
    let until = (data.w.until ?? "– {t}").replacingOccurrences(of: "{t}", with: time.string(from: item.end))
    return "\(data.w.now ?? "Now") · \(until)\(place)"
  }
  let today = cal.isDate(item.start, inSameDayAs: now) || item.start < now
  var day = ""
  if !today {
    if cal.isDateInTomorrow(item.start) {
      day = data.w.tomorrow
    } else {
      let weekday = DateFormatter()
      weekday.locale = Locale(identifier: data.locale)
      weekday.dateFormat = "EEEE"
      day = weekday.string(from: item.start)
    }
  }
  let prefix = item.k == "exam" ? data.w.exam : item.k == "task" ? data.w.due : ""
  let clock: String
  if item.a {
    clock = prefix.isEmpty ? data.w.allDay : ""
  } else if item.k == "event" {
    clock = "\(time.string(from: item.start)) – \(time.string(from: item.end))"
  } else {
    clock = time.string(from: item.start)
  }
  return [prefix, day, clock].filter { !$0.isEmpty }.joined(separator: " · ") + place
}

func headerDate(_ now: Date, locale: String) -> String {
  let f = DateFormatter()
  f.locale = Locale(identifier: locale)
  f.setLocalizedDateFormatFromTemplate("EEEdMMM")
  return f.string(from: now)
}

struct StreakPill: View {
  let streak: Int
  let scheme: ColorScheme
  var body: some View {
    HStack(spacing: 2) {
      Image(systemName: "flame.fill").font(.system(size: 10, weight: .bold))
      Text("\(streak)").font(.system(size: 12, weight: .bold, design: .rounded))
    }
    .foregroundColor(Palette.accent(scheme))
    .padding(.horizontal, 7)
    .padding(.vertical, 3)
    .background(Capsule().fill(Palette.accentSoft(scheme)))
  }
}

struct Row: View {
  let item: BlobData.Item
  let data: BlobData
  let now: Date
  let scheme: ColorScheme
  var body: some View {
    HStack(spacing: 8) {
      RoundedRectangle(cornerRadius: 2).fill(Color(hex: scheme == .dark ? item.cd : item.c)).frame(width: 4, height: 28)
      VStack(alignment: .leading, spacing: 1) {
        Text(item.t).font(.system(size: 13.5, weight: .semibold)).foregroundColor(Palette.ink(scheme)).lineLimit(1)
        Text(subtitle(item, data: data, now: now)).font(.system(size: 11.5)).foregroundColor(Palette.ink3(scheme)).lineLimit(1)
      }
      Spacer(minLength: 0)
    }
  }
}

struct Header: View {
  let data: BlobData
  let now: Date
  let scheme: ColorScheme
  var compact = false
  var body: some View {
    HStack(spacing: 6) {
      BlobMark(size: 17)
      Text(compact ? data.w.today : "\(data.w.today) · \(headerDate(now, locale: data.locale))")
        .font(.system(size: 13.5, weight: .bold))
        .foregroundColor(Palette.ink(scheme))
        .lineLimit(1)
      Spacer(minLength: 0)
      if data.streak > 0 { StreakPill(streak: data.streak, scheme: scheme) }
    }
  }
}

struct SignedOut: View {
  let scheme: ColorScheme
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      BlobMark(size: 22)
      Text(Locale.current.languageCode == "de" ? "Öffne Blob, um hier deinen Tag zu sehen." : "Open Blob to see your day here.")
        .font(.system(size: 13, weight: .medium))
        .foregroundColor(Palette.ink3(scheme))
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// Small: what's next, big.
struct SmallView: View {
  let entry: BlobEntry
  @Environment(\.colorScheme) private var scheme
  var body: some View {
    if let data = entry.data {
      let next = data.upcoming(at: entry.date).first
      VStack(alignment: .leading, spacing: 6) {
        Header(data: data, now: entry.date, scheme: scheme, compact: true)
        Spacer(minLength: 0)
        if let next = next {
          let running = next.running(at: entry.date)
          Text((running ? (data.w.now ?? data.w.next) : data.w.next).uppercased()).font(.system(size: 10, weight: .semibold)).foregroundColor(running ? Palette.accent(scheme) : Palette.ink3(scheme))
          HStack(alignment: .top, spacing: 7) {
            RoundedRectangle(cornerRadius: 2).fill(Color(hex: scheme == .dark ? next.cd : next.c)).frame(width: 4, height: 34)
            VStack(alignment: .leading, spacing: 2) {
              Text(next.t).font(.system(size: 15, weight: .bold)).foregroundColor(Palette.ink(scheme)).lineLimit(2)
              Text(subtitle(next, data: data, now: entry.date)).font(.system(size: 11.5)).foregroundColor(Palette.ink3(scheme)).lineLimit(1)
            }
          }
          NextLive(item: next, data: data, now: entry.date, scheme: scheme)
        } else {
          Text(data.w.nothing).font(.system(size: 13, weight: .medium)).foregroundColor(Palette.ink3(scheme))
        }
        if data.cards > 0 {
          Label("\(data.cards)", systemImage: "rectangle.stack").font(.system(size: 11, weight: .medium)).foregroundColor(Palette.ink3(scheme))
        }
      }
      .widgetURL(next?.url ?? URL(string: "org.bojes.blob://calendar"))
    } else {
      SignedOut(scheme: scheme)
    }
  }
}

/// Under what's next: how far through it is (live) while it runs, or a live countdown once it's
/// within the hour.
struct NextLive: View {
  let item: BlobData.Item
  let data: BlobData
  let now: Date
  let scheme: ColorScheme
  var body: some View {
    if item.running(at: now) {
      ProgressView(timerInterval: item.start...item.end, countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
        .progressViewStyle(.linear)
        .tint(Palette.accent(scheme))
    } else if !item.a && item.start.timeIntervalSince(now) <= 3600 {
      let parts = (data.w.soon ?? "in {t}").components(separatedBy: "{t}")
      (Text(parts.first ?? "") + Text(item.start, style: .timer) + Text(parts.count > 1 ? parts[1] : ""))
        .font(.system(size: 12.5, weight: .bold, design: .rounded))
        .foregroundColor(Palette.accent(scheme))
        .lineLimit(1)
    }
  }
}

/// Medium and large: the list.
struct ListView: View {
  let entry: BlobEntry
  let rows: Int
  @Environment(\.colorScheme) private var scheme
  var body: some View {
    if let data = entry.data {
      let items = data.upcoming(at: entry.date)
      VStack(alignment: .leading, spacing: 8) {
        Header(data: data, now: entry.date, scheme: scheme)
        if items.isEmpty {
          Text(data.w.nothing).font(.system(size: 13, weight: .medium)).foregroundColor(Palette.ink3(scheme))
        }
        ForEach(items.prefix(rows), id: \.self) { item in
          if let url = item.url {
            Link(destination: url) { Row(item: item, data: data, now: entry.date, scheme: scheme) }
          } else {
            Row(item: item, data: data, now: entry.date, scheme: scheme)
          }
        }
        Spacer(minLength: 0)
        HStack {
          if items.count > rows {
            Text(data.w.more.replacingOccurrences(of: "{n}", with: "\(items.count - rows)")).font(.system(size: 11.5)).foregroundColor(Palette.ink3(scheme))
          }
          Spacer(minLength: 0)
          if data.cards > 0 {
            Label("\(data.cards) \(data.w.cards)", systemImage: "rectangle.stack").font(.system(size: 11.5, weight: .medium)).foregroundColor(Palette.ink3(scheme)).lineLimit(1)
          }
        }
      }
    } else {
      SignedOut(scheme: scheme)
    }
  }
}

/// Lock screen, rectangular: the next two things.
struct LockRectangular: View {
  let entry: BlobEntry
  var body: some View {
    if let data = entry.data {
      let items = data.upcoming(at: entry.date)
      VStack(alignment: .leading, spacing: 1) {
        if items.isEmpty {
          Text(data.w.today).font(.headline)
          Text(data.w.nothing).font(.caption).foregroundColor(.secondary)
        }
        ForEach(items.prefix(2), id: \.self) { item in
          Text(item.t).font(.headline).lineLimit(1)
          Text(subtitle(item, data: data, now: entry.date)).font(.caption).foregroundColor(.secondary).lineLimit(1)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .widgetURL(items.first?.url ?? URL(string: "org.bojes.blob://calendar"))
    } else {
      Text("Blob").font(.headline)
    }
  }
}

/// Lock screen, round: the streak.
struct LockCircular: View {
  let entry: BlobEntry
  var body: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 0) {
        Image(systemName: "flame.fill").font(.system(size: 14, weight: .bold))
        Text("\(entry.data?.streak ?? 0)").font(.system(size: 17, weight: .bold, design: .rounded))
      }
    }
    .widgetURL(URL(string: "org.bojes.blob://learn"))
  }
}

/// Lock screen, one line above the clock.
struct LockInline: View {
  let entry: BlobEntry
  var body: some View {
    if let data = entry.data, let next = data.upcoming(at: entry.date).first {
      Text("\(Image(systemName: "calendar")) \(next.a ? "" : shortTime(next.start) + " ")\(next.t)")
    } else {
      Text("\(Image(systemName: "calendar")) Blob")
    }
  }

  private func shortTime(_ date: Date) -> String {
    let f = DateFormatter()
    f.timeStyle = .short
    f.dateStyle = .none
    return f.string(from: date)
  }
}

struct TodayView: View {
  let entry: BlobEntry
  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    switch family {
    case .accessoryCircular:
      LockCircular(entry: entry).blobBackground(.clear, pad: false)
    case .accessoryRectangular:
      LockRectangular(entry: entry).blobBackground(.clear, pad: false)
    case .accessoryInline:
      LockInline(entry: entry).blobBackground(.clear, pad: false)
    case .systemSmall:
      SmallView(entry: entry).blobBackground(Palette.background(scheme), pad: true)
    case .systemLarge:
      ListView(entry: entry, rows: 7).blobBackground(Palette.background(scheme), pad: true)
    default:
      ListView(entry: entry, rows: 3).blobBackground(Palette.background(scheme), pad: true)
    }
  }
}

struct TodayWidget: Widget {
  private static let german = Locale.current.languageCode == "de"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "BlobToday", provider: Provider()) { entry in
      TodayView(entry: entry)
    }
    .configurationDisplayName(Self.german ? "Heute in Blob" : "Today in Blob")
    .description(Self.german ? "Was ansteht: Termine, Hausaufgaben und Prüfungen, deine Serie und Karten zum Wiederholen." : "What's next: events, homework and exams, your streak and cards to review.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryCircular, .accessoryInline])
  }
}

@main
struct BlobWidgets: WidgetBundle {
  var body: some Widget {
    TodayWidget()
  }
}
