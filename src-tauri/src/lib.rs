//! Blob as a desktop and phone app: a native window around the website (blob.bojes.org).
//!
//! The site is server-rendered (Supabase sessions, server actions), so the app doesn't bundle it.
//! It starts on a small local page (`shell/index.html`: Blob, and a friendly screen when there's
//! no internet) that moves on to the site. What the app adds around the site:
//!
//! - links to other sites open in the system browser, never inside the app window;
//! - `org.bojes.blob://…` links open the app at that page (e.g. "Open in the app" on the sign-in
//!   confirmation page);
//! - pop-up windows of the site (the presenter's speaker view) become app windows;
//! - downloads land in the Downloads folder; printing works where the webview can't do it alone;
//! - Blob files (.blob) open with the app: double-click, "Open with", or dropped on its icon; the
//!   site imports them (`take_opened_files`);
//! - one running app at a time (a second start focuses the first), and it remembers its window.
//!
//! The site may call only the commands in capabilities/site.json (`open_external`, `print_page`,
//! `app_info`, `set_offline_ready`, `take_opened_files`, and the notification plugin's). The start
//! page may call `start_target` and `offline_ready`. Nothing else of the native side is reachable
//! from web pages.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use serde::Serialize;
use tauri::webview::{DownloadEvent, PageLoadEvent};
use tauri::{AppHandle, Manager, Runtime, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;

/// Updates for the desktop apps (GitHub releases).
#[cfg(desktop)]
mod update;

#[cfg(desktop)]
use std::sync::atomic::AtomicU32;
#[cfg(desktop)]
use tauri::webview::NewWindowResponse;

/// The website the app shows.
const SITE: &str = "https://blob.bojes.org";

/// The app's link scheme. Not "blob": browsers keep blob: URLs to themselves.
const LINK_SCHEME: &str = "org.bojes.blob";

/// Where the site's files live (Supabase Storage). Its file previews are iframes, and macOS and Linux
/// ask the navigation rule about frames too, so signed links to the files bucket must load in the app.
const FILES_HOST: &str = "nrxywlbbbafpyukcbruy.supabase.co";
const FILES_PATH: &str = "/storage/v1/object/sign/files/";

/// Pages an app link may open (the start of the path). Everything else lands on the home page.
const LINK_PATHS: &[&str] = &["auth/confirm", "auth/app", "home", "learn", "study", "join", "p/", "notes", "projects", "cv", "blob", "show", "calendar", "tasks", "settings"];

/// The site, or in debug builds `BLOB_SITE` (e.g. http://localhost:3000 next to `next dev`).
fn site() -> Url {
  let from_env = if cfg!(debug_assertions) { std::env::var("BLOB_SITE").ok() } else { None };
  from_env.and_then(|s| Url::parse(&s).ok()).unwrap_or_else(|| Url::parse(SITE).expect("SITE is a URL"))
}

/// Whether a URL belongs to the site (same scheme, host and port).
fn is_site(url: &Url) -> bool {
  let site = site();
  url.scheme() == site.scheme() && url.host_str() == site.host_str() && url.port_or_known_default() == site.port_or_known_default()
}

/// The app's own start page: tauri://localhost (macOS, Linux, iOS) or http://tauri.localhost
/// (Windows, Android). Nothing else counts, not even that address on another platform or port.
fn is_start_page(url: &Url) -> bool {
  if cfg!(any(windows, target_os = "android")) {
    matches!(url.scheme(), "http" | "https") && url.host_str() == Some("tauri.localhost") && url.port().is_none()
  } else {
    url.scheme() == "tauri" && url.host_str() == Some("localhost")
  }
}

/// Pages that may show in the app besides the site: the start page, about:blank, and files the site
/// made itself (blob:https://blob.bojes.org/…).
fn is_local(url: &Url) -> bool {
  match url.scheme() {
    "about" => url.path() == "blank",
    "blob" => Url::parse(url.path()).is_ok_and(|inner| is_site(&inner)),
    _ => is_start_page(url),
  }
}

/// A signed link to a file of the site (previews in frames).
fn is_files(url: &Url) -> bool {
  url.scheme() == "https" && url.host_str() == Some(FILES_HOST) && url.port().is_none() && url.path().starts_with(FILES_PATH)
}

/// Opens a URL in the system browser (or mail or phone app). Only web, mail and phone links: no
/// files, no other apps.
fn open_outside<R: Runtime>(app: &AppHandle<R>, url: &Url) {
  if matches!(url.scheme(), "http" | "https" | "mailto" | "tel") {
    if let Err(e) = app.opener().open_url(url.as_str(), None::<&str>) {
      eprintln!("blob: couldn't open {url}: {e}");
    }
  }
}

/// The page of the site an app link points to.
///
/// `org.bojes.blob://auth/confirm?token_hash=…` and `https://blob.bojes.org/auth/confirm?token_hash=…`
/// both become `https://blob.bojes.org/auth/confirm?token_hash=…`. Unknown pages become the home page.
fn link_target(link: &Url) -> Option<Url> {
  let path = if link.scheme() == LINK_SCHEME {
    // org.bojes.blob://auth/confirm → "auth/confirm" (the "host" is the first part of the path).
    format!("{}{}", link.host_str().unwrap_or(""), link.path())
  } else if link.scheme() == "https" && is_site(link) {
    link.path().trim_start_matches('/').to_string()
  } else {
    return None;
  };
  let path = path.trim_matches('/');
  // No tricks with the path: plain segments only.
  let clean = !path.split('/').any(|seg| seg == ".." || seg == "." || seg.contains('\\') || seg.contains('%'));
  let known = LINK_PATHS.iter().any(|p| path == p.trim_end_matches('/') || path.starts_with(&format!("{}/", p.trim_end_matches('/'))));
  let mut target = site();
  if clean && known {
    target.set_path(&format!("/{path}"));
    target.set_query(link.query());
  } else {
    target.set_path("/home");
  }
  Some(target)
}

/// A page from a link that arrived while the app was still starting: the start page goes there
/// (`start_target`) instead of the home page.
#[derive(Default)]
struct Pending(Mutex<Option<Url>>);

impl Pending {
  fn set(&self, url: Url) {
    *self.0.lock().unwrap_or_else(|e| e.into_inner()) = Some(url);
  }
  fn take(&self) -> Option<Url> {
    self.0.lock().unwrap_or_else(|e| e.into_inner()).take()
  }
}

/// Whether the main window shows the site yet (a site page has finished loading since the start
/// page). Kept from page loads rather than asking the web view for its address: on Android that
/// question waits for the UI thread, which is where links arrive, and the app would hang and abort.
#[derive(Default)]
struct SiteShown(AtomicBool);

/// Shows an app link's page in the main window (and brings the window to the front). While the
/// app is still on its start page, the page waits there (see `start_target`).
fn open_link<R: Runtime>(app: &AppHandle<R>, link: &Url) {
  let Some(target) = link_target(link) else { return };
  let window = app.get_webview_window("main");
  // Still starting? Then the start page asks for it before it moves on; if it has just moved on,
  // the site's first page load picks it up (`on_page_load`).
  let starting = !app.state::<SiteShown>().0.load(Ordering::SeqCst);
  match &window {
    Some(w) if !starting => {
      let _ = w.navigate(target);
    }
    _ => app.state::<Pending>().set(target),
  }
  if let Some(w) = window {
    #[cfg(desktop)]
    let _ = w.unminimize();
    let _ = w.show();
    let _ = w.set_focus();
  }
}

/// A Blob file the app was asked to open: its name and its text (JSON), for the site to import.
#[derive(Serialize, Clone, Debug, PartialEq)]
struct OpenedFile {
  name: String,
  text: String,
}

/// Blob files opened with the app that the site hasn't taken yet (it may still be starting, or
/// signed out: it takes them once it can import them).
#[derive(Default)]
struct OpenedFiles(Mutex<Vec<OpenedFile>>);

/// The Blob file extension (src/notes/blobFile.ts BLOB_EXT).
const BLOB_EXT: &str = "blob";
/// Bigger files aren't read (the site imports at most 100 MB too).
const MAX_OPENED_BYTES: u64 = 100 * 1024 * 1024;

/// Whether a path names a Blob file (by its extension).
fn is_blob_file(path: &Path) -> bool {
  path.extension().is_some_and(|e| e.eq_ignore_ascii_case(BLOB_EXT))
}

/// Reads a Blob file the app was asked to open. Anything else (another kind of file, a folder,
/// too big, not text) is left alone.
fn read_opened(path: &Path) -> Option<OpenedFile> {
  if !is_blob_file(path) {
    return None;
  }
  let meta = std::fs::metadata(path).ok()?;
  if !meta.is_file() || meta.len() > MAX_OPENED_BYTES {
    return None;
  }
  let text = std::fs::read_to_string(path).ok()?;
  let name = path.file_name()?.to_string_lossy().into_owned();
  Some(OpenedFile { name, text })
}

/// The Blob files among command-line arguments: Windows and Linux start the app (or hand a running
/// one, through the single-instance plugin) the paths of the files to open. Relative paths are
/// relative to `cwd`; links and options are not files.
fn blob_paths(args: impl IntoIterator<Item = String>, cwd: &Path) -> Vec<PathBuf> {
  args
    .into_iter()
    .filter(|a| !a.starts_with('-') && !a.contains("://"))
    .map(PathBuf::from)
    .filter(|p| is_blob_file(p))
    .map(|p| if p.is_absolute() { p } else { cwd.join(p) })
    .collect()
}

/// Keeps opened Blob files for the site and lets it know (the site asks itself when it starts),
/// then brings the window to the front.
fn open_files<R: Runtime>(app: &AppHandle<R>, paths: &[PathBuf]) {
  let files: Vec<OpenedFile> = paths.iter().filter_map(|p| read_opened(p)).collect();
  // iPhone and iPad copy a file opened with Blob into the app's Documents/Inbox; once it's read,
  // the copy isn't needed.
  #[cfg(target_os = "ios")]
  for path in paths.iter().filter(|p| p.parent().is_some_and(|d| d.ends_with("Inbox"))) {
    let _ = std::fs::remove_file(path);
  }
  if files.is_empty() {
    return;
  }
  app.state::<OpenedFiles>().0.lock().unwrap_or_else(|e| e.into_inner()).extend(files);
  if let Some(window) = app.get_webview_window("main") {
    if app.state::<SiteShown>().0.load(Ordering::SeqCst) {
      let _ = window.eval("window.dispatchEvent(new Event('blob-opened-files'))");
    }
    #[cfg(desktop)]
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
  }
}

/// A new name for every pop-up window.
#[cfg(desktop)]
static POPUPS: AtomicU32 = AtomicU32::new(0);

/// Where a download goes: the Downloads folder, under a name that isn't taken yet.
fn download_path<R: Runtime>(app: &AppHandle<R>, url: &Url, suggested: &Path) -> Option<PathBuf> {
  let dir = app.path().download_dir().ok()?;
  // The webview's suggested name (from Content-Disposition), else the last part of the URL.
  let name = suggested
    .file_name()
    .map(|n| n.to_string_lossy().into_owned())
    .filter(|n| !n.is_empty())
    .or_else(|| url.path_segments().and_then(|mut s| s.next_back()).map(|s| s.to_string()))
    .filter(|n| !n.is_empty())
    .unwrap_or_else(|| "download".into());
  // Only the file name: no folders sneaking in.
  let name: String = name.chars().map(|c| if matches!(c, '/' | '\\' | ':' | '\0') { '_' } else { c }).collect();
  let (stem, ext) = match name.rsplit_once('.') {
    Some((s, e)) if !s.is_empty() => (s.to_string(), format!(".{e}")),
    _ => (name.clone(), String::new()),
  };
  let mut path = dir.join(&name);
  for n in 1..1000 {
    if !path.exists() {
      break;
    }
    path = dir.join(format!("{stem} ({n}){ext}"));
  }
  Some(path)
}

/// Builds an app window for the site (the main one, and pop-ups) with the app's rules for links,
/// pop-ups and downloads.
fn site_window<'a, R: Runtime>(app: &'a AppHandle<R>, label: &str, url: WebviewUrl) -> WebviewWindowBuilder<'a, R, AppHandle<R>> {
  let nav_app = app.clone();
  let load_app = app.clone();
  let download_app = app.clone();
  // Tells the site it's inside the app (and the start page where the site is).
  let script = format!(
    "window.__BLOB_APP__ = Object.freeze({{ platform: {platform:?}, version: {version:?}, site: {site:?} }});",
    platform = std::env::consts::OS,
    version = app.package_info().version.to_string(),
    site = site().to_string(),
  );

  let builder = WebviewWindowBuilder::new(app, label, url)
    .initialization_script(script)
    // Files dragged onto the window go to the page (pictures into a note, Blob files to import),
    // not to Tauri's own drop events; on Windows these would take every drop.
    .disable_drag_drop_handler();
  // iPhone and iPad: service workers (the site's offline copies) need "app-bound domains"
  // (WKAppBoundDomains in Info.ios.plist lists the site, its files and localhost).
  #[cfg(target_os = "ios")]
  let builder = builder.limit_navigations_to_app_bound_domains(true);
  let builder = builder
    // Stay on the site: other sites open in the browser, app links open in the app.
    .on_navigation(move |url| {
      if is_site(url) || is_local(url) || is_files(url) {
        return true;
      }
      if url.scheme() == LINK_SCHEME {
        open_link(&nav_app, url);
      } else {
        open_outside(&nav_app, url);
      }
      false
    })
    // Keeps track of whether the site is up; a link that came while the start page was already
    // leaving goes there once it is.
    .on_page_load(move |webview, payload| {
      if webview.label() != "main" {
        return;
      }
      let shown = &load_app.state::<SiteShown>().0;
      match payload.event() {
        PageLoadEvent::Started if is_start_page(payload.url()) => shown.store(false, Ordering::SeqCst),
        PageLoadEvent::Finished if is_site(payload.url()) => {
          shown.store(true, Ordering::SeqCst);
          if let Some(target) = load_app.state::<Pending>().take() {
            let _ = webview.navigate(target);
          }
        }
        _ => {}
      }
    })
    .on_download(move |_webview, event| {
      match event {
        DownloadEvent::Requested { url, destination } => {
          if let Some(path) = download_path(&download_app, &url, destination) {
            *destination = path;
          }
        }
        // Show the file (on macOS the path isn't known: the Downloads folder then). Desktop only.
        DownloadEvent::Finished { path, success: true, .. } => {
          if let Some(p) = path.or_else(|| download_app.path().download_dir().ok()) {
            let _ = download_app.opener().reveal_item_in_dir(p);
          }
        }
        _ => {}
      }
      true
    });

  // Pop-ups: the site's own pages become app windows (the presenter's speaker view keeps talking
  // to its opener); anything else goes to the browser. Phones have no pop-up windows.
  #[cfg(desktop)]
  let builder = {
    let popup_app = app.clone();
    builder.on_new_window(move |url, features| {
      if !is_site(&url) {
        open_outside(&popup_app, &url);
        return NewWindowResponse::Deny;
      }
      let label = format!("popup-{}", POPUPS.fetch_add(1, Ordering::Relaxed));
      let built = site_window(&popup_app, &label, WebviewUrl::External("about:blank".parse().expect("about:blank")))
        .window_features(features)
        .title("Blob")
        .on_document_title_changed(|window, title| {
          let _ = window.set_title(&title);
        })
        .build();
      match built {
        Ok(window) => {
          swipe_navigation(&window);
          NewWindowResponse::Create { window }
        }
        Err(e) => {
          eprintln!("blob: pop-up failed: {e}");
          NewWindowResponse::Deny
        }
      }
    })
  };

  builder
}

