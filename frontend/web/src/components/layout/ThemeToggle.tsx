import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { onThemeChange, resolvedDark } from "../../lib/theme";
import { changeTheme } from "../../lib/themeAccount";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(() => resolvedDark());

  useEffect(() => {
    return onThemeChange(() => setDark(resolvedDark()));
  }, []);

  const toggle = () => {
    changeTheme(resolvedDark() ? "light" : "dark");
    setDark(resolvedDark());
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-night-600 bg-white/70 text-night-500 transition-all duration-150 hover:border-brand/40 hover:bg-brand/5 hover:text-brand dark:border-night-600 dark:bg-night-800 dark:text-gray-400 dark:hover:border-brand/30 dark:hover:text-brand ${className}`}
      title={dark ? "Switch to Light mode" : "Switch to Dark mode"}
      aria-label="Toggle color theme"
    >
      {dark ? <Sun className="h-4 w-4 transition-transform hover:rotate-45" /> : <Moon className="h-4 w-4 transition-transform hover:-rotate-12" />}
    </button>
  );
}
