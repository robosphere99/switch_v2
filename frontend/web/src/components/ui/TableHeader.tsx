import React from "react";

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <thead
        ref={ref}
        className={`border-b border-night-600 bg-night-700/60 text-xs font-semibold uppercase tracking-wider text-night-500 dark:bg-night-700 dark:text-gray-400 ${className}`}
        {...props}
      >
        {children}
      </thead>
    );
  }
);

TableHeader.displayName = "TableHeader";
