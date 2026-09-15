import React from "react";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "danger";
  title?: string;
  onClose?: () => void;
}

export function Alert({
  className = "",
  variant = "info",
  title,
  children,
  onClose,
  ...props
}: AlertProps) {
  const icons = {
    info: <Info className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />,
    success: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
    danger: <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />,
  };

  const variantStyles = {
    info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200",
    warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200",
    danger: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200",
  };

  return (
    <div
      role="alert"
      className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-sm ${variantStyles[variant]} ${className}`}
      {...props}
    >
      <div className="flex items-start gap-3">
        {icons[variant]}
        <div className="space-y-1">
          {title && <h5 className="font-semibold leading-none tracking-tight">{title}</h5>}
          <div className="text-xs opacity-90 leading-relaxed">{children}</div>
        </div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Close alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
