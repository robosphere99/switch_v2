import React from "react";

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={`border-b border-night-600/60 transition-colors duration-150 hover:bg-night-700/40 dark:hover:bg-night-700/30 ${className}`}
        {...props}
      >
        {children}
      </tr>
    );
  }
);

TableRow.displayName = "TableRow";
