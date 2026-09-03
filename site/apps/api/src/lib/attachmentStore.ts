import * as fs from "fs";
import * as path from "path";
import { attachmentDir } from "./paths";

/**
 * Support chat attachment files — DB me base64 blob ki jagah sirf filename
 * (attachmentPath) rehta hai; asli bytes yahan disk pe (hardware/attachments).
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

/** Base64 blob → disk pe save. Returns random filename. */
export function saveAttachment(base64: string, type: string, name: string): string {
  const buf = Buffer.from(base64, "base64");
  if (buf.length === 0) throw new Error("Empty file");
  const filename = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}.${extFor(type, name)}`;
  fs.mkdirSync(attachmentDir, { recursive: true });
  fs.writeFileSync(path.join(attachmentDir, filename), buf);
  return filename;
}

/** Disk se file read — basename check (path traversal guard). Not found → null. */
export function readAttachmentFile(filename: string): Buffer | null {
  const safe = path.basename(filename);
  if (safe !== filename) return null;
  try {
    return fs.readFileSync(path.join(attachmentDir, safe));
  } catch {
    return null;
  }
}

/** File delete (message soft-delete pe cleanup). Missing file = silent. */
export function deleteAttachmentFile(filename: string | null): void {
  if (!filename) return;
  if (filename.startsWith("http://") || filename.startsWith("https://")) return;
  const safe = path.basename(filename);
  if (safe !== filename) return;
  try {
    fs.unlinkSync(path.join(attachmentDir, safe));
  } catch {
    /* ignore */
  }
}