/// Opens a link of the site in the system browser (links to other sites, files to download on phones).
#[tauri::command]
fn open_external<R: Runtime>(app: AppHandle<R>, url: String) -> Result<(), String> {
  let url = Url::parse(&url).map_err(|e| e.to_string())?;
  if !matches!(url.scheme(), "http" | "https" | "mailto" | "tel") {
    return Err("only web, mail and phone links".into());
  }
  open_outside(&app, &url);
  Ok(())
}

/// Prints the page: macOS's and iOS's webviews ignore window.print on their own. (Android prints
/// through window.BlobAndroid, see gen/android MainActivity.kt.)
#[tauri::command]
fn print_page<R: Runtime>(window: WebviewWindow<R>) -> Result<(), String> {
  #[cfg(desktop)]
  return window.print().map_err(|e| e.to_string());
  #[cfg(target_os = "ios")]
  return window
    .with_webview(|webview| unsafe {
      use objc2::runtime::{AnyClass, AnyObject, Bool};
      // UIPrintInteractionController.shared, printing the web view: the system print sheet.
      let Some(web) = (webview.inner() as *mut AnyObject).as_ref() else { return };
      let Some(class) = AnyClass::get(c"UIPrintInteractionController") else { return };
      let controller: *mut AnyObject = objc2::msg_send![class, sharedPrintController];
      let Some(controller) = controller.as_ref() else { return };
      let formatter: *mut AnyObject = objc2::msg_send![web, viewPrintFormatter];
      let _: () = objc2::msg_send![controller, setPrintFormatter: formatter];
      type Done = block2::Block<dyn Fn(*mut AnyObject, Bool, *mut AnyObject)>;
      let done: Option<&Done> = None;
      let _: bool = objc2::msg_send![controller, presentAnimated: true, completionHandler: done];
    })
    .map_err(|e| e.to_string());
  #[cfg(target_os = "android")]
  {
    let _ = window;
    Err("Android prints through window.BlobAndroid".into())
  }
}

