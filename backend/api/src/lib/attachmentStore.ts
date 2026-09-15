import * as fs from "fs";
import * as path from "path";
import { uploadsDir, attachmentDir } from "./paths";

/**
 * Support chat attachment files — DB me base64 blob ki jagah sirf URL / filename
 * (attachmentPath) rehta hai; asli bytes yahan disk pe (backend/api/uploads/support or hardware/attachments).
 * Random filename + path-traversal guard. File per message — delete pe cleanup.
 */

/** Allowed extension se fallback (name ka ext na ho to type se). */
function extFor(type: string, name: string): string {
  const fromName = name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  if (type.startsWith("image/png")) return "png";
  if (type.startsWith("image/jpeg")) return "jpg";
  if (type.startsWith("image/gif")) return "gif";
  if (type.startsWith("image/webp")) return "webp";
  if (type.startsWith("image/heic")) return "heic";
  if (type === "application/pdf") return "pdf";
  if (type === "text/plain") return "txt";
  return "bin";
}

/** Base64 blob → disk pe save in uploads/support/. Returns URL /uploads/support/<filename>. */
export async function saveAttachment(base64: string, type: string, name: string): Promise<string> {
  const buf = Buffer.from(base64, "base64");
  if (buf.length === 0) throw new Error("Empty file");

  const targetDir = path.join(uploadsDir, "support");
  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch {}

  const ext = extFor(type, name);
  const base = path.basename(name, `.${ext}`).replace(/[^a-zA-Z0-9_-]/g, "_") || "attachment";
  const safeName = `${Date.now()}-${base}.${ext}`;
  const fullPath = path.join(targetDir, safeName);

  fs.writeFileSync(fullPath, buf);
  return `/uploads/support/${safeName}`;
}

/** Disk se file read — checks uploads/support and attachmentDir. Not found → null. */
export function readAttachmentFile(filename: string): Buffer | null {
  const safe = path.basename(filename);
  if (!safe) return null;

  const candidatePaths = [
    path.join(uploadsDir, "support", safe),
    path.join(attachmentDir, safe),
  ];
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p);
    } catch {}
  }
  return null;
}

/** File delete (message soft-delete pe cleanup). Missing file = silent. */
export function deleteAttachmentFile(filename: string | null): void {
  if (!filename) return;
  if (filename.startsWith("http://") || filename.startsWith("https://")) return;
  const safe = path.basename(filename);
  if (!safe) return;
  const candidatePaths = [
    path.join(uploadsDir, "support", safe),
    path.join(attachmentDir, safe),
  ];
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
}
