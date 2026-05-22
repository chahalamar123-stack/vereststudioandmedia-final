export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { username, password } = req.body;

  const validUser = process.env.ADMIN_USERNAME;
  const validPass = process.env.ADMIN_PASSWORD;
  const secret   = process.env.ADMIN_SECRET;

  if (!validUser || !validPass || !secret) {
    return res.status(500).json({ error: "Server not configured." });
  }

  if (username !== validUser || password !== validPass) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  res.setHeader(
    "Set-Cookie",
    `admin_session=${secret}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
  );

  return res.status(200).json({ success: true });
}
