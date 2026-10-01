import type { Theme } from "@/lib/types";

export function applyTheme(theme: Theme) {
  try {
    localStorage.setItem("blob-theme", theme);
  } catch {}
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function currentTheme(): Theme {
  try {
    return (localStorage.getItem("blob-theme") as Theme) || "system";
  } catch {
    return "system";
  }
}

/** Keep the page in sync with the saved preference and, in "system" mode, with the OS. */
export function watchTheme(theme: Theme) {
  if (currentTheme() !== theme) applyTheme(theme);
  const media = matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (currentTheme() === "system") applyTheme("system");
  };
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
