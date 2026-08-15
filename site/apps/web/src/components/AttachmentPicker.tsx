import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import type { SupportAttachment } from "../api/admin";

const MAX_BYTES = 2 * 1024 * 1024;

const EXT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
  txt: "text/plain",
};

/** Support chat ke liye file attach (photo/invoice/screenshot) — ek file per message, max 2MB. */
export function AttachmentPicker({
  value,
  onChange,
}: {
  value: SupportAttachment | null;
  onChange: (att: SupportAttachment | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(f: File) {
    setErr(null);
    if (f.size > MAX_BYTES) {
      setErr("File 2MB se bada hai — chhota file chuno.");
      return;
    }
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    const type = f.type || EXT_TYPES[ext] || "";
    if (!EXT_TYPES[ext] && !type.startsWith("image/")) {
      setErr("Sirf image (png/jpg/webp/heic), PDF ya text file.");
      return;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
      r.onerror = reject;
      r.readAsDataURL(f);
    });
    onChange({ name: f.name, type, data });
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="File attach karo (photo/invoice/screenshot)"
        className="rounded-lg border border-gray-300 p-2 text-gray-600 transition hover:border-brand hover:text-brand"
      >
        <ImagePlus className="h-4 w-4" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {value && (
        <span className="flex max-w-[220px] items-center gap-1 rounded-lg bg-brand/10 px-2 py-1 text-xs text-brand">
          <span className="truncate">{value.name}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            title="File hatao"
            className="shrink-0 hover:text-red-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      )}
      {err && <span className="text-xs text-red-500">{err}</span>}
    </div>
  );
}
