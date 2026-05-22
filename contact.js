export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { name, phone, email, message } = req.body;

  if (!name || !phone || !email || !message) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error("RESEND_API_KEY is not set.");
    return res.status(500).json({ error: "Server configuration error." });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Everest Studio & Media <onboarding@resend.dev>",
        to: ["contact@evereststudioandmedia.com"],
        reply_to: email,
        subject: `New Inquiry from ${name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
            <h2 style="margin-bottom: 4px;">New Inquiry — Everest Studio &amp; Media</h2>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin-bottom: 24px;" />

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: 600; width: 120px; vertical-align: top;">Name</td>
                <td style="padding: 8px 0;">${escapeHtml(name)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; vertical-align: top;">Phone</td>
                <td style="padding: 8px 0;">${escapeHtml(phone)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; vertical-align: top;">Email</td>
                <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(email)}" style="color: #2d6a4f;">${escapeHtml(email)}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; vertical-align: top;">Message</td>
                <td style="padding: 8px 0; white-space: pre-wrap;">${escapeHtml(message)}</td>
              </tr>
            </table>

            <hr style="border: none; border-top: 1px solid #e0e0e0; margin-top: 24px;" />
            <p style="font-size: 12px; color: #888; margin-top: 8px;">
              Sent from the contact form at EverestStudioandMedia.com
            </p>

            <div style="margin-top: 16px;">
              <a href="mailto:${escapeHtml(email)}?subject=Re: Your Everest Studio %26 Media Inquiry"
                 style="display: inline-block; background: #2d6a4f; color: #fff; padding: 10px 20px;
                        border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
                Reply to ${escapeHtml(name)}
              </a>
            </div>
          </div>
        `,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Resend error:", result);
      return res.status(500).json({ error: "Failed to send email. Please try again." });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "An unexpected error occurred." });
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
