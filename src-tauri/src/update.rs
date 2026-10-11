//! Updates for the desktop apps, from the project's GitHub releases (tags `app-v<version>`).
//!
//! The site asks (`update_check`), shows Blob's update card, and on "Update" has the app download
//! the right file for this computer (`update_download`) and put it in place (`update_apply`):
//!
//! - Windows: the installer of the same kind (setup.exe or .msi), run passively; it closes Blob,
//!   updates it and starts it again.
//! - macOS: the `.app.tar.gz`, unpacked in place of the running Blob.app, then Blob restarts.
//! - Linux AppImage: the new AppImage in place of the old one, then Blob restarts.
//! - Linux .deb/.rpm (installed by the system): the card offers the release page instead.
//!
//! Every file is checked against the SHA-256 digest GitHub lists for it before anything runs, and
//! only files from this project's releases are fetched. The update the site may install is the
//! one this side found itself: the site never hands over a link or a digest.

use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, Runtime};

const RELEASES: &str = "https://api.github.com/repos/Thianda-cmd/blob/releases?per_page=20";
const DOWNLOADS: &str = "https://github.com/Thianda-cmd/blob/releases/download/app-v";
const PAGES: &str = "https://github.com/Thianda-cmd/blob/releases/tag/app-v";
const MAX_SIZE: u64 = 400 * 1024 * 1024;

#[derive(Deserialize)]
struct Release {
  tag_name: String,
  #[serde(default)]
  draft: bool,
  #[serde(default)]
  body: Option<String>,
  #[serde(default)]
  html_url: String,
  #[serde(default)]
  published_at: Option<String>,
  #[serde(default)]
  assets: Vec<ReleaseAsset>,
}

#[derive(Deserialize)]
struct ReleaseAsset {
  name: String,
  browser_download_url: String,
  size: u64,
  #[serde(default)]
  digest: Option<String>,
}

#[derive(Clone)]
struct Asset {
  url: String,
  name: String,
  size: u64,
  sha256: String,
}

#[derive(Clone)]
struct Found {
  version: String,
  asset: Option<Asset>,
}

/// What the site shows on the update card.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
  version: String,
  current: String,
  /// The release notes (Markdown).
  notes: String,
  /// The release page (the way to update when the app can't do it itself).
  page: String,
  published: Option<String>,
  /// The app can download and install it itself.
  installable: bool,
  size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
  downloaded: u64,
  total: u64,
  /// Downloaded and checked, ready to put in place.
  ready: bool,
  busy: bool,
}

#[derive(Default)]
pub struct Updates {
  found: Mutex<Option<Found>>,
  staged: Mutex<Option<(String, PathBuf)>>,
  downloaded: AtomicU64,
  total: AtomicU64,
  busy: AtomicBool,
}

fn agent(version: &str) -> ureq::Agent {
  // The system's certificates (and its proxy settings): school and company networks often need them.
  let tls = ureq::tls::TlsConfig::builder().root_certs(ureq::tls::RootCerts::PlatformVerifier).build();
  ureq::Agent::config_builder()
    .user_agent(format!("Blob-app/{version}"))
    .timeout_connect(Some(Duration::from_secs(20)))
    .timeout_global(Some(Duration::from_secs(1800)))
    .max_redirects(0)
    .http_status_as_error(false)
    .tls_config(tls)
    .build()
    .into()
}

/// A GET that follows redirects itself (downloads go on from GitHub to its file storage): ureq's own
/// following stumbles over some answers (a chunked 302 that closes the connection), and only https
/// addresses are followed.
fn get(agent: &ureq::Agent, url: &str, accept: Option<&str>) -> Result<ureq::http::Response<ureq::Body>, String> {
  let mut url = url.to_string();
  for _ in 0..6 {
    let mut req = agent.get(&url);
    if let Some(accept) = accept {
      req = req.header("Accept", accept);
    }
    let res = req.call().map_err(|e| e.to_string())?;
    let status = res.status();
    if status.is_redirection() {
      let next = res.headers().get("location").and_then(|v| v.to_str().ok()).ok_or("a redirect without an address")?;
      if !next.starts_with("https://") {
        return Err("a redirect away from https".into());
      }
      url = next.to_string();
      continue;
    }
    if !status.is_success() {
      return Err(format!("HTTP {status}"));
    }
    return Ok(res);
  }
  Err("too many redirects".into())
}

