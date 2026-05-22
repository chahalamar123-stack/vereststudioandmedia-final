export default async function handler(req, res) {
  res.setHeader(
    "Set-Cookie",
    "admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
  );
  res.writeHead(302, { Location: "/login.html" });
  res.end();
}
