/** Apply saved theme to <html> — default light. Run once at startup. */
export function applyTheme(): boolean {
  const saved = localStorage.getItem("theme");
  const dark = saved === "dark";
  document.documentElement.classList.toggle("dark", dark);
  return dark;
}

/** Toggle light/dark and persist. Returns the NEW dark state. */
export function toggleTheme(): boolean {
  const dark = !document.documentElement.classList.contains("dark");
  localStorage.setItem("theme", dark ? "dark" : "light");
  document.documentElement.classList.toggle("dark", dark);
  return dark;
}
