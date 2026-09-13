import { Link } from "react-router-dom";
import { Logo } from "../Logo";
import { useSiteStore } from "../../stores/site";

export function Footer() {
  const settings = useSiteStore((s) => s.settings);

  return (
    <footer className="border-t border-zinc-200/80 bg-white text-zinc-600 dark:border-white/[0.08] dark:bg-black dark:text-zinc-400 transition-colors">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-3 max-w-sm">
            <Logo />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-mono mt-2">
              Industrial-grade ESP32 smart home automation modules, sub-second latency, and zero cloud dependency.
            </p>
          </div>

          <div className="flex flex-wrap gap-12 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <div className="space-y-2.5">
              <p className="font-mono font-bold text-black dark:text-white uppercase tracking-wider text-[11px]">Hardware</p>
              <ul className="space-y-2">
                <li><Link to="/shop" className="hover:text-black dark:hover:text-white transition-colors">Catalog & Specs</Link></li>
                <li><Link to="/activate" className="hover:text-black dark:hover:text-white transition-colors">Activate Hardware</Link></li>
                <li><Link to="/warranty" className="hover:text-black dark:hover:text-white transition-colors">Warranty Lookup</Link></li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <p className="font-mono font-bold text-black dark:text-white uppercase tracking-wider text-[11px]">Support</p>
              <ul className="space-y-2">
                <li><Link to="/support" className="hover:text-black dark:hover:text-white transition-colors">Engineering Desk</Link></li>
                <li><a href={`mailto:${settings.supportEmail}`} className="hover:text-black dark:hover:text-white transition-colors">{settings.supportEmail}</a></li>
                <li><span className="text-zinc-500 dark:text-zinc-400">{settings.supportPhone}</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-zinc-200/80 dark:border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500 dark:text-zinc-400">
          <p>© {new Date().getFullYear()} {settings.siteName}. All rights reserved.</p>
          <p>Local-first ESP32 smart home platform.</p>
        </div>
      </div>
    </footer>
  );
}
