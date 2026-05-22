const INQUIRY_SUCCESS_MESSAGE = "Your inquiry has been submitted successfully.";
const INQUIRY_FAILURE_MESSAGE = "There was an issue submitting your inquiry.";
const ADMIN_STATUS_OPTIONS = ["New", "Contacted", "Closed"];

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function readJsonSafely(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function truncateMessage(value, maxLength = 96) {
  if (!value || value.length <= maxLength) {
    return value || "";
  }

  return `${value.slice(0, maxLength).trimEnd()}...`;
}

async function handleInquiryForm() {
  const form = document.querySelector("[data-inquiry-form]");
  const status = document.querySelector("[data-inquiry-status]");
  const submitButton = form?.querySelector('button[type="submit"]');

  if (!form || !status || !submitButton) {
    return;
  }

  const defaultButtonLabel = submitButton.textContent.trim();

  function setSubmitting(isSubmitting) {
    form.setAttribute("aria-busy", String(isSubmitting));
    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? "Submitting..." : defaultButtonLabel;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = {
      name: document.getElementById("inquiry-name")?.value.trim() || "",
      phone: document.getElementById("inquiry-phone")?.value.trim() || "",
      email: document.getElementById("inquiry-email")?.value.trim() || "",
      message: document.getElementById("inquiry-message")?.value.trim() || ""
    };

    if (!formData.name || !formData.phone || !formData.email || !formData.message) {
      status.textContent = "Please complete each field.";
      status.dataset.state = "error";
      return;
    }

    status.textContent = "Submitting inquiry...";
    status.dataset.state = "pending";
    setSubmitting(true);

    try {
      const response = await fetch("/api/inquiry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      const payload = await readJsonSafely(response);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || INQUIRY_FAILURE_MESSAGE);
      }

      form.reset();
      status.textContent = INQUIRY_SUCCESS_MESSAGE;
      status.dataset.state = "success";
    } catch (error) {
      console.error("Inquiry submission failed:", error);
      status.textContent = INQUIRY_FAILURE_MESSAGE;
      status.dataset.state = "error";
    } finally {
      setSubmitting(false);
    }
  });
}

async function handleLoginForm() {
  const form = document.querySelector("[data-admin-login-form]");
  const status = document.querySelector("[data-login-status]");

  if (!form || !status) {
    return;
  }

  try {
    const sessionResponse = await fetch("/api/admin/session", {
      headers: { Accept: "application/json" }
    });
    const sessionPayload = await readJsonSafely(sessionResponse);

    if (sessionPayload?.authenticated) {
      window.location.href = "/admin/dashboard";
      return;
    }
  } catch {
    // ignore pre-check failure and allow manual login
  }

  const submitButton = form.querySelector('button[type="submit"]');
  const defaultButtonLabel = submitButton?.textContent.trim() || "Login";

  function setSubmitting(isSubmitting) {
    form.setAttribute("aria-busy", String(isSubmitting));

    if (submitButton) {
      submitButton.disabled = isSubmitting;
      submitButton.textContent = isSubmitting ? "Signing in..." : defaultButtonLabel;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("admin-email")?.value.trim() || "";
    const password = document.getElementById("admin-password")?.value || "";

    if (!email || !password) {
      status.textContent = "Enter your email and password.";
      status.dataset.state = "error";
      return;
    }

    status.textContent = "Checking credentials...";
    status.dataset.state = "pending";
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const payload = await readJsonSafely(response);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Login failed.");
      }

      window.location.href = payload.redirectTo || "/admin/dashboard";
    } catch (error) {
      status.textContent = error.message || "Login failed.";
      status.dataset.state = "error";
    } finally {
      setSubmitting(false);
    }
  });
}

function initSmartHeader() {
  const header = document.querySelector(".site-header");

  if (!header) {
    return;
  }

  let lastScrollY = window.scrollY;
  let ticking = false;

  function updateHeader() {
    const currentScrollY = window.scrollY;
    const scrollingDown = currentScrollY > lastScrollY;
    const shouldHide = scrollingDown && currentScrollY > 140;

    header.classList.toggle("is-hidden", shouldHide);

    if (currentScrollY <= 24) {
      header.classList.remove("is-hidden");
    }

    lastScrollY = currentScrollY;
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(updateHeader);
    },
    { passive: true }
  );
}