/// "app-v0.3.0" → 0.3.0
fn version_of(tag: &str) -> Option<semver::Version> {
  semver::Version::parse(tag.strip_prefix("app-v")?).ok()
}

/// The file this copy of Blob updates from: the same kind it was installed from (Tauri marks each
/// bundle with its kind). Installed by the system (.deb, .rpm) or not installed (a dev build): none.
fn pick(assets: &[ReleaseAsset]) -> Option<&ReleaseAsset> {
  use tauri::utils::{config::BundleType, platform::bundle_type};
  let wanted = match bundle_type() {
    Some(BundleType::Nsis) => "_x64-setup.exe",
    Some(BundleType::Msi) => "_x64_en-US.msi",
    Some(BundleType::App) => ".app.tar.gz",
    Some(BundleType::AppImage) if std::env::var_os("APPIMAGE").is_some() => "_amd64.AppImage",
    // Development (BLOB_UPDATE_AS, below): an AppImage at $APPIMAGE stands in for this one.
    None if cfg!(debug_assertions) && std::env::var_os("BLOB_UPDATE_AS").is_some() && std::env::var_os("APPIMAGE").is_some() => "_amd64.AppImage",
    _ => return None,
  };
  assets.iter().find(|a| a.name.ends_with(wanted))
}

fn check_blocking(current: semver::Version) -> Result<Option<(Found, UpdateInfo)>, String> {
  let agent = agent(&current.to_string());
  let mut res = get(&agent, RELEASES, Some("application/vnd.github+json"))?;
  let body = res.body_mut().with_config().limit(8 * 1024 * 1024).read_to_string().map_err(|e| e.to_string())?;
  let releases: Vec<Release> = serde_json::from_str(&body).map_err(|e| e.to_string())?;
  let newest = releases
    .into_iter()
    .filter(|r| !r.draft)
    .filter_map(|r| version_of(&r.tag_name).map(|v| (v, r)))
    .max_by(|a, b| a.0.cmp(&b.0));
  let Some((version, release)) = newest else { return Ok(None) };
  if version <= current {
    return Ok(None);
  }
  let asset = pick(&release.assets).and_then(|a| {
    let sha256 = a.digest.as_deref()?.strip_prefix("sha256:")?.to_ascii_lowercase();
    let ok = a.browser_download_url.starts_with(&format!("{DOWNLOADS}{version}/")) && sha256.len() == 64 && a.size > 0 && a.size <= MAX_SIZE;
    ok.then(|| Asset { url: a.browser_download_url.clone(), name: a.name.clone(), size: a.size, sha256 })
  });
  let page = if release.html_url.starts_with(&format!("{PAGES}{version}")) { release.html_url.clone() } else { format!("{PAGES}{version}") };
  let info = UpdateInfo {
    version: version.to_string(),
    current: current.to_string(),
    notes: release.body.unwrap_or_default(),
    page,
    published: release.published_at,
    installable: asset.is_some(),
    size: asset.as_ref().map(|a| a.size).unwrap_or(0),
  };
  Ok(Some((Found { version: version.to_string(), asset }, info)))
}

/// Looks for a newer version. None: Blob is up to date.
#[tauri::command]
pub async fn update_check<R: Runtime>(app: AppHandle<R>) -> Result<Option<UpdateInfo>, String> {
  if cfg!(mobile) {
    return Ok(None);
  }
  let mut current = app.package_info().version.clone();
  // Development: pretend to be an older version, to try updating against the real releases.
  if cfg!(debug_assertions) {
    if let Some(v) = std::env::var("BLOB_UPDATE_AS").ok().and_then(|v| semver::Version::parse(&v).ok()) {
      current = v;
    }
  }
  let result = tauri::async_runtime::spawn_blocking(move || check_blocking(current)).await.map_err(|e| e.to_string())??;
  let state = app.state::<Updates>();
  let mut found = state.found.lock().unwrap_or_else(|e| e.into_inner());
  Ok(match result {
    Some((f, info)) => {
      *found = Some(f);
      Some(info)
    }
    None => {
      *found = None;
      None
    }
  })
}

