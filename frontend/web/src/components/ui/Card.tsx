import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", hoverEffect = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/[0.08] dark:bg-zinc-950/80 backdrop-blur-sm transition-all duration-200 ${
          hoverEffect ? "hover:-translate-y-0.5 hover:shadow-md dark:hover:border-white/20 dark:hover:bg-zinc-950" : ""
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
