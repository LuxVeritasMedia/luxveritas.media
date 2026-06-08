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
const eventEndpoint = "/api/event";
const reportEndpoint = "/api/report";
const mediaManifestPath = "/data/lux-media-manifest.json";
let activeFormType = "request";
let mediaManifestPromise = null;

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
  const receipt = payload.client_submission_id ? ` [${payload.client_submission_id}]` : "";
  return `${label}${receipt} - ${payload.name || "Website visitor"}`;
}

function submissionBody(payload) {
  return [
    "Lux Veritas website submission",
    "",
    `Receipt ID: ${payload.client_submission_id || ""}`,
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

function submissionReceiptId() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `LV-${stamp}-${random}`;
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
    throw new Error(result.error || "submission_failed");
  }
  return result;
}

function sendEventToServer(payload) {
  try {
    const body = JSON.stringify(payload);
    fetch(eventEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body,
      keepalive: body.length < 60000
    }).catch(() => {});
  } catch {
    // Server-side event reporting is best-effort; local reporting remains available.
  }
}

function fallbackIntro(result) {
  return "The direct handoff is not available from this browser right now. Send the drafted email below to complete your submission.";
}

function showSubmissionSuccess(payload, message) {
  statusBox.innerHTML = `${escapeHtml(message)}<br /><span class="receipt-code">Receipt ${escapeHtml(payload.client_submission_id)}</span>`;
  statusBox.hidden = false;
  dialogForm.reset();
  trackEvent("lead_accepted", {
    formType: payload.formType,
    receipt: payload.client_submission_id
  });
}

function showEmailFallback(payload, href, result, copied) {
  const intro = fallbackIntro(result);
  statusBox.innerHTML = `${escapeHtml(intro)}${copied ? " A copy has also been placed on your clipboard." : ""}<br /><span class="receipt-code">Receipt ${escapeHtml(payload.client_submission_id)}</span><br /><a class="button button-primary" href="${escapeHtml(href)}">Open email draft</a>`;
  statusBox.hidden = false;
  trackEvent("lead_fallback", {
    formType: payload.formType,
    receipt: payload.client_submission_id,
    delivery: result?.delivery || "email_draft",
    copied
  });
}

function saveLocalSubmission(payload) {
  const submissions = readJson("luxveritas_submissions", []);
  const next = submissions.filter((item) => item.client_submission_id !== payload.client_submission_id);
  next.push(payload);
  writeJson("luxveritas_submissions", next.slice(-50));
}

function updateLocalSubmission(id, updates) {
  const submissions = readJson("luxveritas_submissions", []);
  const next = submissions.map((item) => (
    item.client_submission_id === id ? { ...item, ...updates } : item
  ));
  writeJson("luxveritas_submissions", next.slice(-50));
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
  if (consent === "accepted") {
    window.dataLayer.push(payload);
    sendEventToServer(payload);
  }
}

function mediaEvents() {
  return readJson("luxveritas_media_events", []);
}

function writeMediaEvent(action, player, item = {}) {
  const payload = {
    action,
    context: player?.dataset.playerContext || document.body.dataset.page || "site",
    media_id: item.mediaId || item.id || null,
    title: item.title || player?.querySelector("[data-media-title]")?.textContent?.trim() || "SPMVP",
    kind: item.kind || player?.querySelector("[data-media-mode]")?.textContent?.trim()?.toLowerCase() || "signal",
    access: item.access || null,
    source_page: window.location.pathname,
    timestamp: new Date().toISOString()
  };
  const events = mediaEvents();
  events.push(payload);
  writeJson("luxveritas_media_events", events.slice(-100));
  trackEvent("media_action", payload);
  return events.length;
}

function updateMediaReport(player) {
  const report = player?.querySelector("[data-media-report]");
  if (!report) return;
  const count = mediaEvents().filter((event) => event.source_page === window.location.pathname).length;
  report.textContent = `${count} media action${count === 1 ? "" : "s"} recorded from this page.`;
}

function setMediaProgress(player, percent) {
  const bar = player?.querySelector("[data-media-progress]");
  if (bar) bar.style.width = `${Math.max(0, Math.min(percent, 100))}%`;
}

function resetMediaSources(player) {
  const shell = player?.querySelector("[data-media-source-shell]");
  const audio = player?.querySelector("[data-media-audio]");
  const video = player?.querySelector("[data-media-video]");
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.hidden = true;
    audio.load();
  }
  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.removeAttribute("poster");
    video.hidden = true;
    video.load();
  }
  if (shell) shell.hidden = true;
}

