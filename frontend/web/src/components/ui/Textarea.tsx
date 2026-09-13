import React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", label, error, helperText, id, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-medium text-night-500 dark:text-gray-400">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-night-950 placeholder-gray-400 transition-all duration-150 outline-none
            dark:bg-night-800 dark:text-gray-100 dark:placeholder-gray-500
            ${
              error
                ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/15 dark:border-red-500/50"
                : "border-night-600 focus:border-brand focus:ring-2 focus:ring-brand/15 dark:border-night-600 dark:focus:border-brand"
            }
            disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        {!error && helperText && <p className="text-xs text-night-500 dark:text-gray-400">{helperText}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
