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
    };
  },
});

export const cloudinaryProductStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: "switchnest/products",
      public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9]/g, "_")}`,
    };
  },
});

export const cloudinarySupportStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: "switchnest/support",
      public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9]/g, "_")}`,
      resource_type: "auto", // allow images, pdf, zip, etc.
    };
  },
});

export const cloudinaryBillingStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: "switchnest/billing",
      public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9]/g, "_")}`,
    };
  },
});

export default cloudinary;
