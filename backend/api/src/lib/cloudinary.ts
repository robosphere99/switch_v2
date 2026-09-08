import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { uploadsDir } from "./paths";

/**
 * 100% Local Server Disk Storage
 * Directly saves uploads to Plesk server disk in backend/api/uploads/<folderName>/
 * URL returned: /uploads/<folderName>/<filename>
 */
export function createLocalStorage(folderName: string) {
  const targetDir = path.join(uploadsDir, folderName);
  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch {}

  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
      } catch {}
      cb(null, targetDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
      const safeName = `${Date.now()}-${base}${ext}`;
      cb(null, safeName);
    },
  });
}

export const cloudinaryAvatarStorage = createLocalStorage("avatars");
export const cloudinaryProductStorage = createLocalStorage("products");
export const cloudinarySupportStorage = createLocalStorage("support");
export const cloudinaryBillingStorage = createLocalStorage("billing");