async function loadAdminDashboard() {
  const dashboard = document.querySelector("[data-admin-dashboard]");

  if (!dashboard) {
    return;
  }

  const body = dashboard.querySelector("[data-admin-table-body]");
  const empty = dashboard.querySelector("[data-admin-empty]");
  const searchInput = dashboard.querySelector("[data-admin-search]");
  const statusFilter = dashboard.querySelector("[data-admin-status-filter]");
  const refreshButton = dashboard.querySelector("[data-refresh-button]");
  const logoutButton = dashboard.querySelector("[data-logout-button]");
  const sourceLabel = dashboard.querySelector("[data-admin-source]");
  const totalStat = dashboard.querySelector("[data-stat-total]");
  const newStat = dashboard.querySelector("[data-stat-new]");
  const contactedStat = dashboard.querySelector("[data-stat-contacted]");
  const closedStat = dashboard.querySelector("[data-stat-closed]");
  const dialog = dashboard.querySelector("[data-inquiry-dialog]");
  const dialogName = dashboard.querySelector("[data-dialog-name]");
  const dialogMeta = dashboard.querySelector("[data-dialog-meta]");
  const dialogMessage = dashboard.querySelector("[data-dialog-message]");
  const dialogClose = dashboard.querySelector("[data-dialog-close]");
  const toolbarStatus = dashboard.querySelector("[data-admin-toolbar-status]");

  const state = {
    inquiries: [],
    filtered: [],
    search: "",
    status: "All"
  };

  function setToolbarMessage(message, tone = "pending") {
    if (!toolbarStatus) {
      return;
    }

    toolbarStatus.textContent = message;
    toolbarStatus.dataset.state = tone;
  }

  function updateStats(stats) {
    if (totalStat) totalStat.textContent = stats.total;
    if (newStat) newStat.textContent = stats.New;
    if (contactedStat) contactedStat.textContent = stats.Contacted;
    if (closedStat) closedStat.textContent = stats.Closed;
  }

  function applyFilters() {
    const normalizedSearch = state.search.toLowerCase();

    state.filtered = state.inquiries.filter((inquiry) => {
      const matchesStatus = state.status === "All" ? true : inquiry.status === state.status;

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

    renderTable();
  }

  function renderTable() {
    if (!body || !empty) {
      return;
    }

    if (!state.filtered.length) {
      body.innerHTML = "";
      empty.hidden = false;
      empty.textContent = "No inquiries match the current filter.";
      return;
    }

    empty.hidden = true;
    body.innerHTML = state.filtered
      .map((inquiry) => {
        const statusOptions = ADMIN_STATUS_OPTIONS.map(
          (option) =>
            `<option value="${option}" ${option === inquiry.status ? "selected" : ""}>${option}</option>`
        ).join("");

        return `
          <tr>
            <td data-label="Name">
              <div class="admin-table-primary">${escapeHTML(inquiry.name)}</div>
            </td>
            <td data-label="Phone">
              <a class="admin-table-link" href="tel:${escapeHTML(inquiry.phone)}">${escapeHTML(inquiry.phone)}</a>
            </td>
            <td data-label="Email">
              <a class="admin-table-link" href="mailto:${escapeHTML(inquiry.email)}">${escapeHTML(inquiry.email)}</a>
            </td>
            <td data-label="Message">
              <span class="admin-message-preview">${escapeHTML(truncateMessage(inquiry.message))}</span>
            </td>
            <td data-label="Status">
              <span class="status-pill status-pill-${inquiry.status.toLowerCase()}">${escapeHTML(inquiry.status)}</span>
            </td>
            <td data-label="Submitted">${escapeHTML(formatDate(inquiry.createdAt))}</td>
            <td data-label="Actions">
              <div class="admin-row-actions">
                <button class="button button-secondary button-compact" type="button" data-view-inquiry="${inquiry.id}">View</button>
                <label class="admin-status-control">
                  <span class="sr-only">Change status</span>
                  <select data-status-select="${inquiry.id}">
                    ${statusOptions}
                  </select>
                </label>
                <button class="button button-secondary button-compact button-danger" type="button" data-delete-inquiry="${inquiry.id}">Delete</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function openInquiryDialog(inquiry) {
    if (!dialog || !dialogName || !dialogMeta || !dialogMessage) {
      return;
    }

    dialogName.textContent = inquiry.name;
    dialogMeta.innerHTML = `
      <a class="admin-table-link" href="mailto:${escapeHTML(inquiry.email)}">${escapeHTML(inquiry.email)}</a>
      <span>•</span>
      <a class="admin-table-link" href="tel:${escapeHTML(inquiry.phone)}">${escapeHTML(inquiry.phone)}</a>
      <span>•</span>
      <span>${escapeHTML(inquiry.status)}</span>
      <span>•</span>
      <time>${escapeHTML(formatDate(inquiry.createdAt))}</time>
    `;
    dialogMessage.textContent = inquiry.message;

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "open");
    }
  }

  function closeInquiryDialog() {
    if (!dialog) {
      return;
    }

    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  async function fetchInquiries() {
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.textContent = "Refreshing...";
    }

    setToolbarMessage("Loading inquiries...", "pending");

    try {
      const response = await fetch("/api/admin/inquiries", {
        headers: { Accept: "application/json" }
      });
      const payload = await readJsonSafely(response);

      if (response.status === 401) {
        window.location.href = "/admin";
        return;
      }

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Unable to load inquiries.");
      }

      state.inquiries = payload.inquiries || [];
      state.search = searchInput?.value.trim() || "";
      state.status = statusFilter?.value || "All";
      updateStats(payload.stats || { total: 0, New: 0, Contacted: 0, Closed: 0 });
      if (sourceLabel) {
        sourceLabel.textContent = payload.database === "postgres" ? "PostgreSQL" : "SQLite fallback";
      }
      applyFilters();
      setToolbarMessage(`${state.inquiries.length} inquiries loaded.`, "success");
    } catch (error) {
      console.error("Unable to load inquiries:", error);
      state.inquiries = [];
      applyFilters();
      setToolbarMessage(error.message || "Unable to load inquiries.", "error");
    } finally {
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.textContent = "Refresh";
      }
    }
  }

  async function updateStatus(id, status) {
    setToolbarMessage("Updating status...", "pending");

    const response = await fetch(`/api/admin/inquiries/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });
    const payload = await readJsonSafely(response);

    if (response.status === 401) {
      window.location.href = "/admin";
      return;
    }

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || "Unable to update inquiry.");
    }

    state.inquiries = state.inquiries.map((inquiry) =>
      inquiry.id === payload.inquiry.id ? payload.inquiry : inquiry
    );
    updateStats({
      total: state.inquiries.length,
      New: state.inquiries.filter((item) => item.status === "New").length,
      Contacted: state.inquiries.filter((item) => item.status === "Contacted").length,
      Closed: state.inquiries.filter((item) => item.status === "Closed").length
    });
    applyFilters();
    setToolbarMessage("Inquiry status updated.", "success");
  }

  async function deleteInquiryById(id) {
    setToolbarMessage("Deleting inquiry...", "pending");

    const response = await fetch(`/api/admin/inquiries/${id}`, {
      method: "DELETE"
    });
    const payload = await readJsonSafely(response);

    if (response.status === 401) {
      window.location.href = "/admin";
      return;
    }

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || "Unable to delete inquiry.");
    }

    state.inquiries = state.inquiries.filter((inquiry) => inquiry.id !== id);
    updateStats({
      total: state.inquiries.length,
      New: state.inquiries.filter((item) => item.status === "New").length,
      Contacted: state.inquiries.filter((item) => item.status === "Contacted").length,
      Closed: state.inquiries.filter((item) => item.status === "Closed").length
    });
    applyFilters();
    closeInquiryDialog();
    setToolbarMessage("Inquiry deleted.", "success");
  }

  searchInput?.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    applyFilters();
  });

  statusFilter?.addEventListener("change", (event) => {
    state.status = event.target.value;
    applyFilters();
  });

  refreshButton?.addEventListener("click", () => {
    void fetchInquiries();
  });

  logoutButton?.addEventListener("click", async () => {
    await fetch("/api/admin/logout", {
      method: "POST"
    });
    window.location.href = "/admin";
  });

  body?.addEventListener("click", async (event) => {
    const viewButton = event.target.closest("[data-view-inquiry]");
    const deleteButton = event.target.closest("[data-delete-inquiry]");

    if (viewButton) {
      const inquiry = state.inquiries.find((item) => item.id === Number(viewButton.dataset.viewInquiry));

      if (inquiry) {
        openInquiryDialog(inquiry);
      }

      return;
    }

    if (deleteButton) {
      const inquiryId = Number(deleteButton.dataset.deleteInquiry);
      const inquiry = state.inquiries.find((item) => item.id === inquiryId);
      const confirmed = window.confirm(
        `Delete the inquiry from ${inquiry?.name || "this contact"}? This cannot be undone.`
      );

      if (!confirmed) {
        return;
      }

      try {
        await deleteInquiryById(inquiryId);
      } catch (error) {
        setToolbarMessage(error.message || "Unable to delete inquiry.", "error");
      }
    }
  });

  body?.addEventListener("change", async (event) => {
    const statusSelect = event.target.closest("[data-status-select]");

    if (!statusSelect) {
      return;
    }

    try {
      await updateStatus(Number(statusSelect.dataset.statusSelect), statusSelect.value);
    } catch (error) {
      setToolbarMessage(error.message || "Unable to update inquiry.", "error");
    }
  });

  dialogClose?.addEventListener("click", closeInquiryDialog);
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeInquiryDialog();
    }
  });

  await fetchInquiries();
}

document.addEventListener("DOMContentLoaded", () => {
  initSmartHeader();
  handleInquiryForm();
  handleLoginForm();
  void loadAdminDashboard();
});
