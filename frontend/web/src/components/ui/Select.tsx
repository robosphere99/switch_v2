import React from "react";
import { ChevronDown } from "lucide-react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", label, error, helperText, children, id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-night-500 dark:text-gray-400">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            className={`w-full appearance-none rounded-xl border bg-white px-3.5 py-2.5 pr-9 text-sm text-night-950 transition-all duration-150 outline-none
              dark:bg-night-800 dark:text-gray-100
              ${
                error
                  ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/15 dark:border-red-500/50"
                  : "border-night-600 focus:border-brand focus:ring-2 focus:ring-brand/15 dark:border-night-600 dark:focus:border-brand"
              }
              disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>
        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        {!error && helperText && <p className="text-xs text-night-500 dark:text-gray-400">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
