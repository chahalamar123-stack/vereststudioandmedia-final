import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { name, phone, email, message } = req.body;

  if (!name || !phone || !email || !message) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const id = `inquiry:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
  const inquiry = {
    id,
    name,
    phone,
    email,
    message,
    created_at: new Date().toISOString(),
  };

  await kv.lpush("inquiries", JSON.stringify(inquiry));

  return res.status(200).json({ success: true });
}
