import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { getSupportMessages, sendSupportMessage, type SupportAttachment } from "../api/admin";
import { Modal } from "./Modal";
import { AttachmentPicker } from "./AttachmentPicker";
import { AttachmentBubble } from "./AttachmentBubble";

/** Admin <-> user support chat — find-anything se khulta hai. */
export function SupportChatModal({
  userId,
  username,
  onClose,
}: {
  userId: number;
  username: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<SupportAttachment | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const chat = useQuery({
    queryKey: ["admin-support-chat", userId],
    queryFn: () => getSupportMessages(userId),
    refetchInterval: 5000,
  });

  const send = useMutation({
    mutationFn: (args: { message: string; attachment: SupportAttachment | null }) =>
      sendSupportMessage(userId, args.message, args.attachment),
    onSuccess: () => {
      setDraft("");
      setAttachment(null);
      queryClient.invalidateQueries({ queryKey: ["admin-support-chat", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-find"] });
    },
  });

  const msgs = chat.data?.success ? chat.data.data.messages : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  // Thread padha → server ne readByAdmin mark kiya → navbar badge turant drop
  useEffect(() => {
    if (chat.data?.success) {
      queryClient.invalidateQueries({ queryKey: ["support", "admin", "unread"] });
    }
  }, [chat.data, queryClient]);

  return (
    <Modal title={`💬 Support chat — ${username}`} onClose={onClose}>
      <div className="flex h-80 flex-col gap-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3">
        {chat.isLoading && <p className="m-auto text-sm text-gray-500">Loading…</p>}
        {!chat.isLoading && msgs.length === 0 && (
          <p className="m-auto text-sm text-gray-500">Koi message nahi — pehla message bhejo 👇</p>
        )}
        {msgs.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              m.senderRole === "admin"
                ? "self-end rounded-br-sm bg-brand text-white"
                : "self-start rounded-bl-sm border border-gray-200 bg-white text-gray-800"
            }`}
          >
            <div className="text-[10px] font-bold uppercase opacity-70">{m.senderName}</div>
            {m.message && <div className="whitespace-pre-wrap">{m.message}</div>}
            {m.attachmentName && m.attachmentType && m.attachmentData && (
              <AttachmentBubble name={m.attachmentName} type={m.attachmentType} data={m.attachmentData} />
            )}
            <div className="mt-0.5 text-right text-[10px] opacity-60">{new Date(m.createdAt).toLocaleString()}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft.trim();
          if (t || attachment) send.mutate({ message: t, attachment });
        }}
        className="mt-3 flex gap-2"
      >
        <AttachmentPicker value={attachment} onChange={setAttachment} />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="User ko message likho… (Enter se bhejo)"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={send.isPending || (!draft.trim() && !attachment)}
          className="rounded-lg bg-brand px-4 py-2 text-white disabled:opacity-40"
          title="Bhejo"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
      {send.isError && <p className="mt-2 text-xs text-red-500">Bhejne me dikkat — dobara try karo.</p>}
    </Modal>
  );
}
