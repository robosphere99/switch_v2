import React from "react";

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  isHeader?: boolean;
}

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className = "", isHeader = false, children, ...props }, ref) => {
    if (isHeader) {
      return (
        <th
          ref={ref as React.Ref<HTMLTableHeaderCellElement>}
          className={`px-4 py-3 text-xs font-semibold text-night-500 dark:text-gray-400 ${className}`}
          {...props}
        >
          {children}
        </th>
      );
    }

    return (
      <td
        ref={ref}
        className={`px-4 py-3.5 text-sm text-night-950 dark:text-gray-200 align-middle ${className}`}
        {...props}
      >
        {children}
      </td>
    );
  }
);

TableCell.displayName = "TableCell";
