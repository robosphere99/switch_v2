export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <span className="inline-flex items-center select-none tracking-tight">
      <span className={`${text} font-black text-black dark:text-white uppercase tracking-tighter`}>
        SWITCH
      </span>
      <span className={`${text} font-light text-zinc-500 dark:text-zinc-400 uppercase tracking-tight ml-0.5`}>
        NEST
      </span>
    </span>
  );
}
