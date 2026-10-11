import Foundation
import WidgetKit

// Inside the Blob app on iPhone and iPad (not the widget): when the site gives the widgets new data
// (set_widget in src-tauri/src/lib.rs writes it to the app group's settings), they are drawn again
// right away instead of at their next hourly look. main.mm calls blob_widget_setup() before the app
// starts (src-tauri/ios/add-widget.rb copies this file into the generated project and adds the call).

private final class WidgetReloader {
  static let shared = WidgetReloader()
  private var observer: NSObjectProtocol?
  private var last: String?

  func start() {
    guard observer == nil else { return }
    last = current()
    observer = NotificationCenter.default.addObserver(forName: UserDefaults.didChangeNotification, object: nil, queue: .main) { [weak self] _ in
      self?.changed()
    }
  }

  private func current() -> String? {
    UserDefaults(suiteName: "group.org.bojes.blob")?.string(forKey: "today")
  }

  private func changed() {
    let now = current()
    guard now != last else { return }
    last = now
    WidgetCenter.shared.reloadAllTimelines()
  }
}

@_cdecl("blob_widget_setup")
public func blobWidgetSetup() {
  if Thread.isMainThread {
    WidgetReloader.shared.start()
  } else {
    DispatchQueue.main.async { WidgetReloader.shared.start() }
  }
}
