import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

async function test() {
  const loginRes = await fetch("http://localhost:4000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "admin", password: "password123" }) // assuming default
  });
  const data = await loginRes.json();
  if (!data.token) {
    console.error("Login failed:", data);
    return;
  }
  
  const token = data.token;
  console.log("Got token.");
  
  const formData = new FormData();
  const fileBlob = new Blob(["test"], { type: "image/png" });
  formData.append("file", fileBlob, "test.png");
  
  const uploadRes = await fetch("http://localhost:4000/api/auth/me/avatar", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`
    },
    body: formData
  });
  
  const resData = await uploadRes.json();
  console.log("Upload result:", uploadRes.status, resData);
}
test();
