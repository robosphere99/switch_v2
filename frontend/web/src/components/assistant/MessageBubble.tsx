import type { AssistantMessage } from "../../api/assistant";
import { RichText } from "../RichText";
import { Button } from "../ui/Button";
import { CheckCircle2 } from "lucide-react";

export interface MessageBubbleProps {
  message: AssistantMessage;
  confirming: boolean;
  onConfirm: () => void;
}

export function MessageBubble({
  message,
  confirming,
  onConfirm,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition-all ${
          isUser
            ? "rounded-br-sm bg-brand text-white shadow-brand/20"
            : "rounded-bl-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        }`}
      >
        <RichText text={message.content} className="whitespace-pre-line" />

        {!isUser && message.proposal && message.proposal.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Suggested Device Actions
            </p>
            <div className="space-y-1.5">
              {message.proposal.map((p) => (
                <div
                  key={p.deviceId}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs border border-slate-200/60 dark:bg-slate-800/50 dark:border-slate-700/50"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{p.deviceName}</span>
                  <span
                    className={`rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase ${
                      p.action === "on"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                    }`}
                  >
                    {p.action}
                  </span>
                </div>
              ))}
            </div>

            <Button
              size="sm"
              variant="primary"
              onClick={onConfirm}
              disabled={confirming}
              loading={confirming}
              className="w-full mt-2"
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              {confirming ? "Executing commands..." : "Confirm & Execute Action"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