/// Swipe back and forward like a browser: the edge swipe on iPhone and iPad, two fingers on a Mac
/// trackpad or a Linux touchpad. (Android has its back gesture already; Tauri doesn't switch these on.)
/// On iPhone and iPad, a long press on a link doesn't open a page preview inside the app either, and
/// scrolling bounces at the ends like in every iOS app (Tauri turns the bounce off).
fn swipe_navigation<R: Runtime>(window: &WebviewWindow<R>) {
  #[cfg(any(target_os = "macos", target_os = "ios"))]
  let _ = window.with_webview(|webview| unsafe {
    if let Some(web) = (webview.inner() as *mut objc2::runtime::AnyObject).as_ref() {
      let _: () = objc2::msg_send![web, setAllowsBackForwardNavigationGestures: true];
      #[cfg(target_os = "ios")]
      {
        let _: () = objc2::msg_send![web, setAllowsLinkPreview: false];
        let scroll: *mut objc2::runtime::AnyObject = objc2::msg_send![web, scrollView];
        if let Some(scroll) = scroll.as_ref() {
          let _: () = objc2::msg_send![scroll, setBounces: true];
        }
      }
    }
  });
  #[cfg(target_os = "linux")]
  let _ = window.with_webview(|webview| {
    use webkit2gtk::{SettingsExt, WebViewExt};
    if let Some(settings) = webview.inner().settings() {
      settings.set_enable_back_forward_navigation_gestures(true);
    }
  });
  #[cfg(any(windows, target_os = "android"))]
  let _ = window;
}

