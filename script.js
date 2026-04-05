function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function handleInquiryForm() {
  const form = document.querySelector("[data-inquiry-form]");
  const status = document.querySelector("[data-inquiry-status]");

  if (!form || !status) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("inquiry-name")?.value.trim() || "";
    const phone = document.getElementById("inquiry-phone")?.value.trim() || "";
    const email = document.getElementById("inquiry-email")?.value.trim() || "";
    const message = document.getElementById("inquiry-message")?.value.trim() || "";

    if (!name || !phone || !email || !message) {
      status.textContent = "Please complete each field.";
      status.dataset.state = "error";
      return;
    }

    status.textContent = "Sending inquiry...";
    status.dataset.state = "pending";

    try {
      const response = await fetch("/submit-inquiry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name, phone, email, message })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to submit inquiry.");
      }

      form.reset();
      status.textContent = "Inquiry received. It is saved to your dashboard and you can reply from Amar@EverestStudioandmedia.com.";
      status.dataset.state = "success";
    } catch (error) {
      status.textContent = error.message;
      status.dataset.state = "error";
    }
  });
}

async function handleLoginForm() {
  const form = document.querySelector("[data-login-form]");
  const status = document.querySelector("[data-login-status]");

  if (!form || !status) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username")?.value.trim() || "";
    const password = document.getElementById("password")?.value.trim() || "";

    if (!username || !password) {
      status.textContent = "Enter a username and password.";
      status.dataset.state = "error";
      return;
    }

    status.textContent = "Checking credentials...";
    status.dataset.state = "pending";

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Login failed.");
      }

      window.location.href = "/admin";
    } catch (error) {
      status.textContent = error.message;
      status.dataset.state = "error";
    }
  });
}

async function loadAdminDashboard() {
  const list = document.querySelector("[data-inquiries-list]");
  const empty = document.querySelector("[data-inquiries-empty]");
  const logoutButton = document.querySelector("[data-logout-button]");
  const refreshButton = document.querySelector("[data-refresh-button]");

  if (!list || !empty || !logoutButton) {
    return;
  }

  logoutButton.addEventListener("click", () => {
    window.location.href = "/logout";
  });

  async function renderInquiries() {
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.textContent = "Refreshing...";
    }

    try {
      const response = await fetch("/admin/inquiries", {
        headers: {
          Accept: "application/json"
        }
      });

      if (response.status === 403) {
        window.location.href = "/login.html";
        return;
      }

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load inquiries.");
      }

      if (!payload.inquiries.length) {
        empty.hidden = false;
        empty.textContent = "No inquiries yet.";
        list.innerHTML = "";
        return;
      }

      empty.hidden = true;
      list.innerHTML = payload.inquiries
        .map(
          (inquiry) => `
            <article class="admin-card">
              <div class="admin-card-head">
                <h3>${escapeHTML(inquiry.name)}</h3>
                <time>${escapeHTML(new Date(inquiry.created_at).toLocaleString())}</time>
              </div>
              <div class="admin-contact-links">
                ${
                  inquiry.phone
                    ? `<a class="admin-contact-link" href="tel:${escapeHTML(inquiry.phone)}">${escapeHTML(inquiry.phone)}</a>`
                    : ""
                }
                <a class="admin-contact-link" href="mailto:${escapeHTML(inquiry.email)}">${escapeHTML(inquiry.email)}</a>
              </div>
              <p class="admin-message">${escapeHTML(inquiry.message)}</p>
              <div class="admin-card-actions">
                <a class="button button-secondary" href="mailto:${escapeHTML(inquiry.email)}?subject=${encodeURIComponent(
                  `Reply from Everest Studio & Media`
                )}">Reply by email</a>
                ${
                  inquiry.phone
                    ? `<a class="button button-secondary" href="tel:${escapeHTML(inquiry.phone)}">Call contact</a>`
                    : ""
                }
              </div>
            </article>
          `
        )
        .join("");
    } catch (error) {
      empty.hidden = false;
      empty.textContent = error.message;
    } finally {
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.textContent = "Refresh";
      }
    }
  }

  refreshButton?.addEventListener("click", renderInquiries);
  await renderInquiries();
}

document.addEventListener("DOMContentLoaded", () => {
  handleInquiryForm();
  handleLoginForm();
  loadAdminDashboard();
});
