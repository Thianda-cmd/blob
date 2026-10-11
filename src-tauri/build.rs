fn main() {
  // The app's own commands get permissions (allow-open-external, …) so capabilities can grant them
  // one by one, to the site too (capabilities/site.json).
  tauri_build::try_build(
    tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&["open_external", "print_page", "app_info", "start_target", "set_offline_ready", "offline_ready"])),
  )
  .expect("failed to run tauri-build");
}
