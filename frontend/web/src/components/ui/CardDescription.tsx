import React from "react";

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <p ref={ref} className={`text-xs text-night-500 dark:text-gray-400 ${className}`} {...props}>
        {children}
      </p>
    );
  }
);

CardDescription.displayName = "CardDescription";
