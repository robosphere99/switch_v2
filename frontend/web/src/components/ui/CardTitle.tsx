import React from "react";

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <h3 ref={ref} className={`text-lg font-semibold tracking-tight text-night-950 dark:text-white ${className}`} {...props}>
        {children}
      </h3>
    );
  }
);

CardTitle.displayName = "CardTitle";
