import React from "react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-night-600 bg-white/40 dark:bg-night-800/30 ${className}`}
    >
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-night-700 text-night-500 mb-4 dark:bg-night-700 dark:text-gray-400">
          {icon}
        </div>
      )}
      <h4 className="text-base font-semibold text-night-950 dark:text-white">
        {title}
      </h4>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-night-500 dark:text-gray-400 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
