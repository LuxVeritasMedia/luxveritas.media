const formCopy = {
  request: {
    kicker: "Request Access",
    title: "Screened Access",
    copy: "For events, partnerships, private links, and portal consideration.",
    tag: "request-access"
  },
  submission: {
    kicker: "Submissions",
    title: "Artist and Creator Intake",
    copy: "Send a concise signal. The review path is selective by design.",
    tag: "submission"
  },
  press: {
    kicker: "Press / Partners",
    title: "Institutional Contact",
    copy: "For press, venues, distribution, investor, and brand partnership inquiries.",
    tag: "press"
  },
  event: {
    kicker: "Event RSVP",
    title: "Request Invitation",
    copy: "Event access is screened. Tell us which room you are approaching.",
    tag: "event-interest"
  },
  codex: {
    kicker: "Codex Request",
    title: "Codex Access Request",
    copy: "Inner and Sanctum access require review, alignment, and approval.",
    tag: "codex-request"
  },
  fan: {
    kicker: "Membership",
    title: "Join the List",
    copy: "Get release signals and selected Lux Veritas updates.",
    tag: "membership-waitlist"
  }
};

const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const dialog = document.querySelector("[data-dialog]");
const dialogForm = dialog?.querySelector(".dialog-shell");
const statusBox = document.querySelector("[data-form-status]");
const portalSigninForm = document.querySelector("[data-portal-signin-form]");
const contactEmail = "info@luxveritas.media";
const submitEndpoint = "/api/submit";
let activeFormType = "request";

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail in private browsing or locked-down browsers. Form handoff still works.
  }
}

function getStoredValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Non-critical: consent and local event history are best-effort only.
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function submissionSubject(payload) {
  const label = formCopy[payload.formType]?.title || "Lux Veritas Website Inquiry";
  return `${label} - ${payload.name || "Website visitor"}`;
}

function submissionBody(payload) {
  return [
    "Lux Veritas website submission",
    "",
    `Name: ${payload.name || ""}`,
    `Email: ${payload.email || ""}`,
    `Phone: ${payload.phone || ""}`,
    `Role path: ${payload.role_path || ""}`,
    `Inquiry type: ${payload.inquiry_type || ""}`,
    `Form type: ${payload.formType || ""}`,
    `Source page: ${payload.source_page || ""}`,
    `Timestamp: ${payload.timestamp || ""}`,
    `Email consent: ${payload.consent_email ? "yes" : "no"}`,
    `SMS consent: ${payload.consent_sms ? "yes" : "no"}`,
    "",
    "Message:",
    payload.message || ""
  ].join("\n");
}

function mailtoHref(payload) {
  const subject = encodeURIComponent(submissionSubject(payload));
  const body = encodeURIComponent(submissionBody(payload));
  return `mailto:${contactEmail}?subject=${subject}&body=${body}`;
}

async function copySubmissionToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard permission is optional. The visible mail link remains the fallback.
  }
  return false;
}

async function submitToServer(payload) {
  const response = await fetch(submitEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) {
    throw new Error(result.error || "form_relay_failed");
  }
  return result;
}

function setScrolledHeader() {
  header?.classList.toggle("scrolled", window.scrollY > 24);
}

function openForm(type) {
  activeFormType = type in formCopy ? type : "request";
  const config = formCopy[activeFormType];
  document.querySelector("[data-form-kicker]").textContent = config.kicker;
  document.querySelector("[data-form-title]").textContent = config.title;
  document.querySelector("[data-form-copy]").textContent = config.copy;
  statusBox.hidden = true;
  statusBox.textContent = "";
  if (!dialog.open) dialog.showModal();
}

function trackEvent(name, detail = {}) {
  const consent = getStoredValue("luxveritas_consent");
  const payload = {
    event: name,
    page: window.location.pathname,
    detail,
    timestamp: new Date().toISOString(),
    consent
  };
  const events = readJson("luxveritas_events", []);
  events.push(payload);
  writeJson("luxveritas_events", events.slice(-100));
  window.dataLayer = window.dataLayer || [];
  if (consent === "accepted") window.dataLayer.push(payload);
}

