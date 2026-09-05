import { Fragment } from "react";

/**
 * `**bold**` mini-markdown ko <strong> me convert karta hai.
 * React elements me render hota hai (dangerouslySetInnerHTML nahi) — safe hai,
 * koi HTML injection possible nahi. Sirf ** pairs support karte hain, jo
 * assistant ke replies me use hote hain.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split("**");
  return (
    <div className={className}>
      {parts.map((part, i) =>
        // Odd index = ** ke beech ka segment = bold. Agar closing pair nahi hai
        // (i + 1 last hai), to plain hi rakho — unbalanced ** ko bold mat banao.
        i % 2 === 1 && i + 1 < parts.length ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>,
      )}
    </div>
  );
}
