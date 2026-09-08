import type { StorageEngine } from "multer";
import path from "node:path";
import fs from "node:fs";
import * as os from "os";
import { findWritableUploadsDir, getCandidateUploadDirs, uploadsDir } from "./paths";

/**
 * 100% Local Server Disk Storage Engine
 * Directly saves uploads to Plesk server disk in uploads/<folderName>/<filename>
 * URL returned: /uploads/<folderName>/<filename>
 */
export function createLocalStorage(folderName: string): StorageEngine {
  return {
    _handleFile(
      _req,
      file,
      cb
    ) {
      const ext = path.extname(file.originalname).toLowerCase();
      const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
      const safeName = `${Date.now()}-${base}${ext}`;

      const chunks: Buffer[] = [];
      file.stream.on("data", (chunk) => chunks.push(chunk));
      file.stream.on("error", (err) => cb(err));
      file.stream.on("end", () => {
        const buffer = Buffer.concat(chunks);
        let savedPath = "";

        try {
          const writableBase = findWritableUploadsDir(folderName);
          const targetFolder = path.join(writableBase, folderName);
          try { fs.mkdirSync(targetFolder, { recursive: true }); } catch {}
          const filePath = path.join(targetFolder, safeName);
          fs.writeFileSync(filePath, buffer);
          savedPath = filePath;
        } catch {
          try {
            const fallbackFolder = path.join(os.tmpdir(), "switchnest-uploads", folderName);
            fs.mkdirSync(fallbackFolder, { recursive: true });
            const emergencyPath = path.join(fallbackFolder, safeName);
            fs.writeFileSync(emergencyPath, buffer);
            savedPath = emergencyPath;
          } catch (err: any) {
            return cb(err);
          }
        }

        const publicUrl = `/uploads/${folderName}/${safeName}`;
        cb(null, {
          path: publicUrl,
          filename: safeName,
          size: buffer.length,
          destination: path.dirname(savedPath),
        } as any);
      });
    },
    _removeFile(_req, file, cb) {
      try {
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch {}
      cb(null);
    },
  };
}

export const cloudinaryAvatarStorage = createLocalStorage("avatars");
export const cloudinaryProductStorage = createLocalStorage("products");
export const cloudinarySupportStorage = createLocalStorage("support");
export const cloudinaryBillingStorage = createLocalStorage("billing");

