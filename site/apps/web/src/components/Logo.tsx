import { Zap } from "lucide-react";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "h-10 w-10 rounded-xl" : size === "sm" ? "h-7 w-7 rounded-lg" : "h-8 w-8 rounded-lg";
  const bolt = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const text = size === "lg" ? "text-2xl" : "text-lg";
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`${box} inline-flex items-center justify-center bg-gradient-to-br from-brand to-brand-light shadow-md shadow-brand/30`}
      >
        <Zap className={`${bolt} text-white`} strokeWidth={2.5} />
      </span>
      <span className={`${text} font-extrabold tracking-tight`}>
        <span className="bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
          RoboSphere
        </span>
      </span>
    </span>
  );
}
