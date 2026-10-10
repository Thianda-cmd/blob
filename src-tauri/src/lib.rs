//! Blob as a desktop and phone app: a native window around the website (blob.bojes.org).
//!
//! The site is server-rendered (Supabase sessions, server actions), so the app doesn't bundle it.
//! It starts on a small local page (`shell/index.html`: Blob, and a friendly screen when there's
//! no internet) that moves on to the site. What the app adds around the site:
//!
//! - links to other sites open in the system browser, never inside the app window;
//! - `blob://…` links (and on phones, later, https links to blob.bojes.org) open the app at that page,
//!   e.g. "Open in the Blob app" on the sign-in confirmation page;
//! - pop-up windows of the site (the presenter's speaker view) become app windows;
//! - downloads land in the Downloads folder; printing works where the webview can't do it alone;
//! - one running app at a time (a second start focuses the first), and it remembers its window.
//!
//! The site may call exactly three commands (see `capabilities/site.json`): `open_external`,
//! `print_page`, `app_info`. Nothing else of the native side is reachable from the web.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};

use serde::Serialize;
use tauri::webview::{DownloadEvent, NewWindowResponse};
use tauri::{AppHandle, Manager, Runtime, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;

/// The website the app shows.
const SITE: &str = "https://blob.bojes.org";

/// Where the site's files live (Supabase Storage). Its file previews are iframes, and macOS and Linux
/// ask the navigation rule about frames too, so they must load in the app.
const FILES_HOST: &str = "nrxywlbbbafpyukcbruy.supabase.co";

/// Pages a `blob://` link may open (the start of the path). Everything else lands on the home page.
const LINK_PATHS: &[&str] = &["auth/confirm", "home", "learn", "study", "join", "p/", "notes", "projects", "cv", "blob", "show"];

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

/// The app's own pages: the bundled start page (tauri://localhost, http(s)://tauri.localhost on
/// Windows and Android), about:blank and files the site made itself (blob:https://…, no host).
fn is_local(url: &Url) -> bool {
  match url.scheme() {
    "tauri" | "asset" | "about" => true,
    "blob" => url.host().is_none(),
    "http" | "https" => url.host_str() == Some("tauri.localhost"),
    _ => false,
  }
}

/// The site's stored files (previews in frames, downloads).
fn is_files(url: &Url) -> bool {
  url.scheme() == "https" && url.host_str() == Some(FILES_HOST)
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

/// The page of the site a deep link points to, if it's one the app opens.
///
/// `blob://auth/confirm?token_hash=…` and `https://blob.bojes.org/auth/confirm?token_hash=…` both
/// become `https://blob.bojes.org/auth/confirm?token_hash=…`. Unknown pages become the home page.
fn link_target(link: &Url) -> Option<Url> {
  let path = match link.scheme() {
    // blob://auth/confirm → "auth/confirm" (the "host" is the first part of the path).
    "blob" => format!("{}{}", link.host_str().unwrap_or(""), link.path()),
    "https" if is_site(link) => link.path().trim_start_matches('/').to_string(),
    _ => return None,
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

/// Shows a deep link's page in the main window (and brings the window to the front).
fn open_link<R: Runtime>(app: &AppHandle<R>, link: &Url) {
  let Some(target) = link_target(link) else { return };
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.navigate(target);
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
  }
}

/// A new name for every pop-up window.
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
fn site_window<'a, R: Runtime>(app: &'a AppHandle<R>, label: &str, url: WebviewUrl, start: Option<&Url>) -> WebviewWindowBuilder<'a, R, AppHandle<R>> {
  let nav_app = app.clone();
  let popup_app = app.clone();
  let download_app = app.clone();
  let start = start.map(|u| u.to_string()).unwrap_or_default();
  // Tells the site it's inside the app, and the start page where to go.
  let script = format!(
    "window.__BLOB_APP__ = Object.freeze({{ platform: {platform:?}, version: {version:?}, site: {site:?}, start: {start:?} }});",
    platform = std::env::consts::OS,
    version = app.package_info().version.to_string(),
    site = site().to_string(),
  );

  let builder = WebviewWindowBuilder::new(app, label, url)
    .initialization_script(script)
    // Stay on the site: other sites open in the browser.
    .on_navigation(move |url| {
      if is_site(url) || is_local(url) || is_files(url) {
        return true;
      }
      // A blob:// link on a page: open it like a link from outside.
      if url.scheme() == "blob" {
        open_link(&nav_app, url);
      } else {
        open_outside(&nav_app, url);
      }
      false
    })
    .on_download(move |_webview, event| {
      match event {
        DownloadEvent::Requested { url, destination } => {
          if let Some(path) = download_path(&download_app, &url, destination) {
            *destination = path;
          }
        }
        // Show the file (on macOS the path isn't known: the Downloads folder then).
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
  let builder = builder.on_new_window(move |url, features| {
    if is_site(&url) || url.scheme() == "about" {
      let label = format!("popup-{}", POPUPS.fetch_add(1, Ordering::Relaxed));
      let built = site_window(&popup_app, &label, WebviewUrl::External("about:blank".parse().expect("about:blank")), None)
        .window_features(features)
        .title("Blob")
        .on_document_title_changed(|window, title| {
          let _ = window.set_title(&title);
        })
        .build();
      return match built {
        Ok(window) => NewWindowResponse::Create { window },
        Err(e) => {
          eprintln!("blob: pop-up failed: {e}");
          NewWindowResponse::Deny
        }
      };
    }
    open_outside(&popup_app, &url);
    NewWindowResponse::Deny
  });
  #[cfg(mobile)]
  let _ = (&popup_app, &POPUPS);

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

/// Prints the page (macOS's webview ignores window.print on its own).
#[tauri::command]
fn print_page<R: Runtime>(window: WebviewWindow<R>) -> Result<(), String> {
  window.print().map_err(|e| e.to_string())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default();

  // Desktop: one app at a time. A second start (e.g. from a blob:// link) hands its link to the
  // first and focuses it. Must be the first plugin.
  #[cfg(desktop)]
  {
    builder = builder
      .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.unminimize();
          let _ = window.show();
          let _ = window.set_focus();
        }
        // On Windows and Linux the link comes as an argument (the deep-link plugin also sees it).
        let _ = args;
      }))
      .plugin(tauri_plugin_window_state::Builder::default().build());
  }

  builder
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_deep_link::init())
    .invoke_handler(tauri::generate_handler![open_external, print_page, app_info])
    .setup(|app| {
      let handle = app.handle().clone();

      // Linux and Windows dev builds: register blob:// now (installers do it on install).
      #[cfg(all(desktop, not(target_os = "macos")))]
      if cfg!(debug_assertions) {
        let _ = app.deep_link().register_all();
      }

      // Started from a link: open that page instead of the home page. Debug builds also take a path
      // in BLOB_START (e.g. BLOB_START=/learn/french).
      let start = app
        .deep_link()
        .get_current()
        .ok()
        .flatten()
        .and_then(|links| links.iter().find_map(link_target))
        .or_else(|| if cfg!(debug_assertions) { std::env::var("BLOB_START").ok().and_then(|p| site().join(&p).ok()) } else { None });

      let links = handle.clone();
      app.deep_link().on_open_url(move |event| {
        for link in event.urls() {
          open_link(&links, &link);
        }
      });

      let window = site_window(&handle, "main", WebviewUrl::App("index.html".into()), start.as_ref());
      #[cfg(desktop)]
      let window = window.title("Blob").inner_size(1280.0, 820.0).min_inner_size(380.0, 560.0).center();
      window.build()?;
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
    assert!(!is_site(&url("https://evil.com/?https://blob.bojes.org")));
    assert!(is_local(&url("tauri://localhost/index.html")));
    assert!(is_local(&url("http://tauri.localhost/index.html")));
    assert!(!is_local(&url("https://example.com")));
    assert!(is_local(&url("blob:https://blob.bojes.org/5b1c-uuid")));
    assert!(!is_local(&url("blob://auth/confirm")));
    assert!(is_files(&url("https://nrxywlbbbafpyukcbruy.supabase.co/storage/v1/object/sign/x.pdf")));
    assert!(!is_files(&url("https://other.supabase.co/storage/v1/object/sign/x.pdf")));
  }

  #[test]
  fn deep_links() {
    let t = |s: &str| link_target(&url(s)).map(|u| u.to_string());
    assert_eq!(t("blob://auth/confirm?token_hash=abc&type=email&next=%2Fhome").as_deref(), Some("https://blob.bojes.org/auth/confirm?token_hash=abc&type=email&next=%2Fhome"));
    assert_eq!(t("https://blob.bojes.org/learn/french").as_deref(), Some("https://blob.bojes.org/learn/french"));
    assert_eq!(t("blob://p/123").as_deref(), Some("https://blob.bojes.org/p/123"));
    // Unknown or odd pages land on home.
    assert_eq!(t("blob://auth/signout").as_deref(), Some("https://blob.bojes.org/home"));
    // Dot segments are resolved inside the link: they can't climb out of it.
    assert_eq!(t("blob://learn/../auth/signout").as_deref(), Some("https://blob.bojes.org/learn/auth/signout"));
    assert_eq!(t("blob://learnx").as_deref(), Some("https://blob.bojes.org/home"));
    assert_eq!(t("blob://p%2F..%2Fauth").as_deref(), Some("https://blob.bojes.org/home"));
    // Other sites aren't app links.
    assert_eq!(t("https://evil.com/auth/confirm"), None);
  }
}