function setActiveMediaItem(player, item, options = {}) {
  if (!player || !item) return;
  player.querySelectorAll("[data-media-item]").forEach((button) => {
    button.classList.toggle("active", button === item);
  });
  const mode = player.querySelector("[data-media-mode]");
  const title = player.querySelector("[data-media-title]");
  const status = player.querySelector("[data-media-status]");
  if (mode) mode.textContent = item.dataset.kind || "signal";
  if (title) title.textContent = item.dataset.title || "SPMVP";
  if (status) status.textContent = item.dataset.status || "Ready for public preview routing.";
  setMediaProgress(player, 18);
  resetMediaSources(player);
  if (options.record !== false) writeMediaEvent("select", player, item.dataset);
  updateMediaReport(player);
}

function mediaItemMarkup(item, index) {
  const sourceUrl = item.sourceUrl || "";
  const posterUrl = item.posterUrl || "";
  return `<button class="media-item${index === 0 ? " active" : ""}" type="button" data-media-item data-media-id="${escapeHtml(item.id)}" data-kind="${escapeHtml(item.kind)}" data-title="${escapeHtml(item.title)}" data-status="${escapeHtml(item.status)}" data-action="${escapeHtml(item.primaryAction)}" data-access="${escapeHtml(item.access)}" data-source-type="${escapeHtml(item.sourceType)}" data-source-url="${escapeHtml(sourceUrl)}" data-poster-url="${escapeHtml(posterUrl)}" role="listitem">
    <span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.summary)}</small>
  </button>`;
}

function itemsForPlayer(manifest, player) {
  const context = player?.dataset.playerContext || "music";
  return (manifest.items || []).filter((item) => Array.isArray(item.contexts) && item.contexts.includes(context));
}

async function loadMediaManifest() {
  if (!mediaManifestPromise) {
    mediaManifestPromise = fetch(mediaManifestPath, { headers: { Accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error("media_manifest_unavailable");
        return response.json();
      })
      .then((manifest) => {
        if (!Array.isArray(manifest.items)) throw new Error("media_manifest_invalid");
        return manifest;
      });
  }
  return mediaManifestPromise;
}

function renderMediaPlayer(player, manifest) {
  const queue = player?.querySelector(".media-queue");
  const items = itemsForPlayer(manifest, player);
  if (!queue || !items.length) {
    updateMediaReport(player);
    return;
  }

  queue.innerHTML = items.map(mediaItemMarkup).join("");
  const first = queue.querySelector("[data-media-item]");
  setActiveMediaItem(player, first, { record: false });
}

function hydrateMediaPlayers() {
  const players = [...document.querySelectorAll("[data-media-player]")];
  if (!players.length) return;
  loadMediaManifest()
    .then((manifest) => players.forEach((player) => renderMediaPlayer(player, manifest)))
    .catch(() => players.forEach(updateMediaReport));
}

function localReportData() {
  const events = readJson("luxveritas_events", []);
  const media = readJson("luxveritas_media_events", []);
  const submissions = readJson("luxveritas_submissions", []);
  const portal = readJson("luxveritas_portal_attempts", []);
  return {
    generatedAt: new Date().toISOString(),
    source: "luxveritas.media",
    page: window.location.pathname,
    counts: {
      events: events.length,
      media: media.length,
      submissions: submissions.length,
      portal: portal.length
    },
    latest: [...events, ...media, ...submissions, ...portal]
      .filter(Boolean)
      .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")))
      .slice(0, 12),
    events,
    media,
    submissions,
    portal
  };
}

function renderLocalReport() {
  const panel = document.querySelector("[data-local-report]");
  if (!panel) return;
  const report = localReportData();
  for (const [key, value] of Object.entries(report.counts)) {
    const target = panel.querySelector(`[data-report-count="${key}"]`);
    if (target) target.textContent = String(value);
  }

  const list = panel.querySelector("[data-report-list]");
  if (!list) return;
  if (!report.latest.length) {
    list.innerHTML = "<li>No local activity recorded yet.</li>";
    return;
  }

  list.innerHTML = report.latest.map((item) => {
    const label = item.client_submission_id || item.event || item.action || item.formType || item.status || "activity";
    const detail = item.formType || item.delivery_status || item.title || item.role_path || item.email || item.page || item.source_page || "Lux Veritas";
    const time = item.timestamp ? new Date(item.timestamp).toLocaleString() : "Recent";
    return `<li><strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail)}</span><small>${escapeHtml(time)}</small></li>`;
  }).join("");
}

function setReportStatus(message) {
  const status = document.querySelector("[data-report-status]");
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
}

function setPrivateReportStatus(message) {
  const status = document.querySelector("[data-private-report-status]");
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
}

function renderPrivateReport(report) {
  const panel = document.querySelector("[data-private-report]");
  if (!panel) return;

  for (const [key, value] of Object.entries(report.counts || {})) {
    const target = panel.querySelector(`[data-private-count="${key}"]`);
    if (target) target.textContent = String(value);
  }

  const list = panel.querySelector("[data-private-report-list]");
  if (!list) return;

  const items = [
    ...(report.latest?.submissions || []).map((item) => ({ ...item, type: "submission" })),
    ...(report.latest?.events || []).map((item) => ({ ...item, type: "event" }))
  ].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).slice(0, 12);

  if (!items.length) {
    list.innerHTML = "<li>No protected activity found yet.</li>";
    return;
  }

  list.innerHTML = items.map((item) => {
    const label = item.client_submission_id || item.event || item.type || "activity";
    const detail = item.formType || item.inquiry_type || item.page || item.role_path || "Lux Veritas";
    const time = item.createdAt ? new Date(item.createdAt).toLocaleString() : "Recent";
    return `<li><strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail)}</span><small>${escapeHtml(time)}</small></li>`;
  }).join("");
}

