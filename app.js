const formCopy = {
  request: {
    kicker: "Request Access",
    title: "Screened Access",
    copy: "For events, partnerships, private links, and portal consideration.",
    tag: "request-access",
    rolePath: "General",
    inquiryType: "Portal"
  },
  submission: {
    kicker: "Submissions",
    title: "Artist and Creator Intake",
    copy: "Send a concise signal. The review path is selective by design.",
    tag: "submission",
    rolePath: "Creator",
    inquiryType: "Submissions"
  },
  press: {
    kicker: "Press / Partners",
    title: "Institutional Contact",
    copy: "For press, venues, distribution, investor, and brand partnership inquiries.",
    tag: "press",
    rolePath: "Press",
    inquiryType: "Press"
  },
  event: {
    kicker: "Event RSVP",
    title: "Request Invitation",
    copy: "Event access is screened. Tell us which room you are approaching.",
    tag: "event-interest",
    rolePath: "Event guest",
    inquiryType: "Events"
  },
  codex: {
    kicker: "Codex Request",
    title: "Codex Access Request",
    copy: "Inner and Sanctum access require review, alignment, and approval.",
    tag: "codex-request",
    rolePath: "Creator",
    inquiryType: "Portal"
  },
  fan: {
    kicker: "Membership",
    title: "Join the List",
    copy: "Get release signals and selected Lux Veritas updates.",
    tag: "membership-waitlist",
    rolePath: "Member",
    inquiryType: "Membership"
  },
  investor: {
    kicker: "Strategic Access",
    title: "Investor / Partner Request",
    copy: "Strategic materials are screened before access opens.",
    tag: "investor-access",
    rolePath: "Investor",
    inquiryType: "Investor"
  },
  licensing: {
    kicker: "Licensing",
    title: "Licensing Request",
    copy: "Tell us which release, use case, or partnership path you are approaching.",
    tag: "licensing-access",
    rolePath: "Partner",
    inquiryType: "Licensing"
  },
  creator: {
    kicker: "Creator Access",
    title: "Creator Request",
    copy: "Creator materials open by screened access and fit.",
    tag: "creator-access",
    rolePath: "Creator",
    inquiryType: "Portal"
  }
};

const accessPathMap = {
  Member: { accessPath: "member", portalRoleTarget: "member" },
  Artist: { accessPath: "artist", portalRoleTarget: "artist" },
  Creator: { accessPath: "creator", portalRoleTarget: "creator" },
  Press: { accessPath: "press", portalRoleTarget: "press" },
  Partner: { accessPath: "partner", portalRoleTarget: "partner" },
  Investor: { accessPath: "investor", portalRoleTarget: "investor" },
  "Event guest": { accessPath: "event_guest", portalRoleTarget: "member" },
  General: { accessPath: "general", portalRoleTarget: "visitor" }
};

