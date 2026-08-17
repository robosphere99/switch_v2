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
  onClick,
}: {
  text: string;
  children: ReactNode;
  className?: string;
  title?: string;
  onClick?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const copy = useCallback(() => {
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    };
    const fallback = () => {
      // Clipboard API na mile ya fail ho (iframe/embedded context) —
      // purana execCommand fallback se bhi copy ho jaye.
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      } catch {
        /* copy fail — silent */
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else {
      fallback();
    }
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

  const onRightClick = useCallback(
    (e: React.MouseEvent) => {
      // Right-click = turant copy (browser menu ki jagah).
      e.preventDefault();
      copy();
    },
    [copy],
  );

  const handleClick = useCallback(() => {
    // Long-press (hold) se copy hua tha — release pe jo click fire hua wo
    // copy gesture ka hissa hai, details/modal mat kholo (warna modal screen
    // cover kar leta hai aur copy "fail" lagti hai). Agli tap pe normal click.
    if (fired.current) {
      fired.current = false;
      return;
    }
    onClick?.();
  }, [onClick]);

  return (
    <span
      className={`${className} inline-flex cursor-pointer select-none items-center gap-1`}
      title={title}
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
      onDragStart={(e) => e.preventDefault()}
      onContextMenu={onRightClick}
      onClick={handleClick}
    >
      {children}
      {copied && <span className="text-[10px] font-bold text-green-400">✓ copied</span>}
    </span>
  );
}
