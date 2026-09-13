import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", loading = false, disabled, icon, leftIcon, rightIcon, children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 select-none focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";

    const sizeStyles = {
      sm: "text-xs px-3 py-1.5 gap-1.5",
      md: "text-sm px-4 py-2 gap-2",
      lg: "text-base px-5 py-2.5 gap-2.5",
    };

    const variantStyles = {
      primary:
        "bg-white text-black font-semibold shadow-sm hover:bg-zinc-200 active:bg-zinc-300 dark:bg-white dark:text-black dark:hover:bg-zinc-200 focus:ring-white/30",
      secondary:
        "border border-white/10 bg-zinc-900/90 text-zinc-100 hover:bg-zinc-800 hover:border-white/20 dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:bg-zinc-800 focus:ring-white/20",
      outline:
        "border border-zinc-700 bg-transparent text-zinc-200 hover:border-zinc-500 hover:text-white dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-white focus:ring-white/20",
      ghost:
        "bg-transparent text-zinc-400 hover:text-white hover:bg-white/[0.06] dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.06] focus:ring-white/20",
      danger:
        "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 focus:ring-red-500/30",
    };

    const renderedLeftIcon = leftIcon || icon;

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-current shrink-0" />
        ) : (
          renderedLeftIcon && <span className="shrink-0">{renderedLeftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