fn download_blocking(asset: &Asset, to: &PathBuf, state: &Updates, version: &str) -> Result<(), String> {
  let agent = agent(version);
  let mut res = get(&agent, &asset.url, None)?;
  state.total.store(asset.size, Ordering::Relaxed);
  state.downloaded.store(0, Ordering::Relaxed);
  if let Some(dir) = to.parent() {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
  }
  let mut file = std::fs::File::create(to).map_err(|e| e.to_string())?;
  let mut reader = res.body_mut().with_config().limit(MAX_SIZE).reader();
  let mut hasher = Sha256::new();
  let mut buf = vec![0u8; 256 * 1024];
  let mut total = 0u64;
  loop {
    let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
    if n == 0 {
      break;
    }
    hasher.update(&buf[..n]);
    file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
    total += n as u64;
    state.downloaded.store(total, Ordering::Relaxed);
  }
  file.flush().map_err(|e| e.to_string())?;
  drop(file);
  let digest = hex::encode(hasher.finalize());
  if total != asset.size || digest != asset.sha256 {
    let _ = std::fs::remove_file(to);
    return Err("the download doesn't match the release (checksum)".into());
  }
  Ok(())
}

/// Downloads the update found by `update_check` and checks it. Progress: `update_progress`.
#[tauri::command]
pub async fn update_download<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
  let state = app.state::<Updates>();
  let found = state.found.lock().unwrap_or_else(|e| e.into_inner()).clone().ok_or("no update to download")?;
  let asset = found.asset.clone().ok_or("this update can't be installed by the app")?;
  if let Some((version, path)) = state.staged.lock().unwrap_or_else(|e| e.into_inner()).as_ref() {
    if *version == found.version && path.exists() {
      return Ok(());
    }
  }
  if state.busy.swap(true, Ordering::SeqCst) {
    return Err("already downloading".into());
  }
  let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("updates");
  // Earlier downloads go.
  let _ = std::fs::remove_dir_all(&dir);
  let to = dir.join(&asset.name);
  let handle = app.clone();
  let target = to.clone();
  let version = found.version.clone();
  let result = tauri::async_runtime::spawn_blocking(move || {
    let state = handle.state::<Updates>();
    download_blocking(&asset, &target, &state, &version)
  })
  .await
  .map_err(|e| e.to_string())
  .and_then(|r| r);
  state.busy.store(false, Ordering::SeqCst);
  result?;
  *state.staged.lock().unwrap_or_else(|e| e.into_inner()) = Some((found.version, to));
  Ok(())
}

#[tauri::command]
pub fn update_progress<R: Runtime>(app: AppHandle<R>) -> Progress {
  let state = app.state::<Updates>();
  let ready = state.staged.lock().unwrap_or_else(|e| e.into_inner()).as_ref().is_some_and(|(_, p)| p.exists());
  Progress { downloaded: state.downloaded.load(Ordering::Relaxed), total: state.total.load(Ordering::Relaxed), ready, busy: state.busy.load(Ordering::Relaxed) }
}

/// Puts the downloaded update in place and starts the new Blob.
#[tauri::command]
pub fn update_apply<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
  let state = app.state::<Updates>();
  let (_, path) = state.staged.lock().unwrap_or_else(|e| e.into_inner()).clone().ok_or("nothing downloaded")?;
  install(&app, &path)
}

#[cfg(windows)]
fn install<R: Runtime>(app: &AppHandle<R>, path: &PathBuf) -> Result<(), String> {
  if path.extension().is_some_and(|x| x.eq_ignore_ascii_case("msi")) {
    // Windows Installer: a progress bar (and the admin prompt the .msi needs), then Blob starts again.
    std::process::Command::new("msiexec.exe").arg("/i").arg(path).args(["/passive", "AUTOLAUNCHAPP=True"]).spawn().map_err(|e| e.to_string())?;
  } else {
    // Passive (a progress bar, no questions), as an update, and start Blob again afterwards.
    std::process::Command::new(path).args(["/P", "/R", "/UPDATE"]).spawn().map_err(|e| e.to_string())?;
  }
  tauri_plugin_single_instance::destroy(app);
  app.exit(0);
  Ok(())
}

