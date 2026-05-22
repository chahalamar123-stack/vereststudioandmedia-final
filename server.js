const path = require("path");
const express = require("express");

const {
  ALLOWED_STATUSES,
  createInquiry,
  deleteInquiry,
  initDatabase,
  listInquiries,
  summarizeInquiries,
  updateInquiryStatus,
  usesPostgres
} = require("./lib/database");
const {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  clearAdminSession,
  credentialsMatch,
  isAdminAuthenticated,
  requireAdminApi,
  requireAdminPage,
  setAdminSession
} = require("./lib/auth");
const { checkRateLimit } = require("./lib/rate-limit");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

if (!ADMIN_PASSWORD) {
  console.warn("ADMIN_PASSWORD is not configured. Set it in your environment variables before using /admin.");
}


function jsonResponse(res, payload, status = 200) {
  return res.status(status).json(payload);
}

function methodNotAllowed(res) {
  return jsonResponse(
    res,
    {
      success: false,
      error: "Method not allowed."
    },
    405
  );
}

function normalizeString(value, maxLength = 2000) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function normalizeMessage(value) {
  return String(value || "").trim().slice(0, 4000);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseId(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}

function enforceRateLimit(req, res, bucket, options) {
  const key = `${bucket}:${getClientIp(req)}`;
  const result = checkRateLimit(key, options);

  if (!result.allowed) {
    res.setHeader("Retry-After", Math.ceil(result.retryAfterMs / 1000));
    jsonResponse(
      res,
      {
        success: false,
        error: "Too many requests. Please try again shortly."
      },
      429
    );
    return false;
  }

  return true;
}

function filterInquiries(inquiries, search, status) {
  const normalizedSearch = normalizeString(search, 160).toLowerCase();
  const normalizedStatus = ALLOWED_STATUSES.includes(status) ? status : "All";

  return inquiries.filter((inquiry) => {
    const matchesStatus = normalizedStatus === "All" ? true : inquiry.status === normalizedStatus;

    if (!matchesStatus) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const haystack = [inquiry.name, inquiry.email, inquiry.phone, inquiry.message, inquiry.status]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });
}

async function handleInquirySubmission(req, res) {
  if (!enforceRateLimit(req, res, "inquiry", { limit: 8, windowMs: 15 * 60 * 1000 })) {
    return;
  }

  const inquiry = {
    name: normalizeString(req.body?.name, 160),
    phone: normalizeString(req.body?.phone, 60),
    email: normalizeString(req.body?.email, 160).toLowerCase(),
    message: normalizeMessage(req.body?.message)
  };

  if (!inquiry.name || !inquiry.phone || !inquiry.email || !inquiry.message) {
    return jsonResponse(
      res,
      {
        success: false,
        error: "All fields are required."
      },
      400
    );
  }

  if (!isValidEmail(inquiry.email)) {
    return jsonResponse(
      res,
      {
        success: false,
        error: "Please provide a valid email address."
      },
      400
    );
  }

  try {
    const savedInquiry = await createInquiry(inquiry);

    return jsonResponse(res, {
      success: true,
      message: "Your inquiry has been submitted successfully.",
      inquiry: {
        id: savedInquiry.id,
        status: savedInquiry.status,
        createdAt: savedInquiry.createdAt
      }
    });
  } catch (error) {
    console.error("Failed to save inquiry:", error);
    return jsonResponse(
      res,
      {
        success: false,
        error: "There was an issue submitting your inquiry."
      },
      500
    );
  }
}

async function handleAdminLogin(req, res) {
  if (!enforceRateLimit(req, res, "admin-login", { limit: 6, windowMs: 15 * 60 * 1000 })) {
    return;
  }

  const email = normalizeString(req.body?.email, 160).toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return jsonResponse(
      res,
      {
        success: false,
        error: "Email and password are required."
      },
      400
    );
  }

  if (!credentialsMatch(email, password)) {
    return jsonResponse(
      res,
      {
        success: false,
        error: "Invalid credentials."
      },
      401
    );
  }

  setAdminSession(res);

  return jsonResponse(res, {
    success: true,
    message: "Login successful.",
    redirectTo: "/admin/dashboard"
  });
}

