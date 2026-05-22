import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = req.cookies?.admin_session;
  if (session !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden." });
  }

  const raw = await kv.lrange("inquiries", 0, 99);
  const inquiries = raw.map((item) =>
    typeof item === "string" ? JSON.parse(item) : item
  );

  return res.status(200).json({ inquiries });
}