#[derive(Serialize)]
struct AppInfo {
  platform: &'static str,
  version: String,
}

/// Which app this is: for the site's "you're in the app" touches.
#[tauri::command]
fn app_info<R: Runtime>(app: AppHandle<R>) -> AppInfo {
  AppInfo { platform: std::env::consts::OS, version: app.package_info().version.to_string() }
}

/// The file that says the site can start without a connection (the site warmed its offline copies).
fn offline_flag<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
  app.path().app_local_data_dir().ok().map(|dir| dir.join("offline-ready"))
}

/// The site says whether it can start offline: its pages and data are on this device (or, after
/// signing out, no longer are).
#[tauri::command]
fn set_offline_ready<R: Runtime>(app: AppHandle<R>, ready: bool) -> Result<(), String> {
  let path = offline_flag(&app).ok_or("no data folder")?;
  if ready {
    if let Some(dir) = path.parent() {
      std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, b"1").map_err(|e| e.to_string())
  } else {
    match std::fs::remove_file(&path) {
      Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
      _ => Ok(()),
    }
  }
}

/// The start page asks whether the site can start without a connection.
#[tauri::command]
fn offline_ready<R: Runtime>(app: AppHandle<R>) -> bool {
  offline_flag(&app).is_some_and(|p| p.exists())
}

