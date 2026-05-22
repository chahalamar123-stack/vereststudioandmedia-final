const crypto = require("crypto");

const COOKIE_NAME = "everest_admin_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "contact@evereststudioandmedia.com").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET || "everest-admin-dev-secret";

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(value) {
  return crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(value).digest("base64url");
}

function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce((cookies, segment) => {
      const index = segment.indexOf("=");

      if (index === -1) {
        return cookies;
      }

      const key = segment.slice(0, index).trim();
      const value = decodeURIComponent(segment.slice(index + 1));
      cookies[key] = value;
      return cookies;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  let cookie = `${name}=${encodeURIComponent(value)}`;

  if (options.maxAge !== undefined) {
    cookie += `; Max-Age=${options.maxAge}`;
  }

  if (options.path) {
    cookie += `; Path=${options.path}`;
  }

  if (options.httpOnly) {
    cookie += "; HttpOnly";
  }

  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite}`;
  }

  if (options.secure) {
    cookie += "; Secure";
  }

  return cookie;
}

function createSessionToken(email) {
  const payload = {
    email,
    exp: Date.now() + SESSION_DURATION_MS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split(".");
  const expectedSignature = sign(encodedPayload);

  if (!safeCompare(expectedSignature, providedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));

    if (!payload?.email || payload.exp < Date.now()) {
      return null;
    }

    if (String(payload.email).toLowerCase() !== ADMIN_EMAIL) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function isAdminAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[COOKIE_NAME];
  return Boolean(verifySessionToken(token));
}

function setAdminSession(res) {
  const token = createSessionToken(ADMIN_EMAIL);
  const secure =
    String(process.env.COOKIE_SECURE || process.env.NODE_ENV === "production").toLowerCase() === "true";

  res.setHeader(
    "Set-Cookie",
    serializeCookie(COOKIE_NAME, token, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure,
      maxAge: Math.floor(SESSION_DURATION_MS / 1000)
    })
  );
}

function clearAdminSession(res) {
  const secure =
    String(process.env.COOKIE_SECURE || process.env.NODE_ENV === "production").toLowerCase() === "true";

  res.setHeader(
    "Set-Cookie",
    serializeCookie(COOKIE_NAME, "", {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure,
      maxAge: 0
    })
  );
}

function requireAdminApi(req, res, next) {
  if (!isAdminAuthenticated(req)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized."
    });
  }

  return next();
}

function requireAdminPage(req, res, next) {
  if (!isAdminAuthenticated(req)) {
    return res.redirect("/admin");
  }

  return next();
}

function credentialsMatch(email, password) {
  if (!ADMIN_PASSWORD) {
    return false;
  }

  return safeCompare(String(email).trim().toLowerCase(), ADMIN_EMAIL) && safeCompare(password, ADMIN_PASSWORD);
}

module.exports = {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  clearAdminSession,
  credentialsMatch,
  isAdminAuthenticated,
  requireAdminApi,
  requireAdminPage,
  setAdminSession
};
