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

import { v2 as cloudinary } from "cloudinary";

/** Base64 blob → disk pe save ya Cloudinary pe. Returns URL. */
export async function saveAttachment(base64: string, type: string, name: string): Promise<string> {
  const buf = Buffer.from(base64, "base64");
  if (buf.length === 0) throw new Error("Empty file");
  
  // Use data URI for Cloudinary upload
  const dataUri = `data:${type || extFor(type, name)};base64,${base64}`;
  const isImage = dataUri.startsWith("data:image/");
  
  const res = await cloudinary.uploader.upload(dataUri, {
    folder: "switchnest/support",
    ...(isImage && {
      format: "webp",
      transformation: [{ quality: "auto:eco", width: 1280, crop: "limit" }],
    }),
  });
  
  return res.secure_url;
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
