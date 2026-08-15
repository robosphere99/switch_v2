import { FileText, Download } from "lucide-react";

function extFrom(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isImage(att: { type: string; name: string }): boolean {
  return att.type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(extFrom(att.name));
}

/**
 * Support chat attachment render — naya storage (attachmentPath → URL se server se file)
 * ya legacy (attachmentData → base64 data-URL). url milta hai to wahi use hota hai.
 */
export function AttachmentBubble({
  name,
  type,
  data,
  url,
}: {
  name: string;
  type: string;
  data?: string | null;
  url?: string | null;
}) {
  const src = url || (data ? `data:${type};base64,${data}` : null);
  if (!src) return null;
  return (
    <div className="mt-1.5">
      {isImage({ type, name }) ? (
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-lg border border-black/10"
          title={`${name} — kholo (naya tab)`}
        >
          <img src={src} alt={name} className="max-h-40 w-auto object-contain" />
        </a>
      ) : (
        <a
          href={src}
          download={name}
          className="flex max-w-[240px] items-center gap-2 rounded-lg border border-black/10 bg-black/5 px-2.5 py-1.5 text-xs font-medium hover:bg-black/10"
          title="Download file"
        >
          <FileText className="h-4 w-4 shrink-0" />
          <span className="truncate">{name}</span>
          <Download className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </a>
      )}
    </div>
  );
}