/// The app group the iPhone app shares with its widgets (src-tauri/ios/BlobWidget).
#[cfg(target_os = "ios")]
const APP_GROUP: &std::ffi::CStr = c"group.org.bojes.blob";

/// What the home and lock screen widgets show: the site's JSON (src/lib/widget), or "" after signing
/// out. On iPhone and iPad it goes into the app group's settings, where the widget reads it; the
/// app's WidgetBridge.swift notices the change and has the widgets drawn again. (Android's widget
/// gets it through window.BlobAndroid, see gen/android TodayWidget.kt; computers have none.)
#[tauri::command]
fn set_widget(json: String) -> Result<(), String> {
  if json.len() > 64 * 1024 {
    return Err("too long".into());
  }
  #[cfg(target_os = "ios")]
  {
    use objc2::rc::{autoreleasepool, Allocated, Retained};
    use objc2::runtime::{AnyClass, AnyObject};
    let text = std::ffi::CString::new(json).map_err(|e| e.to_string())?;
    autoreleasepool(|_| unsafe {
      let (Some(defaults_class), Some(string_class)) = (AnyClass::get(c"NSUserDefaults"), AnyClass::get(c"NSString")) else { return };
      let string = |c: &std::ffi::CStr| -> Option<Retained<AnyObject>> { objc2::msg_send![string_class, stringWithUTF8String: c.as_ptr()] };
      let (Some(suite), Some(key), Some(value)) = (string(APP_GROUP), string(c"today"), string(&text)) else { return };
      let blank: Allocated<AnyObject> = objc2::msg_send![defaults_class, alloc];
      let defaults: Option<Retained<AnyObject>> = objc2::msg_send![blank, initWithSuiteName: &*suite];
      if let Some(defaults) = defaults {
        let _: () = objc2::msg_send![&*defaults, setObject: &*value, forKey: &*key];
      }
    });
  }
  #[cfg(not(target_os = "ios"))]
  let _ = json;
  Ok(())
}

