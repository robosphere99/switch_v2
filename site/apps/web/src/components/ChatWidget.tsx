import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { askAssistant, type AssistantReply } from "../api/public";

interface Msg {
  role: "user" | "bot";
  text: string;
  products?: AssistantReply["products"];
  chips?: string[];
}

const WELCOME: Msg = {
  role: "bot",
  text: "Namaste! 🙏 Main SwitchNest ka assistant hoon. Batao aapko kya chahiye — main sahi board suggest karta hoon aur site ka har sawaal jawab deta hoon.",
  chips: [
    "Kis board ki zaroorat hai?",
    "Site kaise kaam karti hai?",
    "WiFi setup kaise hota hai?",
    "Dimmer chahiye",
    "Warranty kya milti hai?",
  ],
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [unread, setUnread] = useState(true);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setInput("");
    setBusy(true);
    try {
      const r = await askAssistant(t);
      setMsgs((m) => [...m, { role: "bot", text: r.reply, products: r.products, chips: r.chips }]);
    } catch {
      setMsgs((m) => [...m, { role: "bot", text: "Oops — kuch gadbad ho gayi. Thodi der baad try karo ya contact form bharke bhejo. 🙂" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => {
          setOpen((o) => !o);
          setUnread(false);
        }}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl shadow-lg shadow-brand/40 transition hover:scale-110"
        aria-label="SwitchNest assistant"
        title="SwitchNest AI assistant"
      >
        {open ? "✕" : "🤖"}
        {!open && unread && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-red-500" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[480px] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-brand/30 bg-night-800 shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-brand/20 bg-night-900/60 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-lg">
              🤖
            </span>
            <div>
              <div className="text-sm font-bold text-night-950">SwitchNest Assistant</div>
              <div className="text-[11px] text-green-400">● Online — turant reply</div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-sm text-white"
                      : "max-w-[85%] rounded-2xl rounded-bl-sm border border-brand/20 bg-night-700 px-3 py-2 text-sm text-gray-700"
                  }
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>
                </div>
              </div>
            ))}

            {msgs.length > 0 && msgs[msgs.length - 1].products && msgs[msgs.length - 1].products!.length > 0 && (
              <div className="space-y-2">
                {msgs[msgs.length - 1].products!.map((p) => (
                  <Link
                    key={p.id}
                    to={`/shop?product=${p.id}`}
                    className="block rounded-xl border border-brand/25 bg-night-700 p-3 transition hover:border-brand"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-night-950">{p.name}</span>
                      <span className="text-sm font-bold text-brand">₹{Number(p.price).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      {p.modelCode} · {p.reason}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-brand/20 bg-night-700 px-3 py-2 text-sm text-gray-500">
                  typing…
                </div>
              </div>
            )}

            {/* Suggestion chips */}
            {!busy && msgs.length > 0 && msgs[msgs.length - 1].chips && msgs[msgs.length - 1].chips!.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {msgs[msgs.length - 1].chips!.slice(0, 4).map((c) => (
                  <button
                    key={c}
                    onClick={() => send(c)}
                    className="rounded-full border border-brand/30 bg-night-700 px-3 py-1 text-[11px] text-brand transition hover:bg-brand hover:text-white"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-brand/20 p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(input)}
                placeholder="Message… (Hindi/English dono)"
                className="flex-1 rounded-lg border border-brand/30 bg-night-700 px-3 py-2 text-sm text-night-950 placeholder-gray-500 focus:outline-none focus:border-brand"
              />
              <button
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