#[cfg(target_os = "macos")]
fn install<R: Runtime>(app: &AppHandle<R>, path: &PathBuf) -> Result<(), String> {
  use flate2::read::GzDecoder;
  let exe = std::env::current_exe().map_err(|e| e.to_string())?;
  let bundle = exe.ancestors().find(|p| p.extension().is_some_and(|x| x == "app")).ok_or("Blob isn't running from an .app")?.to_path_buf();
  let parent = bundle.parent().ok_or("no folder around Blob.app")?;
  // Unpacked next to the old app (same volume: the swap is a rename).
  let fresh = parent.join(".Blob-update.app");
  let _ = std::fs::remove_dir_all(&fresh);
  let unpack = (|| -> std::io::Result<()> {
    let mut archive = tar::Archive::new(GzDecoder::new(std::fs::File::open(path)?));
    for entry in archive.entries()? {
      let mut entry = entry?;
      // "Blob.app/Contents/…" → "Contents/…"
      let inner: PathBuf = entry.path()?.iter().skip(1).collect();
      if inner.as_os_str().is_empty() || inner.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        continue;
      }
      let dest = fresh.join(&inner);
      if let Some(dir) = dest.parent() {
        std::fs::create_dir_all(dir)?;
      }
      entry.unpack(&dest)?;
    }
    Ok(())
  })();
  if let Err(e) = unpack {
    let _ = std::fs::remove_dir_all(&fresh);
    // No permission for that folder: ask macOS for it (the password dialog).
    if e.kind() != std::io::ErrorKind::PermissionDenied {
      return Err(e.to_string());
    }
    return install_as_admin(app, path, &bundle);
  }
  let old = parent.join(".Blob-old.app");
  let _ = std::fs::remove_dir_all(&old);
  std::fs::rename(&bundle, &old).map_err(|e| e.to_string())?;
  if let Err(e) = std::fs::rename(&fresh, &bundle) {
    let _ = std::fs::rename(&old, &bundle);
    return Err(e.to_string());
  }
  let _ = std::fs::remove_dir_all(&old);
  let _ = std::process::Command::new("touch").arg(&bundle).status();
  // The new Blob must not find this one still holding the single-instance lock (it would hand over and quit).
  tauri_plugin_single_instance::destroy(app);
  app.restart();
}

#[cfg(target_os = "macos")]
fn install_as_admin<R: Runtime>(app: &AppHandle<R>, archive: &PathBuf, bundle: &std::path::Path) -> Result<(), String> {
  let quote = |p: &std::path::Path| p.display().to_string().replace('\'', "'\\''");
  let parent = bundle.parent().ok_or("no folder around Blob.app")?;
  let script = format!(
    "do shell script \"cd '{dir}' && rm -rf .Blob-update && mkdir .Blob-update && tar -xzf '{archive}' -C .Blob-update && rm -rf '{app}' && mv .Blob-update/*.app '{app}' && rm -rf .Blob-update\" with administrator privileges",
    dir = quote(parent),
    archive = quote(archive),
    app = quote(bundle),
  );
  let status = std::process::Command::new("osascript").args(["-e", &script]).status().map_err(|e| e.to_string())?;
  if !status.success() {
    return Err("the update wasn't allowed".into());
  }
  tauri_plugin_single_instance::destroy(app);
  app.restart();
}

#[cfg(all(target_os = "linux", not(target_os = "android")))]
fn install<R: Runtime>(app: &AppHandle<R>, path: &PathBuf) -> Result<(), String> {
  use std::os::unix::fs::PermissionsExt;
  let target = PathBuf::from(std::env::var_os("APPIMAGE").ok_or("only the AppImage updates itself")?);
  let dir = target.parent().ok_or("no folder around the AppImage")?;
  // Next to the old one (same disk), then swapped in one step.
  let fresh = dir.join(".Blob-update.AppImage");
  std::fs::copy(path, &fresh).map_err(|e| e.to_string())?;
  std::fs::set_permissions(&fresh, std::fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())?;
  if let Err(e) = std::fs::rename(&fresh, &target) {
    let _ = std::fs::remove_file(&fresh);
    return Err(e.to_string());
  }
  // The new Blob must not find this one still holding the single-instance lock (it would hand over and quit).
  tauri_plugin_single_instance::destroy(app);
  std::process::Command::new(&target).spawn().map_err(|e| e.to_string())?;
  app.exit(0);
  Ok(())
}

#[cfg(mobile)]
fn install<R: Runtime>(_app: &AppHandle<R>, _path: &PathBuf) -> Result<(), String> {
  Err("phones update through their store".into())
}