/// The site takes the Blob files opened with the app since it last asked (and imports them).
#[tauri::command]
fn take_opened_files<R: Runtime>(app: AppHandle<R>) -> Vec<OpenedFile> {
  std::mem::take(&mut *app.state::<OpenedFiles>().0.lock().unwrap_or_else(|e| e.into_inner()))
}

/// The start page asks where to go, just before it leaves: a page from an app link, else nothing
/// (the home page). Asked once: the answer is used up.
#[tauri::command]
fn start_target<R: Runtime>(app: AppHandle<R>) -> Option<String> {
  app.state::<Pending>().take().map(|u| u.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default();

  // Desktop: one app at a time. A second start (e.g. from an app link) hands its link to the first
  // and focuses it. Must be the first plugin.
  #[cfg(desktop)]
  let builder = builder
    .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
      // A link comes through the deep-link plugin (`on_open_url`); Blob files come as paths.
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
      }
      open_files(app, &blob_paths(args.into_iter().skip(1), Path::new(&cwd)));
    }))
    .plugin(tauri_plugin_window_state::Builder::default().build());

  let builder = builder
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_deep_link::init())
    // Reminders (calendar, homework, exams, cards), planned by the site: scheduled with the system
    // on phones, shown while open on computers.
    .plugin(tauri_plugin_notification::init())
    .manage(Pending::default())
    .manage(SiteShown::default())
    .manage(OpenedFiles::default());

  // Computers also update themselves (src/update.rs); phones through their stores.
  #[cfg(desktop)]
  let builder = builder.manage(update::Updates::default()).invoke_handler(tauri::generate_handler![
    open_external,
    print_page,
    app_info,
    start_target,
    set_offline_ready,
    offline_ready,
    set_widget,
    take_opened_files,
    update::update_check,
    update::update_download,
    update::update_progress,
    update::update_apply
  ]);
  #[cfg(mobile)]
  let builder = builder.invoke_handler(tauri::generate_handler![open_external, print_page, app_info, start_target, set_offline_ready, offline_ready, set_widget, take_opened_files]);

  builder
    .setup(|app| {
      let handle = app.handle().clone();

      // Linux and Windows dev builds: register the link scheme now (installers do it on install).
      #[cfg(all(desktop, not(target_os = "macos")))]
      if cfg!(debug_assertions) {
        let _ = app.deep_link().register_all();
      }

      // Started to open Blob files (Windows and Linux: their paths; macOS and iPhone: file links,
      // below and in `on_open_url`): the site takes them once it's up.
      #[cfg(desktop)]
      open_files(&handle, &blob_paths(std::env::args().skip(1), &std::env::current_dir().unwrap_or_default()));

      // Started from a link: the start page goes there instead of the home page. Debug builds also
      // take a path in BLOB_START (e.g. BLOB_START=/learn/maths).
      let current = app.deep_link().get_current().ok().flatten().unwrap_or_default();
      open_files(&handle, &current.iter().filter(|u| u.scheme() == "file").filter_map(|u| u.to_file_path().ok()).collect::<Vec<_>>());
      let start = current
        .iter()
        .find_map(link_target)
        .or_else(|| if cfg!(debug_assertions) { std::env::var("BLOB_START").ok().and_then(|p| site().join(&p).ok()) } else { None });
      if let Some(start) = start {
        app.state::<Pending>().set(start);
      }

      // Computers: a click on one of Blob's notifications brings Blob to the front (the site then
      // opens the notification's page).
      #[cfg(desktop)]
      {
        use tauri_plugin_notification::NotificationExt;
        let front = handle.clone();
        let _ = app.notification().on_action(move |_| {
          if let Some(window) = front.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
          }
        });
      }

      let links = handle.clone();
      app.deep_link().on_open_url(move |event| {
        // macOS and iPhone hand over opened files as file links, together with app links.
        let (files, others): (Vec<Url>, Vec<Url>) = event.urls().into_iter().partition(|u| u.scheme() == "file");
        for link in others {
          open_link(&links, &link);
        }
        open_files(&links, &files.iter().filter_map(|u| u.to_file_path().ok()).collect::<Vec<_>>());
      });

      let window = site_window(&handle, "main", WebviewUrl::App("index.html".into()));
      #[cfg(desktop)]
      let window = window.title("Blob").inner_size(1280.0, 820.0).min_inner_size(380.0, 560.0).center();
      swipe_navigation(&window.build()?);
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running Blob");
}