async function handleFormSubmit(event) {
  event.preventDefault();
  if (!dialogForm.reportValidity()) return;

  const submitButton = dialogForm.querySelector("[data-submit-form]");
  submitButton.disabled = true;
  submitButton.textContent = "Preparing email...";

  const data = Object.fromEntries(new FormData(dialogForm).entries());
  if (data.company_url) {
    submitButton.disabled = false;
    submitButton.textContent = "Send to Lux Veritas";
    return;
  }

  const payload = {
    ...data,
    source: "luxveritas.media",
    source_page: window.location.pathname,
    formType: activeFormType,
    tag: formCopy[activeFormType].tag,
    timestamp: new Date().toISOString()
  };
  const body = submissionBody(payload);
  const href = mailtoHref(payload);

  const submissions = readJson("luxveritas_submissions", []);
  submissions.push(payload);
  writeJson("luxveritas_submissions", submissions.slice(-50));
  trackEvent("lead", { formType: activeFormType });

  try {
    const result = await submitToServer(payload);
    if (result.delivery === "sent") {
      statusBox.textContent = "Sent. Thank you. Your message has reached Lux Veritas.";
      statusBox.hidden = false;
      dialogForm.reset();
      submitButton.disabled = false;
      submitButton.textContent = "Send to Lux Veritas";
      return;
    }
  } catch {
    // Fall through to email-draft fallback.
  }

  const copied = await copySubmissionToClipboard(body);
  statusBox.innerHTML = `Your email app should open now. Send the drafted message to complete your submission to Lux Veritas.${copied ? " A copy has also been placed on your clipboard." : ""}<br /><a href="${escapeHtml(href)}">Open email manually</a>`;
  statusBox.hidden = false;
  window.location.href = href;
  submitButton.disabled = false;
  submitButton.textContent = "Send to Lux Veritas";
}

function handlePortalSignin(event) {
  event.preventDefault();
  if (!portalSigninForm?.reportValidity()) return;

  const email = portalSigninForm.email.value.trim().toLowerCase();
  const status = portalSigninForm.querySelector("[data-portal-status]");
  const attempts = readJson("luxveritas_portal_attempts", []);
  const payload = {
    email,
    source_page: window.location.pathname,
    timestamp: new Date().toISOString(),
    status: "screened_access_required"
  };

  attempts.push(payload);
  writeJson("luxveritas_portal_attempts", attempts.slice(-50));
  trackEvent("portal_signin_attempt", { status: payload.status });

  const dialogEmail = dialogForm?.querySelector('[name="email"]');
  if (dialogEmail && !dialogEmail.value) dialogEmail.value = email;

  if (status) {
    status.innerHTML = `Portal access is screened. If this email is already approved, account access will open during the private portal phase. Otherwise, use <button class="inline-link" type="button" data-open-form="request">Request Access</button>.`;
    status.hidden = false;
  }
}

function mountConsentBanner() {
  if (getStoredValue("luxveritas_consent")) return;
  const banner = document.createElement("div");
  banner.className = "consent-banner show";
  banner.innerHTML = `<p>Lux Veritas uses essential local storage for forms and optional analytics after consent.</p>
    <div class="consent-actions">
      <button class="button button-primary" type="button" data-consent="accepted">Accept all</button>
      <button class="button button-quiet" type="button" data-consent="rejected">Reject non-essential</button>
    </div>`;
  document.body.appendChild(banner);
  banner.addEventListener("click", (event) => {
    const button = event.target.closest("[data-consent]");
    if (!button) return;
    setStoredValue("luxveritas_consent", button.dataset.consent);
    banner.remove();
    trackEvent("consent_update", { value: button.dataset.consent });
  });
}

window.addEventListener("scroll", setScrolledHeader, { passive: true });
document.querySelectorAll("button:not([type])").forEach((button) => {
  button.type = "button";
});
setScrolledHeader();
mountConsentBanner();
trackEvent("view_content");

navToggle?.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => dialog?.close());
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-form]");
  if (!button) return;
  event.preventDefault();
  openForm(button.dataset.openForm);
});

document.querySelectorAll("[data-track]").forEach((button) => {
  button.addEventListener("click", () => {
    trackEvent(button.dataset.track, { label: button.textContent.trim() });
  });
});

dialogForm?.addEventListener("submit", handleFormSubmit);
portalSigninForm?.addEventListener("submit", handlePortalSignin);

document.querySelectorAll(".section, .vertical-card, .release-rail article, .slate div, .event-card, .codex-card, .ops-grid article, .portal-grid article").forEach((el) => {
  el.setAttribute("data-reveal", "");
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((entry) => entry.target.classList.toggle("visible", entry.isIntersecting)),
    { threshold: 0.12 }
  );
  document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
} else {
  document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("visible"));
}
