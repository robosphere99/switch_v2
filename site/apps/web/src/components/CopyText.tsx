import { useCallback, useRef, useState, type ReactNode } from "react";

/**
 * Long-press (hold 500ms) se text copy hota hai — order numbers, serial codes
 * wagairah ke liye. Mobile (touch) aur desktop (mouse hold) dono pe kaam karta
 * hai. Copy hone pe "✓ copied" dikhta hai.
 */
export function CopyText({
  text,
  children,
  className = "",
  title = "Hold to copy",
}: {
  text: string;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const copy = useCallback(() => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => undefined);
  }, [text]);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(() => {
    fired.current = false;
    clearTimer();
    timer.current = window.setTimeout(() => {
      fired.current = true;
      copy();
    }, 500);
  }, [clearTimer, copy]);

  const end = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  return (
    <span
      className={`${className} inline-flex cursor-pointer select-none items-center gap-1`}
      title={title}
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
      onDragStart={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
      {copied && <span className="text-[10px] font-bold text-green-400">✓ copied</span>}
    </span>
  );
}
