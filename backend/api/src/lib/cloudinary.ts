import type { StorageEngine } from "multer";
import path from "node:path";
import fs from "node:fs";
import { getCandidateUploadDirs, uploadsDir } from "./paths";

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
        const candidateDirs = getCandidateUploadDirs();
        let savedPath = "";
        let writeError: Error | null = null;

        for (const baseDir of candidateDirs) {
          try {
            const targetFolder = path.join(baseDir, folderName);
            if (!fs.existsSync(targetFolder)) {
              try {
                fs.mkdirSync(targetFolder, { recursive: true });
              } catch {
                /* directory may already exist or cannot be created */
              }
            }
            const filePath = path.join(targetFolder, safeName);
            fs.writeFileSync(filePath, buffer);
            savedPath = filePath;
            break;
          } catch (err) {
            writeError = err as Error;
          }
        }

        if (!savedPath) {
          // Final fallback to process.cwd()/uploads/<folderName>
          try {
            const fallbackFolder = path.join(process.cwd(), "uploads", folderName);
            if (!fs.existsSync(fallbackFolder)) {
              try { fs.mkdirSync(fallbackFolder, { recursive: true }); } catch {}
            }
            const filePath = path.join(fallbackFolder, safeName);
            fs.writeFileSync(filePath, buffer);
            savedPath = filePath;
          } catch (fallbackErr) {
            return cb(writeError || (fallbackErr as Error));
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