const inquiryKeyMap = {
  Membership: "membership",
  Submissions: "submissions",
  Events: "events",
  Press: "press",
  Partnership: "partnership",
  Licensing: "licensing",
  Investor: "investor",
  Portal: "portal",
  General: "general"
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
const submitTimeoutMs = 12000;
let activeFormType = "request";
let mediaManifestPromise = null;
let privateReportCache = null;

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
    `Access path: ${payload.access_path || ""}`,
    `Portal role target: ${payload.portal_role_target || ""}`,
    `Inquiry type: ${payload.inquiry_type || ""}`,
    `Inquiry key: ${payload.inquiry_key || ""}`,
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
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), submitTimeoutMs);
  const response = await fetch(submitEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    signal: controller.signal,
    body: JSON.stringify(payload)
  }).finally(() => window.clearTimeout(timeout));

  const result = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) {
    const error = new Error(result.error || "submission_failed");
    error.status = response.status;
    error.result = result;
    throw error;
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
  if (result?.reason === "submission_timeout") {
    return "The site could not confirm delivery quickly enough. Send the drafted email below to complete your submission.";
  }
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

function showSubmissionError(error) {
  const details = Array.isArray(error?.result?.errors) && error.result.errors.length
    ? ` ${error.result.errors.join("; ")}.`
    : "";
  statusBox.textContent = `Please check the form and try again.${details}`;
  statusBox.hidden = false;
  trackEvent("lead_rejected", {
    reason: error?.message || "validation_failed",
    status: error?.status || null
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
  const rolePath = dialogForm?.elements.role_path;
  const inquiryType = dialogForm?.elements.inquiry_type;
  if (rolePath && config.rolePath) rolePath.value = config.rolePath;
  if (inquiryType && config.inquiryType) inquiryType.value = config.inquiryType;
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

function elementLabel(element) {
  const label = element?.getAttribute("aria-label") || element?.textContent || "";
  return label.replace(/\s+/g, " ").trim().slice(0, 120) || "Unlabeled interaction";
}

function interactionSurface(element) {
  if (!element) return "site";
  if (element.closest(".site-header")) return "header";
  if (element.closest(".site-footer")) return "footer";
  if (element.closest(".hero-actions")) return "hero";
  if (element.closest(".cta-actions, .cta-band")) return "cta";
  if (element.closest(".media-player")) return "media_player";
  if (element.closest(".event-grid")) return "events";
  if (element.closest(".portal-grid")) return "portal";
  if (element.closest(".form-dialog")) return "form_dialog";
  return element.closest("section")?.querySelector(".kicker")?.textContent?.trim()?.toLowerCase().replace(/\s+/g, "_").slice(0, 80) || "content";
}

function trackInteraction(type, element, detail = {}) {
  trackEvent(type, {
    label: elementLabel(element),
    surface: interactionSurface(element),
    ...detail
  });
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
  hideMediaFollowup(player);
}

function hideMediaFollowup(player) {
  const followup = player?.querySelector("[data-media-followup]");
  if (followup) followup.hidden = true;
}

function showMediaFollowup(player, action, title) {
  const followup = player?.querySelector("[data-media-followup]");
  const copy = player?.querySelector("[data-media-followup-copy]");
  const button = player?.querySelector("[data-media-followup-action]");
  if (!followup || !button) return;

  const config = {
    play: {
      label: "Join for release access",
      copy: `${title} is queued for approved listening access. Join for first notice when the release source opens.`
    },
    watch: {
      label: "Join for visual access",
      copy: `${title} is queued for approved visual access. Join for first notice when the visual opens.`
    },
    radio: {
      label: "Join for radio access",
      copy: "Lux Radio is queued for future programming. Join for first notice when the signal opens."
    }
  }[action] || {
    label: "Join for access",
    copy: "Join for first access when this source opens."
  };

  if (copy) copy.textContent = config.copy;
  button.textContent = config.label;
  followup.hidden = false;
  trackEvent("media_followup_offered", { action, title, formType: "fan" });
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

function downloadTextFile(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const textValue = value == null ? "" : String(value);
  return `"${textValue.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\n");
}

function localReportRows(report) {
  return [
    ...report.events.map((item) => ({
      source: "local",
      type: item.event || "event",
      timestamp: item.timestamp || "",
      page: item.page || "",
      label: item.detail?.label || item.detail?.surface || "",
      detail: item.detail?.destination || item.detail?.formType || item.detail?.action || ""
    })),
    ...report.media.map((item) => ({
      source: "local",
      type: "media",
      timestamp: item.timestamp || "",
      page: item.page || "",
      label: item.title || item.action || "",
      detail: item.sourceType || item.status || ""
    })),
    ...report.submissions.map((item) => ({
      source: "local",
      type: "submission",
      timestamp: item.timestamp || "",
      page: item.source_page || "",
      label: item.client_submission_id || item.formType || "",
      detail: item.delivery_status || item.inquiry_type || item.role_path || ""
    })),
    ...report.portal.map((item) => ({
      source: "local",
      type: "portal",
      timestamp: item.timestamp || "",
      page: item.source_page || "",
      label: item.email || "",
      detail: item.status || ""
    }))
  ];
}

function privateReportRows(report) {
  const submissions = report.latest?.submissions || [];
  const events = report.latest?.events || [];
  return [
    ...submissions.map((item) => ({
      source: "protected",
      type: "submission",
      timestamp: item.createdAt || "",
      page: item.page || "",
      label: item.client_submission_id || item.formType || item.inquiry_type || "",
      detail: item.deliveryStatus || item.role_path || item.access_path || ""
    })),
    ...events.map((item) => ({
      source: "protected",
      type: item.event || "event",
      timestamp: item.createdAt || "",
      page: item.page || "",
      label: item.detail?.label || item.detail?.surface || item.detail?.action || "",
      detail: item.detail?.destination || item.detail?.formType || item.detail?.title || ""
    }))
  ];
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
    const detail = item.detail?.destination || item.detail?.formType || item.detail?.surface || item.formType || item.delivery_status || item.title || item.role_path || item.email || item.page || item.source_page || "Lux Veritas";
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
  privateReportCache = report;

  for (const [key, value] of Object.entries(report.counts || {})) {
    const target = panel.querySelector(`[data-private-count="${key}"]`);
    if (target) target.textContent = String(value);
  }

  renderPrivateDelivery(panel, report.delivery);
  renderPrivateSummary(panel, "forms", report.summary?.submissions?.byFormType);
  renderPrivateSummary(panel, "roles", report.summary?.submissions?.byRolePath);
  renderPrivateSummary(panel, "integrations", report.summary?.submissions?.byIntegrationStatus);
  renderPrivateSummary(panel, "events", report.summary?.events?.byEvent);
  renderPrivateSummary(panel, "destinations", report.summary?.events?.byDestination || report.summary?.events?.byPage);

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
    const detail = item.detail?.destination || item.detail?.formType || item.detail?.surface || item.formType || item.inquiry_type || item.page || item.role_path || "Lux Veritas";
    const time = item.createdAt ? new Date(item.createdAt).toLocaleString() : "Recent";
    return `<li><strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail)}</span><small>${escapeHtml(time)}</small></li>`;
  }).join("");
}

function renderPrivateSummary(panel, key, items = []) {
  const list = panel.querySelector(`[data-private-summary="${key}"]`);
  if (!list) return;
  if (!items.length) {
    list.innerHTML = "<li>No records found yet.</li>";
    return;
  }
  list.innerHTML = items.map((item) => (
    `<li><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.count)} signal${item.count === 1 ? "" : "s"}</span></li>`
  )).join("");
}

function renderPrivateDelivery(panel, delivery = {}) {
  const status = panel.querySelector('[data-private-delivery="status"]');
  const detail = panel.querySelector('[data-private-delivery="detail"]');
  const ready = delivery.inboxNotification === "ready";
  if (status) status.textContent = ready ? "Ready" : "Setup";
  if (detail) {
    const missing = Array.isArray(delivery.missing) && delivery.missing.length
      ? `Missing ${delivery.missing.join(", ")}`
      : "Store-first capture is ready";
    detail.textContent = ready ? "Inbox notifications active" : missing;
  }
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
  downloadTextFile(
    `luxveritas-local-report-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(report, null, 2),
    "application/json"
  );
  setReportStatus("Local report exported from this browser.");
}

