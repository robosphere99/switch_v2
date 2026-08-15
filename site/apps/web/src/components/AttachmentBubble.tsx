import { FileText, Download } from "lucide-react";

function extFrom(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function dataUrl(att: { type: string; data: string }): string {
  return `data:${att.type};base64,${att.data}`;
}

function isImage(att: { type: string; name: string }): boolean {
  return att.type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(extFrom(att.name));
}

/** Support chat message me attachment render (image preview ya file chip + download). */
export function AttachmentBubble({ name, type, data }: { name: string; type: string; data: string }) {
  if (!data) return null;
  return (
    <div className="mt-1.5">
      {isImage({ type, name }) ? (
        <a
          href={dataUrl({ type, data })}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-lg border border-black/10"
          title={`${name} — kholo (naya tab)`}
        >
          <img src={dataUrl({ type, data })} alt={name} className="max-h-40 w-auto object-contain" />
        </a>
      ) : (
        <a
          href={dataUrl({ type, data })}
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
