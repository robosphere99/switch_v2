import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "success" | "warning" | "danger" | "info" | "neutral";
  size?: "sm" | "md";
  dot?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = "", variant = "neutral", size = "sm", dot = false, children, ...props }, ref) => {
    const sizeStyles = {
      sm: "px-2.5 py-0.5 text-[11px]",
      md: "px-3 py-1 text-xs",
    };

    const dotStyles = {
      primary: "bg-brand",
      success: "bg-emerald-500",
      warning: "bg-amber-500",
      danger: "bg-rose-500",
      info: "bg-sky-500",
      neutral: "bg-slate-400 dark:bg-slate-500",
    };

    const variantStyles = {
      primary: "bg-white/10 text-white border border-white/20 dark:bg-white/10 dark:text-white dark:border-white/20",
      success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
      warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
      danger: "bg-rose-500/10 text-rose-400 border border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
      info: "bg-zinc-800 text-zinc-300 border border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
      neutral: "bg-zinc-900 text-zinc-300 border border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:border-white/10",
    };

    return (
      <span
        ref={ref}
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors duration-150 ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {dot && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotStyles[variant]}`} />}
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";
