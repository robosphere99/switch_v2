import React from "react";

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <div className="relative w-full overflow-auto rounded-xl border border-night-600 bg-white dark:bg-night-800 shadow-sm">
        <table ref={ref} className={`w-full caption-bottom text-sm text-left ${className}`} {...props}>
          {children}
        </table>
      </div>
    );
  }
);

Table.displayName = "Table";