async function loadPrivateReport() {
  const token = document.querySelector("[data-report-token]")?.value.trim();
  if (!token) {
    setPrivateReportStatus("Enter an approved operator token first.");
    return;
  }

  setPrivateReportStatus("Loading private activity...");
  try {
    const response = await fetch(reportEndpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`
      }
    });
    const report = await response.json().catch(() => ({}));
    if (!response.ok || !report.ok) throw new Error(report.error || "report_unavailable");
    renderPrivateReport(report);
    setPrivateReportStatus("Private activity loaded.");
  } catch {
    setPrivateReportStatus("Private activity is unavailable for this token.");
  }
}

function exportLocalReport() {
  const report = localReportData();
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `luxveritas-local-report-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setReportStatus("Local report exported from this browser.");
}

function clearLocalReport() {
  for (const key of ["luxveritas_events", "luxveritas_media_events", "luxveritas_submissions", "luxveritas_portal_attempts"]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Best-effort cleanup for locked-down browsers.
    }
  }
  renderLocalReport();
  setReportStatus("Local report cleared on this device.");
}

function handleReportAction(action) {
  if (action === "load-private") {
    loadPrivateReport();
    return;
  }
  if (action === "export") {
    exportLocalReport();
    return;
  }
  if (action === "clear") {
    clearLocalReport();
    return;
  }
  renderLocalReport();
  setReportStatus("Local report refreshed.");
}

function handleMediaAction(action, player) {
  if (!player) {
    player = document.querySelector("[data-media-player]");
  }
  if (!player) {
    openForm(action === "watch" ? "fan" : "request");
    return;
  }

  const title = player.querySelector("[data-media-title]")?.textContent?.trim() || "SPMVP";
  const status = player.querySelector("[data-media-status]");
  const activeItem = player.querySelector(".media-item.active");
  const approvedSource = activeItem?.dataset.sourceUrl;
  const sourceType = activeItem?.dataset.sourceType;
  const posterUrl = activeItem?.dataset.posterUrl;
  const messages = {
    play: `${title} listen intent recorded. Full audio source attaches here when the approved release link is live.`,
    watch: `${title} watch intent recorded. Public video routing is ready for the approved visual source.`,
    radio: "Lux Radio intent recorded. Programming slots, live-room notes, and future episodes will attach here."
  };

  if (status) status.textContent = messages[action] || "Media intent recorded.";
  setMediaProgress(player, action === "play" ? 48 : action === "watch" ? 66 : 82);
  writeMediaEvent(action, player, activeItem?.dataset || {});
  updateMediaReport(player);

  if (approvedSource) loadApprovedMedia(player, { sourceUrl: approvedSource, sourceType, posterUrl, title });
}

function loadApprovedMedia(player, item) {
  const shell = player?.querySelector("[data-media-source-shell]");
  const audio = player?.querySelector("[data-media-audio]");
  const video = player?.querySelector("[data-media-video]");
  const status = player?.querySelector("[data-media-status]");
  if (!shell) return;

  resetMediaSources(player);
  shell.hidden = false;

  if (["audio", "stream"].includes(item.sourceType) && audio) {
    audio.src = item.sourceUrl;
    audio.hidden = false;
    audio.play().catch(() => {
      if (status) status.textContent = `${item.title} is ready. Press play in the audio control to begin.`;
    });
    return;
  }

  if (item.sourceType === "video" && video) {
    video.src = item.sourceUrl;
    if (item.posterUrl) video.poster = item.posterUrl;
    video.hidden = false;
    video.play().catch(() => {
      if (status) status.textContent = `${item.title} is ready. Press play in the video control to begin.`;
    });
    return;
  }

  window.open(item.sourceUrl, "_blank", "noopener");
}

async function handleFormSubmit(event) {
  event.preventDefault();
  if (!dialogForm.reportValidity()) return;

  const submitButton = dialogForm.querySelector("[data-submit-form]");
  submitButton.disabled = true;
  submitButton.textContent = "Sending...";
  statusBox.textContent = "Sending your request...";
  statusBox.hidden = false;

  const data = Object.fromEntries(new FormData(dialogForm).entries());
  if (data.company_url) {
    submitButton.disabled = false;
    submitButton.textContent = "Send to Lux Veritas";
    statusBox.hidden = true;
    statusBox.textContent = "";
    return;
  }

  const payload = {
    ...data,
    client_submission_id: submissionReceiptId(),
    source: "luxveritas.media",
    source_page: window.location.pathname,
    formType: activeFormType,
    tag: formCopy[activeFormType].tag,
    timestamp: new Date().toISOString(),
    delivery_status: "prepared"
  };
  const body = submissionBody(payload);
  const href = mailtoHref(payload);

  saveLocalSubmission(payload);
  trackEvent("lead", { formType: activeFormType, receipt: payload.client_submission_id });

  let result = null;
  try {
    result = await submitToServer(payload);
    updateLocalSubmission(payload.client_submission_id, {
      delivery_status: result.delivery || "accepted",
      provider_submission_id: result.id || null,
      delivered_at: result.delivery === "sent" ? new Date().toISOString() : null
    });
    if (result.delivery === "sent") {
      showSubmissionSuccess(payload, "Sent. Thank you. Your message has reached Lux Veritas.");
      submitButton.disabled = false;
      submitButton.textContent = "Send to Lux Veritas";
      return;
    }
    if (result.delivery === "stored") {
      showSubmissionSuccess(payload, "Received. Thank you. Your request is recorded with Lux Veritas.");
      submitButton.disabled = false;
      submitButton.textContent = "Send to Lux Veritas";
      return;
    }
  } catch {
    result = null;
  }

  const copied = await copySubmissionToClipboard(body);
  updateLocalSubmission(payload.client_submission_id, {
    delivery_status: result?.delivery || "email_draft",
    provider_submission_id: result?.id || null,
    fallback_at: new Date().toISOString()
  });
  showEmailFallback(payload, href, result, copied);
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

document.addEventListener("click", (event) => {
  const item = event.target.closest("[data-media-item]");
  if (!item) return;
  event.preventDefault();
  setActiveMediaItem(item.closest("[data-media-player]"), item);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-media-action]");
  if (!button) return;
  event.preventDefault();
  handleMediaAction(button.dataset.mediaAction, button.closest("[data-media-player]"));
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-report-action]");
  if (!button) return;
  event.preventDefault();
  handleReportAction(button.dataset.reportAction);
});

document.querySelectorAll("[data-track]").forEach((button) => {
  button.addEventListener("click", () => {
    trackEvent(button.dataset.track, { label: button.textContent.trim() });
  });
});

dialogForm?.addEventListener("submit", handleFormSubmit);
portalSigninForm?.addEventListener("submit", handlePortalSignin);
hydrateMediaPlayers();
renderLocalReport();

document.querySelectorAll(".section, .vertical-card, .release-rail article, .slate div, .event-card, .codex-card, .ops-grid article, .portal-grid article, .media-player").forEach((el) => {
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
