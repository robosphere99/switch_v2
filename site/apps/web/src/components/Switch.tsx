import type { DeviceType } from "@robosphere/shared";

/** iOS-style toggle switch — capsule track + sliding knob. Brand blue ON, gray OFF. */
export function Switch({
  checked,
  onChange,
  disabled,
  pending,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  /** True = command bheji gayi, ESP confirm nahi hua abhi — pulse + disabled. */
  pending?: boolean;
  /** Accessibility ke liye (screen reader). */
  label?: string;
}) {
  const blocked = disabled || pending;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={pending ? `${label ?? ""} (pending)` : label}
      onClick={onChange}
      disabled={blocked}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-night-800 ${
        checked ? "bg-brand" : "bg-gray-300 dark:bg-night-600"
      } ${pending ? "animate-pulse" : ""} ${blocked ? "cursor-wait opacity-60" : ""}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/** Device icon map — DeviceCard aur MyBoards dono me use hota hai. */
export const TYPE_ICONS: Record<DeviceType, string> = {
  bulb: "💡",
  fan: "🌀",
  ac: "❄️",
  tv: "📺",
  plug: "🔌",
  custom: "⚙️",
};