app.get("/admin", (req, res) => {
  if (isAdminAuthenticated(req)) {
    return res.redirect("/admin/dashboard");
  }

  return res.sendFile(path.join(PUBLIC_DIR, "login.html"));
});

app.get("/admin/dashboard", requireAdminPage, (_req, res) => {
  return res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

app.get("/login", (_req, res) => res.redirect("/admin"));
app.get("/login.html", (_req, res) => res.redirect("/admin"));
app.get("/admin.html", (_req, res) => res.redirect("/admin/dashboard"));

app.use(express.static(PUBLIC_DIR));

app.post("/api/inquiry", (req, res) => {
  void handleInquirySubmission(req, res);
});
app.all("/api/inquiry", (_req, res) => methodNotAllowed(res));

app.post("/api/admin/login", (req, res) => {
  void handleAdminLogin(req, res);
});
app.all("/api/admin/login", (_req, res) => methodNotAllowed(res));

app.get("/api/admin/session", (req, res) => {
  return jsonResponse(res, {
    success: true,
    authenticated: isAdminAuthenticated(req),
    adminEmail: ADMIN_EMAIL
  });
});

app.post("/api/admin/logout", (_req, res) => {
  clearAdminSession(res);
  return jsonResponse(res, {
    success: true,
    message: "Logged out."
  });
});
app.all("/api/admin/logout", (_req, res) => methodNotAllowed(res));

app.get("/api/admin/inquiries", requireAdminApi, async (req, res) => {
  try {
    const inquiries = await listInquiries();
    const filtered = filterInquiries(inquiries, req.query?.search, req.query?.status || "All");

    return jsonResponse(res, {
      success: true,
      inquiries: filtered,
      stats: summarizeInquiries(inquiries),
      database: usesPostgres() ? "postgres" : "sqlite"
    });
  } catch (error) {
    console.error("Failed to load inquiries:", error);
    return jsonResponse(
      res,
      {
        success: false,
        error: "Failed to load inquiries."
      },
      500
    );
  }
});
app.all("/api/admin/inquiries", (_req, res) => methodNotAllowed(res));

app.patch("/api/admin/inquiries/:id", requireAdminApi, async (req, res) => {
  const inquiryId = parseId(req.params.id);
  const status = normalizeString(req.body?.status, 24);

  if (!inquiryId) {
    return jsonResponse(res, { success: false, error: "Invalid inquiry id." }, 400);
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    return jsonResponse(res, { success: false, error: "Invalid inquiry status." }, 400);
  }

  try {
    const inquiry = await updateInquiryStatus(inquiryId, status);

    if (!inquiry) {
      return jsonResponse(res, { success: false, error: "Inquiry not found." }, 404);
    }

    return jsonResponse(res, {
      success: true,
      inquiry
    });
  } catch (error) {
    console.error("Failed to update inquiry status:", error);
    return jsonResponse(res, { success: false, error: "Failed to update inquiry." }, 500);
  }
});

app.delete("/api/admin/inquiries/:id", requireAdminApi, async (req, res) => {
  const inquiryId = parseId(req.params.id);

  if (!inquiryId) {
    return jsonResponse(res, { success: false, error: "Invalid inquiry id." }, 400);
  }

  try {
    const deleted = await deleteInquiry(inquiryId);

    if (!deleted) {
      return jsonResponse(res, { success: false, error: "Inquiry not found." }, 404);
    }

    return jsonResponse(res, {
      success: true,
      message: "Inquiry deleted."
    });
  } catch (error) {
    console.error("Failed to delete inquiry:", error);
    return jsonResponse(res, { success: false, error: "Failed to delete inquiry." }, 500);
  }
});

app.all("/api/admin/inquiries/:id", (_req, res) => methodNotAllowed(res));

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`Inquiry database mode: ${usesPostgres() ? "PostgreSQL" : "SQLite fallback"}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize the inquiry database:", error);
    process.exit(1);
  });