function exportLocalReportCsv() {
  const report = localReportData();
  const csv = rowsToCsv(localReportRows(report));
  downloadTextFile(
    `luxveritas-local-report-${new Date().toISOString().slice(0, 10)}.csv`,
    csv || "source,type,timestamp,page,label,detail\n",
    "text/csv"
  );
  setReportStatus("Local CSV exported from this browser.");
}

function exportPrivateReport(format) {
  if (!privateReportCache) {
    setPrivateReportStatus("Load private activity before exporting.");
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    const csv = rowsToCsv(privateReportRows(privateReportCache));
    downloadTextFile(
      `luxveritas-private-report-${date}.csv`,
      csv || "source,type,timestamp,page,label,detail\n",
      "text/csv"
    );
    setPrivateReportStatus("Private CSV exported.");
    return;
  }

  downloadTextFile(
    `luxveritas-private-report-${date}.json`,
    JSON.stringify(privateReportCache, null, 2),
    "application/json"
  );
  setPrivateReportStatus("Private JSON exported.");
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
  if (action === "export-csv") {
    exportLocalReportCsv();
    return;
  }
  if (action === "export-private-json") {
    exportPrivateReport("json");
    return;
  }
  if (action === "export-private-csv") {
    exportPrivateReport("csv");
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

  if (approvedSource) {
    loadApprovedMedia(player, { sourceUrl: approvedSource, sourceType, posterUrl, title });
  } else {
    showMediaFollowup(player, action, title);
  }
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
    access_path: accessPathMap[data.role_path]?.accessPath || "general",
    portal_role_target: accessPathMap[data.role_path]?.portalRoleTarget || "visitor",
    inquiry_key: inquiryKeyMap[data.inquiry_type] || "general",
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
  } catch (error) {
    if (error?.status === 400) {
      showSubmissionError(error);
      submitButton.disabled = false;
      submitButton.textContent = "Send to Lux Veritas";
      return;
    }
    result = {
      delivery: "email_draft",
      reason: error?.name === "AbortError" ? "submission_timeout" : "network_error"
    };
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
  trackInteraction("nav_toggle", navToggle, { open: isOpen });
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => dialog?.close());
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-form]");
  if (!button) return;
  event.preventDefault();
  trackInteraction("form_open", button, { formType: button.dataset.openForm || "request" });
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
  trackInteraction("report_action", button, { action: button.dataset.reportAction });
  handleReportAction(button.dataset.reportAction);
});

document.addEventListener("click", (event) => {
  const tracked = event.target.closest("[data-track]");
  if (tracked) {
    trackInteraction(tracked.dataset.track, tracked);
    return;
  }

  const link = event.target.closest("a[href]");
  if (!link) return;

  const href = link.getAttribute("href") || "";
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
  trackInteraction("link_click", link, {
    destination: href,
    outbound: /^https?:\/\//i.test(href) && !href.includes(window.location.hostname)
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
