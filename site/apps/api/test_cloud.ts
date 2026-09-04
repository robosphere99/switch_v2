import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

cloudinary.uploader.upload("test_image_dl.jpg", { folder: "switchnest/avatars" })
  .then(res => console.log("SUCCESS:", res.secure_url))
  .catch(err => console.error("ERROR:", JSON.stringify(err, null, 2)));
