#!/usr/bin/env ruby
# Adds Blob's widgets to the iOS project that `tauri ios init` generates (src-tauri/gen/apple, which
# isn't kept in the repository):
#
# - the WidgetKit extension (src-tauri/ios/BlobWidget), embedded in the app;
# - the app group the app and the widget share (group.org.bojes.blob), where the app keeps the
#   widget's data (set_widget in src-tauri/src/lib.rs);
# - WidgetBridge.swift in the app, started from main.mm, which redraws the widgets when that data
#   changes.
#
# Run it after `tauri ios init`, then `xcodegen generate` in gen/apple (the Apps workflow does both).
# Running it again changes nothing. On a device, the app group must also be enabled for both bundle
# IDs (org.bojes.blob, org.bojes.blob.widget) in the Apple developer account.

require "fileutils"
require "json"
require "shellwords"
require "yaml"

ROOT = File.expand_path("..", __dir__) # src-tauri
APPLE = File.join(ROOT, "gen", "apple")
SPEC = File.join(APPLE, "project.yml")
GROUP = "group.org.bojes.blob"
WIDGET = "BlobWidget"

abort "add-widget: #{SPEC} is missing, run `tauri ios init` first" unless File.exist?(SPEC)

spec =
  begin
    YAML.load_file(SPEC, aliases: true)
  rescue ArgumentError
    YAML.load_file(SPEC)
  end
targets = spec.fetch("targets")
name, app = targets.find { |_, t| t["type"] == "application" && t["platform"].to_s.include?("iOS") } ||
            targets.find { |n, _| n.end_with?("_iOS") } ||
            abort("add-widget: no iOS app target in project.yml")
version = JSON.parse(File.read(File.join(ROOT, "tauri.conf.json"))).fetch("version")

# The extension.
widget = {
  "type" => "app-extension",
  "platform" => "iOS",
  # Lock screen widgets need iOS 16; on older systems the app simply has no widget.
  "deploymentTarget" => "16.0",
  "sources" => [{ "path" => "../../ios/BlobWidget" }],
  "info" => {
    "path" => "#{WIDGET}/Info.plist",
    "properties" => {
      "CFBundleDisplayName" => "Blob",
      "CFBundleShortVersionString" => version,
      "CFBundleVersion" => version,
      "NSExtension" => { "NSExtensionPointIdentifier" => "com.apple.widgetkit-extension" },
    },
  },
  "entitlements" => {
    "path" => "#{WIDGET}/#{WIDGET}.entitlements",
    "properties" => { "com.apple.security.application-groups" => [GROUP] },
  },
  "settings" => {
    "base" => {
      "PRODUCT_BUNDLE_IDENTIFIER" => "org.bojes.blob.widget",
      "PRODUCT_NAME" => WIDGET,
      "SWIFT_VERSION" => "5.0",
      "TARGETED_DEVICE_FAMILY" => "1,2",
      "SKIP_INSTALL" => "YES",
      "GENERATE_INFOPLIST_FILE" => "NO",
      "LD_RUNPATH_SEARCH_PATHS" => ["$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks"],
    },
  },
  "dependencies" => [{ "sdk" => "WidgetKit.framework" }, { "sdk" => "SwiftUI.framework" }],
}
team = app.dig("settings", "base", "DEVELOPMENT_TEAM") || spec.dig("settingGroups", "app", "base", "DEVELOPMENT_TEAM")
widget["settings"]["base"]["DEVELOPMENT_TEAM"] = team if team
targets[WIDGET] = widget

# The app embeds it and links WidgetKit (for WidgetBridge.swift).
deps = (app["dependencies"] || []).reject { |d| d["target"] == WIDGET || d["sdk"] == "WidgetKit.framework" }
app["dependencies"] = deps + [{ "target" => WIDGET, "embed" => true }, { "sdk" => "WidgetKit.framework" }]
app["settings"] ||= {}
app["settings"]["base"] ||= {}
app["settings"]["base"]["SWIFT_VERSION"] ||= "5.0"

# The app group, added to whatever the app's entitlements already hold.
ent = (app["entitlements"] ||= { "path" => "#{name}/#{name}.entitlements" })
props = ent["properties"]
if props.nil?
  props = {}
  file = File.join(APPLE, ent["path"])
  if File.exist?(file)
    json = `plutil -convert json -o - #{Shellwords.escape(file)} 2>/dev/null`
    props = JSON.parse(json) if $?.success? && !json.strip.empty?
  end
end
props["com.apple.security.application-groups"] = (props["com.apple.security.application-groups"] || []) | [GROUP]
ent["properties"] = props

File.write(SPEC, spec.to_yaml)

# WidgetBridge.swift next to main.mm, and main.mm starts it.
main = Dir.glob(File.join(APPLE, "Sources", "**", "main.mm")).first || abort("add-widget: no Sources/**/main.mm")
FileUtils.cp(File.join(ROOT, "ios", "App", "WidgetBridge.swift"), File.dirname(main))
src = File.read(main)
unless src.include?("blob_widget_setup")
  src.sub!(/^int main\(/) { "extern \"C\" void blob_widget_setup(void);\n\nint main(" } || abort("add-widget: main.mm has no main()")
  src.sub!(/^(\s*)(ffi::start_app\(\);)/) { "#{$1}blob_widget_setup();\n#{$1}#{$2}" } || abort("add-widget: main.mm doesn't call ffi::start_app()")
  File.write(main, src)
end

puts "add-widget: #{WIDGET} added to #{name} (app group #{GROUP}, version #{version})"
