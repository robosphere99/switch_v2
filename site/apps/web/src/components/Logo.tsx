export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "h-11 w-11" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const text = size === "lg" ? "text-2xl" : "text-lg";
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 64 64" className={`${box} drop-shadow-md drop-shadow-brand/30`} aria-hidden>
        <defs>
          <linearGradient id="snGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2563eb" />
            <stop offset="1" stopColor="#60a5fa" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#snGrad)" />
        {/* House */}
        <path d="M32 12 L53 29 H47 V49 H17 V29 H11 Z" fill="#ffffff" />
        {/* Power toggle inside the house */}
        <rect x="29.5" y="26" width="5" height="11" rx="2.5" fill="#2563eb" />
        <circle cx="32" cy="40" r="7" fill="none" stroke="#2563eb" strokeWidth="4.4" />
      </svg>
      <span className={`${text} font-extrabold tracking-tight`}>
        <span className="bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
          SwitchNest
        </span>
      </span>
    </span>
  );
}