#[cfg(test)]
mod tests {
  use super::*;

  fn url(s: &str) -> Url {
    Url::parse(s).unwrap()
  }

  #[test]
  fn site_and_local_pages() {
    assert!(is_site(&url("https://blob.bojes.org/home")));
    assert!(!is_site(&url("http://blob.bojes.org/home")));
    assert!(!is_site(&url("https://blob.bojes.org.evil.com/")));
    assert!(!is_site(&url("https://blob.bojes.org@evil.com/")));
    assert!(!is_site(&url("https://evil.com/?https://blob.bojes.org")));
    assert!(is_local(&url("about:blank")));
    assert!(!is_local(&url("about:srcdoc")));
    // The start page: exactly the app's own address on this platform.
    let start = if cfg!(any(windows, target_os = "android")) { "http://tauri.localhost/index.html" } else { "tauri://localhost/index.html" };
    let other = if cfg!(any(windows, target_os = "android")) { "tauri://localhost/index.html" } else { "http://tauri.localhost/index.html" };
    assert!(is_local(&url(start)));
    assert!(!is_local(&url(other)));
    assert!(!is_local(&url("http://tauri.localhost:8080/")));
    assert!(!is_local(&url("https://example.com")));
    // Files the site made itself, not files other pages made.
    assert!(is_local(&url("blob:https://blob.bojes.org/5b1c-uuid")));
    assert!(!is_local(&url("blob:https://evil.example/5b1c-uuid")));
    assert!(!is_local(&url("blob:null/5b1c-uuid")));
    // Only signed links into the files bucket.
    assert!(is_files(&url("https://nrxywlbbbafpyukcbruy.supabase.co/storage/v1/object/sign/files/u/x.pdf?token=t")));
    assert!(!is_files(&url("https://nrxywlbbbafpyukcbruy.supabase.co/storage/v1/object/public/other/x.svg")));
    assert!(!is_files(&url("https://nrxywlbbbafpyukcbruy.supabase.co/auth/v1/verify")));
    assert!(!is_files(&url("https://other.supabase.co/storage/v1/object/sign/files/x.pdf")));
  }

