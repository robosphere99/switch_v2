import { Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

export interface NavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  title?: string;
  onClick?: () => void;
  badge?: React.ReactNode;
}

export function NavItem({ to, label, icon: Icon, title, onClick, badge }: NavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== "/" && location.pathname.startsWith(`${to}/`));

  return (
    <Link
      to={to}
      onClick={onClick}
      title={title ?? label}
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150
        ${
          isActive
            ? "bg-brand/10 text-brand dark:bg-brand/15 dark:text-brand-light font-semibold shadow-xs"
            : "text-night-500 hover:bg-night-700 hover:text-night-950 dark:text-gray-400 dark:hover:bg-night-700 dark:hover:text-gray-100"
        }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-brand" : "text-gray-400 dark:text-gray-500"}`} />
      <span>{label}</span>
      {badge && <span className="ml-auto">{badge}</span>}
    </Link>
  );
}
