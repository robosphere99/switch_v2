import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const cloudinaryAvatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: "switchnest/avatars",
      public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9]/g, "_")}`,
      format: "webp",
      transformation: [{ quality: "auto:eco", width: 800, crop: "limit" }],
    };
  },
});

export const cloudinaryProductStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: "switchnest/products",
      public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9]/g, "_")}`,
      format: "webp",
      transformation: [{ quality: "auto:eco", width: 1280, crop: "limit" }],
    };
  },
});

export const cloudinarySupportStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isImage = file.mimetype.startsWith("image/");
    return {
      folder: "switchnest/support",
      public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9]/g, "_")}`,
      resource_type: "auto",
      ...(isImage && {
        format: "webp",
        transformation: [{ quality: "auto:eco", width: 1280, crop: "limit" }],
      }),
    };
  },
});

export const cloudinaryBillingStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isImage = file.mimetype.startsWith("image/");
    return {
      folder: "switchnest/billing",
      public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9]/g, "_")}`,
      resource_type: "auto",
      ...(isImage && {
        format: "webp",
        transformation: [{ quality: "auto:eco", width: 1280, crop: "limit" }],
      }),
    };
  },
});

export default cloudinary;
