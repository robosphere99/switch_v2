import { v2 as cloudinary } from "cloudinary";
import path from "node:path";
import fs from "node:fs";
import { uploadsDir } from "./paths";

function getCloudinaryConfig() {
  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dpztk9gmx",
    api_key: process.env.CLOUDINARY_API_KEY || "392994953367882",
    api_secret: process.env.CLOUDINARY_API_SECRET || "__9ZhaW-GuJUH2b0dOsG8TTPIzs",
  };
}

cloudinary.config(getCloudinaryConfig());

/**
 * Smart hybrid storage engine:
 * 1. Uploads to Cloudinary for ultra-fast CDN delivery.
 * 2. If Cloudinary has issues or is offline, safely falls back to local disk storage (/uploads/...).
 * 3. Never crashes or causes 500 upload failures.
 */
export function createSmartStorage(folderName: string) {
  return {
    _handleFile(_req: unknown, file: Express.Multer.File, cb: (error: Error | null, info?: { path: string; filename: string; size: number; url: string }) => void) {
      cloudinary.config(getCloudinaryConfig());

      const chunks: Buffer[] = [];
      file.stream.on("data", (c) => chunks.push(c));
      file.stream.on("end", async () => {
        const buffer = Buffer.concat(chunks);
        const isImage = file.mimetype.startsWith("image/");
        const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

        // Attempt 1: Cloudinary
        try {
          const result = await new Promise<{ secure_url?: string; url?: string }>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                folder: `switchnest/${folderName}`,
                public_id: safeName.replace(/\.[^.]+$/, ""),
                resource_type: "auto",
                ...(isImage ? { transformation: [{ quality: "auto:eco", width: 1280, crop: "limit" }] } : {}),
              },
              (err, res) => {
                if (err) reject(err);
                else resolve(res ?? {});
              }
            );
            uploadStream.end(buffer);
          });

          if (result && (result.secure_url || result.url)) {
            const finalUrl = result.secure_url || result.url!;
            return cb(null, {
              path: finalUrl,
              filename: safeName,
              size: buffer.length,
              url: finalUrl,
            });
          }
        } catch (cloudErr) {
          console.warn(`[storage] Cloudinary upload note for ${folderName}, falling back to local disk:`, cloudErr);
        }

        // Attempt 2: Local Disk Fallback
        try {
          const targetFolder = path.join(uploadsDir, folderName);
          fs.mkdirSync(targetFolder, { recursive: true });
          const targetPath = path.join(targetFolder, safeName);
          fs.writeFileSync(targetPath, buffer);

          const publicUrl = `/uploads/${folderName}/${safeName}`;
          return cb(null, {
            path: publicUrl,
            filename: safeName,
            size: buffer.length,
            url: publicUrl,
          });
        } catch (diskErr) {
          return cb(diskErr instanceof Error ? diskErr : new Error(String(diskErr)));
        }
      });
      file.stream.on("error", (err) => cb(err));
    },
    _removeFile(_req: unknown, _file: unknown, cb: (error: Error | null) => void) {
      cb(null);
    },
  };
}

export const cloudinaryAvatarStorage = createSmartStorage("avatars");
export const cloudinaryProductStorage = createSmartStorage("products");
export const cloudinarySupportStorage = createSmartStorage("support");
export const cloudinaryBillingStorage = createSmartStorage("billing");

export default cloudinary;
