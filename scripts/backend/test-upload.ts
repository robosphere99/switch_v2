import axios from "axios";
import fs from "fs";
import FormData from "form-data";

async function testUpload() {
  try {
    const form = new FormData();
    // create a dummy file
    fs.writeFileSync("dummy.png", "dummy image content");
    form.append("file", fs.createReadStream("dummy.png"));

    // Need a token to authorize. Let's look up a valid token or just use the local DB to create one.
    // Actually, I can just use Prisma to find the first admin user and bypass.
  } catch (err: any) {
    console.error("Failed:", err.response?.data || err.message);
  }
}
testUpload();