  #[test]
  fn opened_blob_files() {
    let cwd = std::env::temp_dir().join(format!("blob-open-{}", std::process::id()));
    std::fs::create_dir_all(&cwd).unwrap();
    let args = |a: &[&str]| a.iter().map(|s| s.to_string()).collect::<Vec<_>>();
    // Paths of Blob files only: relative ones from where the app was started; links and options aren't files.
    let found = blob_paths(args(&["Notes.blob", "/tmp/x/Bio.BLOB", "--flag", "org.bojes.blob://p/1", "photo.png", "notes.blob.txt"]), &cwd);
    assert_eq!(found, vec![cwd.join("Notes.blob"), PathBuf::from("/tmp/x/Bio.BLOB")]);
    // Read: name and text; other files, missing ones and folders aren't.
    std::fs::write(cwd.join("Notes.blob"), r#"{"format":"blob"}"#).unwrap();
    std::fs::write(cwd.join("photo.png"), "png").unwrap();
    std::fs::create_dir_all(cwd.join("folder.blob")).unwrap();
    assert_eq!(read_opened(&cwd.join("Notes.blob")), Some(OpenedFile { name: "Notes.blob".into(), text: r#"{"format":"blob"}"#.into() }));
    assert_eq!(read_opened(&cwd.join("photo.png")), None);
    assert_eq!(read_opened(&cwd.join("missing.blob")), None);
    assert_eq!(read_opened(&cwd.join("folder.blob")), None);
    let _ = std::fs::remove_dir_all(&cwd);
  }

  #[test]
  fn app_links() {
    let t = |s: &str| link_target(&url(s)).map(|u| u.to_string());
    assert_eq!(t("org.bojes.blob://auth/confirm?token_hash=abc&type=email&next=%2Fhome").as_deref(), Some("https://blob.bojes.org/auth/confirm?token_hash=abc&type=email&next=%2Fhome"));
    assert_eq!(t("https://blob.bojes.org/learn/maths").as_deref(), Some("https://blob.bojes.org/learn/maths"));
    assert_eq!(t("org.bojes.blob://p/123").as_deref(), Some("https://blob.bojes.org/p/123"));
    assert_eq!(t("org.bojes.blob://auth/app?code=abc&state=def").as_deref(), Some("https://blob.bojes.org/auth/app?code=abc&state=def"));
    // Unknown or odd pages land on home.
    assert_eq!(t("org.bojes.blob://auth/signout").as_deref(), Some("https://blob.bojes.org/home"));
    // Dot segments are resolved inside the link: they can't climb out of it.
    assert_eq!(t("org.bojes.blob://learn/../auth/signout").as_deref(), Some("https://blob.bojes.org/learn/auth/signout"));
    assert_eq!(t("org.bojes.blob://learnx").as_deref(), Some("https://blob.bojes.org/home"));
    assert_eq!(t("org.bojes.blob://p%2F..%2Fauth").as_deref(), Some("https://blob.bojes.org/home"));
    // Other sites and the browser's own blob: URLs aren't app links.
    assert_eq!(t("https://evil.com/auth/confirm"), None);
    assert_eq!(t("blob://auth/confirm"), None);
  }
}
