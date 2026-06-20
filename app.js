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
const actionInventoryPath = "/data/lux-action-inventory.json";
const launchChecklistPath = "/data/lux-launch-readiness.json";
const launchCloseoutPath = "/data/lux-launch-closeout-public.json";
const legalReviewPath = "/data/lux-legal-review.json";
const submitTimeoutMs = 8000;
const publicBuildVersion = "20260620-brand-house-rail";
const allowedInterestPaths = new Set(["music", "film", "events", "drops", "community", "codex", "create"]);
let activeFormType = "request";
let mediaManifestPromise = null;
let actionInventoryPromise = null;
let launchChecklistPromise = null;
let launchCloseoutPromise = null;
let legalReviewPromise = null;
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

function formLegalPayload() {
  const value = (name) => dialogForm?.elements?.[name]?.value || "";
  return {
    public_terms_version: value("public_terms_version"),
    privacy_version: value("privacy_version"),
    terms_version: value("terms_version"),
    submission_terms_version: value("submission_terms_version")
  };
}

function normalizeInterestPaths(values) {
  const raw = Array.isArray(values) ? values : String(values || "").split(",");
  return [...new Set(raw
    .map((value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-"))
    .filter((value) => allowedInterestPaths.has(value))
  )].slice(0, 7);
}

function selectedInterestPaths(form) {
  if (!form) return [];
  return normalizeInterestPaths(new FormData(form).getAll("interest_paths"));
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
    `Interest paths: ${(payload.interest_paths || []).join(", ")}`,
    `Form type: ${payload.formType || ""}`,
    `Source page: ${payload.source_page || ""}`,
    `Timestamp: ${payload.timestamp || ""}`,
    `Public terms version: ${payload.public_terms_version || ""}`,
    `Privacy version: ${payload.privacy_version || ""}`,
    `Terms version: ${payload.terms_version || ""}`,
    `Submission terms version: ${payload.submission_terms_version || ""}`,
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
  if (result && result.ok === false) {
    const error = new Error(result.error || "submission_failed");
    error.status = response.status;
    error.result = result;
    throw error;
  }
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

function storedSubmissionMessage(result) {
  if (result?.reason === "email_provider_not_configured") {
    return "Received. Thank you. Your request is recorded for Lux Veritas review.";
  }
  return "Received. Thank you. Your request is recorded with Lux Veritas.";
}

function startSubmitProgress(status, copy) {
  if (!status) return null;
  status.textContent = copy || "Sending your request...";
  status.hidden = false;
  return window.setTimeout(() => {
    status.textContent = "Still recording your request. This will reset automatically if the live handoff takes too long.";
  }, 4500);
}

function stopSubmitProgress(timer) {
  if (timer) window.clearTimeout(timer);
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
  if (error?.status === 429 || error?.message === "rate_limited") {
    statusBox.textContent = "Too many attempts from this browser. Please wait a few minutes and try again.";
    statusBox.hidden = false;
    trackEvent("lead_rejected", {
      reason: "rate_limited",
      status: 429
    });
    return;
  }

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
  const label = element?.dataset?.trackLabel || element?.getAttribute("aria-label") || element?.textContent || "";
  return label.replace(/\s+/g, " ").trim().slice(0, 120) || "Unlabeled interaction";
}

function slugify(value, fallback = "interaction") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return slug || fallback;
}

function interactionSurface(element) {
  if (!element) return "site";
  const trackedSurface = element.dataset?.trackSurface || element.closest("[data-track-surface]")?.dataset?.trackSurface;
  if (trackedSurface) return trackedSurface;
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

function interactionIntent(element, detail = {}) {
  const trackedIntent = element?.dataset?.trackIntent || element?.closest?.("[data-track-intent]")?.dataset?.trackIntent;
  if (trackedIntent) return trackedIntent;
  if (detail.action) return detail.action;
  if (detail.formType) return `form_${detail.formType}`;
  if (detail.destination) return `link_${detail.destination}`;
  if (element?.dataset.mediaAction) return `media_${element.dataset.mediaAction}`;
  if (element?.dataset.openForm) return `form_${element.dataset.openForm}`;
  if (element?.dataset.reportAction) return `report_${element.dataset.reportAction}`;
  if (element?.dataset.track) return element.dataset.track;
  const href = element?.getAttribute?.("href");
  if (href) return `link_${href}`;
  return "interaction";
}

function interactionId(type, element, detail = {}) {
  const surface = interactionSurface(element);
  const intent = interactionIntent(element, detail);
  const label = elementLabel(element);
  return `${slugify(surface, "site")}__${slugify(type, "event")}__${slugify(intent || label, "action")}`;
}

function trackInteraction(type, element, detail = {}) {
  const label = elementLabel(element);
  const surface = interactionSurface(element);
  const intent = interactionIntent(element, detail);
  trackEvent(type, {
    cta_id: interactionId(type, element, detail),
    label,
    surface,
    intent,
    ...detail
  });
}

function mediaEvents() {
  return readJson("luxveritas_media_events", []);
}

function writeMediaEvent(action, player, item = {}) {
  const payload = {
    event: "media_action",
    action,
    cta_id: `${slugify(player?.dataset.playerContext || document.body.dataset.page || "site", "media")}__media_action__${slugify(action, "action")}`,
    context: player?.dataset.playerContext || document.body.dataset.page || "site",
    media_id: item.mediaId || item.id || null,
    title: item.title || player?.querySelector("[data-media-title]")?.textContent?.trim() || "SPMVP",
    kind: item.kind || player?.querySelector("[data-media-mode]")?.textContent?.trim()?.toLowerCase() || "signal",
    access: item.access || null,
    source_type: item.sourceType || null,
    source_status: item.sourceStatus || "queued",
    source_ready: /^https:\/\//i.test(item.sourceUrl || ""),
    source_required: item.sourceRequired === "true" || item.sourceRequired === true,
    reporting_key: item.reportingKey || null,
    source_page: window.location.pathname,
    timestamp: new Date().toISOString()
  };
  const events = mediaEvents();
  events.push(payload);
  writeJson("luxveritas_media_events", events.slice(-100));
  trackEvent("media_action", payload);
  return events.length;
}

function activeMediaItemData(player) {
  const item = player?.querySelector(".media-item.active");
  return item?.dataset || {};
}

function writeMediaPlaybackEvent(phase, player, element, detail = {}) {
  const item = activeMediaItemData(player);
  const duration = Number.isFinite(element?.duration) ? element.duration : 0;
  const currentTime = Number.isFinite(element?.currentTime) ? element.currentTime : 0;
  const progress = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;
  const payload = {
    event: "media_playback",
    action: phase,
    cta_id: `${slugify(player?.dataset.playerContext || document.body.dataset.page || "site", "media")}__media_playback__${slugify(phase, "action")}`,
    context: player?.dataset.playerContext || document.body.dataset.page || "site",
    media_id: item.mediaId || null,
    title: item.title || player?.querySelector("[data-media-title]")?.textContent?.trim() || "SPMVP",
    kind: item.kind || player?.querySelector("[data-media-mode]")?.textContent?.trim()?.toLowerCase() || "signal",
    access: item.access || null,
    source_type: item.sourceType || element?.dataset.playbackSourceType || null,
    source_status: item.sourceStatus || "ready",
    source_ready: /^https:\/\//i.test(item.sourceUrl || element?.currentSrc || ""),
    source_required: item.sourceRequired === "true" || item.sourceRequired === true,
    reporting_key: item.reportingKey || null,
    source_page: window.location.pathname,
    current_time: Number(currentTime.toFixed(2)),
    duration: Number(duration.toFixed(2)),
    progress_percent: Math.max(0, Math.min(progress, 100)),
    timestamp: new Date().toISOString(),
    ...detail
  };
  const events = mediaEvents();
  events.push(payload);
  writeJson("luxveritas_media_events", events.slice(-150));
  trackEvent("media_playback", payload);
  updateMediaReport(player);
  renderFanSignal();
  return events.length;
}

function writeFanReaction(button, player) {
  const item = activeMediaItemData(player);
  const reaction = button?.dataset.fanReaction || "return";
  const reactionLabel = elementLabel(button) || reaction;
  const payload = {
    event: "fan_reaction",
    action: reaction,
    reaction,
    reaction_label: reactionLabel,
    cta_id: `${slugify(player?.dataset.playerContext || document.body.dataset.page || "site", "media")}__fan_reaction__${slugify(reaction, "reaction")}`,
    context: player?.dataset.playerContext || document.body.dataset.page || "site",
    media_id: item.mediaId || null,
    title: item.title || player?.querySelector("[data-media-title]")?.textContent?.trim() || "SPMVP",
    kind: item.kind || player?.querySelector("[data-media-mode]")?.textContent?.trim()?.toLowerCase() || "signal",
    source_type: item.sourceType || null,
    source_status: item.sourceStatus || "queued",
    reporting_key: item.reportingKey || null,
    source_page: window.location.pathname,
    timestamp: new Date().toISOString()
  };
  const events = mediaEvents();
  events.push(payload);
  writeJson("luxveritas_media_events", events.slice(-150));
  trackEvent("fan_reaction", payload);
  updateMediaReport(player);
  renderFanSignal();
  const report = player?.querySelector("[data-media-report]");
  if (report) report.textContent = `${reactionLabel} saved to your local signal.`;
  return events.length;
}

function instrumentMediaElement(player, element, sourceType) {
  if (!element || element.dataset.playbackInstrumented === "true") return;
  element.dataset.playbackInstrumented = "true";
  element.addEventListener("play", () => writeMediaPlaybackEvent("play", player, element));
  element.addEventListener("pause", () => {
    if (!element.ended) writeMediaPlaybackEvent("pause", player, element);
  });
  element.addEventListener("ended", () => writeMediaPlaybackEvent("ended", player, element, { milestone: "ended" }));
  element.addEventListener("timeupdate", () => {
    const duration = Number.isFinite(element.duration) ? element.duration : 0;
    const seen = new Set(String(element.dataset.playbackMilestones || "").split(",").filter(Boolean));
    if (duration <= 0) {
      const currentTime = Number.isFinite(element.currentTime) ? element.currentTime : 0;
      const timeMilestones = [30, 60, 120].filter((mark) => currentTime >= mark);
      for (const mark of timeMilestones) {
        const key = `${mark}s`;
        if (seen.has(key)) continue;
        seen.add(key);
        element.dataset.playbackMilestones = [...seen].join(",");
        writeMediaPlaybackEvent("milestone", player, element, { milestone: key });
        break;
      }
      return;
    }

    const percent = Math.floor((element.currentTime / duration) * 100);
    const milestones = [25, 50, 75].filter((mark) => percent >= mark);
    for (const mark of milestones) {
      const key = String(mark);
      if (seen.has(key)) continue;
      seen.add(key);
      element.dataset.playbackMilestones = [...seen].join(",");
      writeMediaPlaybackEvent("milestone", player, element, { milestone: `${mark}%` });
      break;
    }
  });
  element.dataset.playbackSourceType = sourceType || "";
}

function updateMediaReport(player) {
  const report = player?.querySelector("[data-media-report]");
  if (!report) return;
  const count = mediaEvents().filter((event) => event.source_page === window.location.pathname).length;
  report.textContent = `${count} media signal${count === 1 ? "" : "s"} recorded from this page.`;
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
    audio.dataset.playbackMilestones = "";
    audio.dataset.playbackSourceType = "";
    audio.hidden = true;
    audio.load();
  }
  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.removeAttribute("poster");
    video.dataset.playbackMilestones = "";
    video.dataset.playbackSourceType = "";
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
  if (action && button.dataset) {
    const activeItem = player?.querySelector(".media-item.active");
    button.dataset.openForm = activeItem?.dataset.fallbackFormType || "fan";
  }
  followup.hidden = false;
  trackEvent("media_followup_offered", { action, title, formType: button.dataset.openForm || "fan" });
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
  renderFanSignal();
}

function mediaItemMarkup(item, index) {
  const sourceUrl = item.sourceUrl || "";
  const posterUrl = item.posterUrl || "";
  return `<button class="media-item${index === 0 ? " active" : ""}" type="button" data-media-item data-media-id="${escapeHtml(item.id)}" data-kind="${escapeHtml(item.kind)}" data-title="${escapeHtml(item.title)}" data-status="${escapeHtml(item.status)}" data-action="${escapeHtml(item.primaryAction)}" data-access="${escapeHtml(item.access)}" data-source-status="${escapeHtml(item.sourceStatus || "queued")}" data-source-required="${escapeHtml(String(Boolean(item.sourceRequired)))}" data-source-type="${escapeHtml(item.sourceType)}" data-source-url="${escapeHtml(sourceUrl)}" data-poster-url="${escapeHtml(posterUrl)}" data-reporting-key="${escapeHtml(item.reportingKey || item.id || "")}" data-fallback-form-type="${escapeHtml(item.fallbackFormType || "fan")}" role="listitem">
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

async function loadActionInventory() {
  if (!actionInventoryPromise) {
    actionInventoryPromise = fetch(actionInventoryPath, { headers: { Accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error("action_inventory_unavailable");
        return response.json();
      })
      .then((inventory) => {
        if (!inventory.summary || !Array.isArray(inventory.actions)) throw new Error("action_inventory_invalid");
        return inventory;
      });
  }
  return actionInventoryPromise;
}

async function loadLaunchChecklist() {
  if (!launchChecklistPromise) {
    launchChecklistPromise = fetch(launchChecklistPath, { headers: { Accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error("launch_checklist_unavailable");
        return response.json();
      })
      .then((checklist) => {
        if (!Array.isArray(checklist.gates)) throw new Error("launch_checklist_invalid");
        return checklist;
      });
  }
  return launchChecklistPromise;
}

async function loadLaunchCloseout() {
  if (!launchCloseoutPromise) {
    launchCloseoutPromise = fetch(launchCloseoutPath, { headers: { Accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error("launch_closeout_unavailable");
        return response.json();
      })
      .then((closeout) => {
        if (!Array.isArray(closeout.items)) throw new Error("launch_closeout_invalid");
        return closeout;
      });
  }
  return launchCloseoutPromise;
}

async function loadLegalReview() {
  if (!legalReviewPromise) {
    legalReviewPromise = fetch(legalReviewPath, { headers: { Accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error("legal_review_unavailable");
        return response.json();
      })
      .then((manifest) => {
        if (!Array.isArray(manifest.items)) throw new Error("legal_review_invalid");
        return manifest;
      });
  }
  return legalReviewPromise;
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

function sourceTypeLabel(sourceType) {
  if (sourceType === "audio") return "Audio";
  if (sourceType === "video") return "Video";
  if (sourceType === "stream") return "Radio";
  return "Media";
}

function renderMediaReadinessReport() {
  const list = document.querySelector("[data-media-readiness-list]");
  const summary = document.querySelector("[data-media-readiness-summary]");
  if (!list && !summary) return;

  loadMediaManifest()
    .then((manifest) => {
      const items = Array.isArray(manifest.items) ? manifest.items : [];
      const readyItems = items.filter((item) => /^https:\/\//i.test(item.sourceUrl || ""));
      if (summary) {
        summary.textContent = `${readyItems.length} of ${items.length} source-ready`;
      }
      if (!list) return;
      if (!items.length) {
        list.innerHTML = "<li>No public media slots found.</li>";
        return;
      }
      list.innerHTML = items.map((item) => {
        const ready = /^https:\/\//i.test(item.sourceUrl || "");
        const label = `${sourceTypeLabel(item.sourceType)} ${ready ? "ready" : item.sourceStatus || "queued"}`;
        const status = item.status || "Awaiting approved source.";
        return `<li><strong>${escapeHtml(item.title || item.id || "Media")}</strong><span>${escapeHtml(label)}</span><small>${escapeHtml(status)}</small></li>`;
      }).join("");
    })
    .catch(() => {
      if (summary) summary.textContent = "Media readiness unavailable";
      if (list) list.innerHTML = "<li>Media readiness could not be loaded.</li>";
    });
}

function launchGateStatusLabel(status) {
  if (status === "ready") return "Ready";
  if (status === "blocked") return "Blocked";
  if (status === "setup") return "Setup";
  if (status === "queued") return "Queued";
  return "Review";
}

function legalReviewItem(legalReview, id) {
  return Array.isArray(legalReview?.items)
    ? legalReview.items.find((item) => item.id === id)
    : null;
}

function legalGateDetail(item) {
  if (!item) return "Legal review status is unavailable.";
  if (item.status === "approved") {
    return `Approved by ${item.reviewedBy || "reviewer"}${item.reviewedAt ? ` on ${new Date(item.reviewedAt).toLocaleDateString()}` : ""}.`;
  }
  return item.notes || "Legal review is still required before full public launch.";
}

function launchGateActionText(gate) {
  return [
    gate.owner ? `Owner: ${gate.owner}` : "",
    gate.nextAction ? `Next: ${gate.nextAction}` : "",
    gate.verification ? `Verify: ${gate.verification}` : ""
  ].filter(Boolean).join(" ");
}

function launchGateMarkup(gate) {
  const label = escapeHtml(gate.label);
  const status = escapeHtml(`${launchGateStatusLabel(gate.status)} / ${gate.blockerType || gate.category || "launch"}`);
  const detail = escapeHtml(gate.detail || gate.nextAction || "Review before launch.");
  const action = launchGateActionText(gate);
  return `<li><strong>${label}</strong><span>${status}</span><small>${detail}${action ? `<br />${escapeHtml(action)}` : ""}</small></li>`;
}

function evaluateLaunchGate(gate, manifest, report, legalReview) {
  const items = Array.isArray(manifest?.items) ? manifest.items : [];
  const missingMedia = items.filter((item) => ["audio", "video", "stream"].includes(item.sourceType) && !/^https:\/\//i.test(item.sourceUrl || ""));
  const delivery = report?.delivery || {};
  const hasDeliveryReport = Boolean(report?.delivery && Object.keys(delivery).length);

  if (gate.id === "media_sources") {
    return {
      ...gate,
      status: missingMedia.length ? "blocked" : "ready",
      detail: missingMedia.length
        ? `Missing ${missingMedia.map((item) => item.title || item.id).join(", ")}`
        : "All public media sources are attached."
    };
  }

  if (gate.id === "inbox_notifications") {
    if (!hasDeliveryReport) {
      return {
        ...gate,
        detail: gate.nextAction || "Inbox notification provider readiness has not been checked yet."
      };
    }
    const ready = delivery.inboxNotification === "ready";
    return {
      ...gate,
      status: ready ? "ready" : "blocked",
      detail: ready ? "Inbox notifications are active." : "Inbox notification provider is not active."
    };
  }

  if (gate.id === "private_handoff") {
    if (!hasDeliveryReport) {
      return {
        ...gate,
        detail: gate.nextAction || "Private handoff readiness has not been checked yet."
      };
    }
    const ready = delivery.integrationWebhook === "ready" && delivery.integrationTargetConfigured === true;
    return {
      ...gate,
      status: ready ? "ready" : "blocked",
      detail: ready ? "Private handoff is active." : gate.nextAction
    };
  }

  if (gate.id === "operator_reporting") {
    if (!hasDeliveryReport) {
      return {
        ...gate,
        detail: gate.nextAction || "Operator reporting readiness has not been checked yet."
      };
    }
    const ready = delivery.operatorTokenConfigured === true;
    return {
      ...gate,
      status: ready ? "ready" : "blocked",
      detail: ready ? "Private report token is configured." : gate.nextAction
    };
  }

  if (gate.id === "privacy_review" || gate.id === "terms_review") {
    const legalId = gate.id === "privacy_review" ? "privacy" : "terms";
    const item = legalReviewItem(legalReview, legalId);
    const ready = item?.status === "approved" && item.reviewedAt && item.reviewedBy;
    return {
      ...gate,
      status: ready ? "ready" : "blocked",
      detail: legalGateDetail(item)
    };
  }

  return {
    ...gate,
    detail: gate.nextAction || "Review before launch."
  };
}

async function renderLaunchReadinessReport(report = privateReportCache) {
  const summary = document.querySelector("[data-launch-readiness-summary]");
  const list = document.querySelector("[data-launch-readiness-list]");
  if (!summary && !list) return;

  try {
    const [checklist, manifest, legalReview] = await Promise.all([
      loadLaunchChecklist(),
      loadMediaManifest().catch(() => ({ items: [] })),
      loadLegalReview().catch(() => ({ items: [] }))
    ]);
    const gates = checklist.gates.map((gate) => evaluateLaunchGate(gate, manifest, report, legalReview));
    const required = gates.filter((gate) => gate.requiredForPublicLaunch);
    const ready = required.filter((gate) => gate.status === "ready");
    const blocked = required.filter((gate) => gate.status !== "ready");

    if (summary) {
      summary.textContent = `${ready.length} of ${required.length} launch gates ready`;
    }
    if (list) {
      list.innerHTML = gates.map(launchGateMarkup).join("");
    }

    trackEvent("launch_readiness_view", {
      ready: ready.length,
      blocked: blocked.length,
      required: required.length
    });
  } catch {
    if (summary) summary.textContent = "Launch readiness unavailable";
    if (list) list.innerHTML = "<li>Launch readiness could not be loaded.</li>";
  }
}

function closeoutStatusLabel(status) {
  if (status === "closed") return "Closed";
  if (status === "blocked") return "Blocked";
  return "Open";
}

function launchCloseoutMarkup(item) {
  const label = escapeHtml(item.label || item.id || "Closeout item");
  const status = escapeHtml(closeoutStatusLabel(item.status));
  const owner = item.owner ? `Owner: ${item.owner}` : "";
  const evidence = item.evidenceReference ? `Evidence: ${item.evidenceReference}` : "";
  const detail = [owner, evidence].filter(Boolean).join(" ");
  return `<li><strong>${label}</strong><span>${status}</span><small>${escapeHtml(detail || "Evidence required before launch closeout.")}</small></li>`;
}

async function renderLaunchCloseoutReport() {
  const summary = document.querySelector("[data-launch-closeout-summary]");
  const list = document.querySelector("[data-launch-closeout-list]");
  if (!summary && !list) return;

  try {
    const closeout = await loadLaunchCloseout();
    const items = Array.isArray(closeout.items) ? closeout.items : [];
    const closed = items.filter((item) => item.status === "closed");
    if (summary) {
      summary.textContent = `${closed.length} of ${items.length} closeout items closed`;
    }
    if (list) {
      list.innerHTML = items.length
        ? items.map(launchCloseoutMarkup).join("")
        : "<li>No launch closeout items found.</li>";
    }
    trackEvent("launch_closeout_view", {
      closed: closed.length,
      total: items.length
    });
  } catch {
    if (summary) summary.textContent = "Launch closeout unavailable";
    if (list) list.innerHTML = "<li>Launch closeout could not be loaded.</li>";
  }
}

function actionInventoryEntries(summary = {}, limit = 12) {
  return Object.entries(summary || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function renderActionInventoryList(list, items, fallback) {
  if (!list) return;
  if (!items.length) {
    list.innerHTML = `<li>${escapeHtml(fallback)}</li>`;
    return;
  }
  list.innerHTML = items.map((item) => (
    `<li><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.count)} action${item.count === 1 ? "" : "s"}</span></li>`
  )).join("");
}

async function renderActionInventoryReport() {
  const panel = document.querySelector('[data-action-inventory="panel"]');
  if (!panel) return;
  const summary = panel.querySelector('[data-action-inventory="summary"]');
  const detail = panel.querySelector('[data-action-inventory="detail"]');
  const typeList = panel.querySelector('[data-action-inventory="types"]');
  const eventList = panel.querySelector('[data-action-inventory="events"]');
  const routeList = panel.querySelector('[data-action-inventory="routes"]');

  try {
    const inventory = await loadActionInventory();
    const actions = inventory.actionCount || inventory.actions.length || 0;
    const routes = inventory.routeCount || Object.keys(inventory.summary?.byRoute || {}).length;
    if (summary) {
      summary.textContent = `${actions} actions across ${routes} surfaces`;
    }
    if (detail) {
      detail.textContent = `Build ${inventory.buildAssetVersion || publicBuildVersion}. Covers navigation, capture, media, consent, portal, and reporting controls.`;
    }
    renderActionInventoryList(typeList, actionInventoryEntries(inventory.summary?.byType), "No action types found.");
    renderActionInventoryList(eventList, actionInventoryEntries(inventory.summary?.byReportingEvent), "No report events found.");
    renderActionInventoryList(routeList, actionInventoryEntries(inventory.summary?.byRoute), "No route coverage found.");
    trackEvent("action_inventory_view", {
      actions,
      routes,
      version: inventory.version || null
    });
  } catch {
    if (summary) summary.textContent = "Action coverage unavailable";
    if (detail) detail.textContent = "The action inventory could not be loaded from this browser.";
    renderActionInventoryList(typeList, [], "Action types unavailable.");
    renderActionInventoryList(eventList, [], "Report events unavailable.");
    renderActionInventoryList(routeList, [], "Route coverage unavailable.");
  }
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

function fanSignalLabel(score) {
  if (score >= 30) return ["Signal Holder", "You have a strong local path across media, access, and return actions."];
  if (score >= 16) return ["Circle Path", "Your local signal is building across the Lux Veritas world."];
  if (score >= 7) return ["Listener", "You have started a real local path through the work."];
  return ["First Signal", "Start by listening, watching, or joining for first access."];
}

function fanSignalActivityLabel(item) {
  if (item.client_submission_id) return item.formType === "portal_signin" ? "Portal access check" : "Access request prepared";
  if (item.action) return `${item.title || "Media"} ${item.action}`;
  if (item.status && item.email) return "Portal email checked";
  if (item.event === "form_open") return `Opened ${item.detail?.formType || "access"} form`;
  if (item.event === "media_action") return `${item.detail?.title || "Media"} ${item.detail?.action || "action"}`;
  if (item.event === "fan_reaction") return `${item.detail?.title || "Media"} ${item.detail?.reaction_label || item.detail?.reaction || "reaction"}`;
  if (item.event === "link_click") return item.detail?.destination || "Page opened";
  return item.event || "Signal recorded";
}

function fanSignalState() {
  const report = localReportData();
  const meaningfulEvents = report.events.filter((item) => (
    ["form_open", "link_click"].includes(item.event)
  ));
  const engagementEvents = report.events.filter((item) => (
    ["form_open", "lead_accepted", "lead_fallback", "portal_signin_capture", "media_action", "link_click"].includes(item.event)
  ));
  const score = (report.media.length * 3)
    + (report.submissions.length * 5)
    + (report.portal.length * 4)
    + engagementEvents.length;
  const [tier, detail] = fanSignalLabel(score);
  const latest = [...report.media, ...report.submissions, ...report.portal, ...meaningfulEvents]
    .filter(Boolean)
    .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")))
    .slice(0, 4);

  return {
    generatedAt: new Date().toISOString(),
    source: "luxveritas.media",
    buildVersion: publicBuildVersion,
    tier,
    detail,
    score,
    counts: report.counts,
    latest: latest.map((item) => ({
      label: fanSignalActivityLabel(item),
      timestamp: item.timestamp || null,
      page: item.page || item.source_page || null,
      type: item.event || item.action || item.formType || item.status || "signal"
    }))
  };
}

function renderFanSignal() {
  const panels = [...document.querySelectorAll("[data-fan-signal]")];
  if (!panels.length) return;

  const state = fanSignalState();

  for (const panel of panels) {
    const tierNode = panel.querySelector("[data-fan-signal-tier]");
    const detailNode = panel.querySelector("[data-fan-signal-detail]");
    if (tierNode) tierNode.textContent = state.tier;
    if (detailNode) detailNode.textContent = state.detail;

    for (const key of ["media", "submissions", "portal"]) {
      const node = panel.querySelector(`[data-fan-signal-count="${key}"]`);
      if (node) node.textContent = String(state.counts[key] || 0);
    }

    const list = panel.querySelector("[data-fan-signal-list]");
    if (!list) continue;
    if (!state.latest.length) {
      list.innerHTML = "<li>Your first signal will appear here.</li>";
      continue;
    }
    list.innerHTML = state.latest.map((item) => {
      const label = item.label;
      const time = item.timestamp ? new Date(item.timestamp).toLocaleDateString() : "Recent";
      return `<li><strong>${escapeHtml(label)}</strong><span>${escapeHtml(time)}</span></li>`;
    }).join("");
  }
}

function exportFanSignalPass(button) {
  const state = fanSignalState();
  const filename = `luxveritas-signal-pass-${new Date().toISOString().slice(0, 10)}.json`;
  downloadTextFile(filename, JSON.stringify(state, null, 2), "application/json");
  trackInteraction("fan_signal_export", button, {
    tier: state.tier,
    score: state.score,
    media: state.counts.media,
    submissions: state.counts.submissions,
    portal: state.counts.portal
  });
  const panel = button?.closest("[data-fan-signal]");
  const detail = panel?.querySelector("[data-fan-signal-detail]");
  if (detail) detail.textContent = "Signal pass saved from this device. Keep it as a local receipt of your path.";
}

function downloadTextFile(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  document.documentElement.dataset.lastDownloadName = filename;
  document.documentElement.dataset.lastDownloadType = type;
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
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
      detail: item.source_type || item.sourceType || item.status || item.milestone || ""
    })),
    ...report.submissions.map((item) => ({
      source: "local",
      type: "submission",
      timestamp: item.timestamp || "",
      page: item.source_page || "",
      label: item.client_submission_id || item.formType || "",
      detail: item.interest_paths?.join(", ") || item.delivery_status || item.inquiry_type || item.role_path || ""
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
  const handoffs = report.latest?.handoffs || [];
  return [
    ...submissions.map((item) => ({
      source: "protected",
      type: "submission",
      timestamp: item.createdAt || "",
      page: item.page || "",
      label: item.client_submission_id || item.formType || item.inquiry_type || "",
      detail: item.routing_queue || item.deliveryStatus || item.role_path || item.access_path || ""
    })),
    ...events.map((item) => ({
      source: "protected",
      type: item.event || "event",
      timestamp: item.createdAt || "",
      page: item.page || "",
      label: item.detail?.label || item.detail?.reaction_label || item.detail?.surface || item.detail?.action || "",
      detail: item.detail?.destination || item.detail?.formType || item.detail?.title || ""
    })),
    ...handoffs.map((item) => ({
      source: "protected",
      type: "handoff",
      timestamp: item.updatedAt || item.createdAt || "",
      page: item.sourcePage || "",
      label: item.receiptId || item.submissionId || "",
      detail: item.integrationTarget || item.routing_label || item.routing_queue || item.eventType || ""
    })),
    ...(report.summary?.intakeQueue?.queues || []).map((item) => ({
      source: "protected",
      type: "intake_queue",
      timestamp: report.generatedAt || "",
      page: "/portal/reporting.html",
      label: item.label || item.queue || "",
      detail: `${item.count || 0} open · ${item.reviewLabel || item.reviewSignal || "Review"} · ${item.nextAction || ""}`
    })),
    ...(report.summary?.workflowTargets?.queueRecommendations || []).map((item) => ({
      source: "protected",
      type: "workflow_target",
      timestamp: report.generatedAt || "",
      page: "/portal/reporting.html",
      label: item.recommendedLabel || item.recommendedPrimary || "",
      detail: `${item.label || item.queue || "Queue"}: ${item.count || 0} signal${item.count === 1 ? "" : "s"}`
    })),
    ...(report.summary?.retentionPaths?.topPathways || []).map((item) => ({
      source: "protected",
      type: "retention_path",
      timestamp: report.generatedAt || "",
      page: "/portal/reporting.html",
      label: item.label || item.intent || item.cta_id || "",
      detail: `${item.surface || "pathway"} · ${item.destination || "destination"} · ${item.count || 0} click${item.count === 1 ? "" : "s"}`
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
  renderFanSignal();
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

  const authMode = panel.querySelector('[data-private-auth="mode"]');
  const authViewer = panel.querySelector('[data-private-auth="viewer"]');
  if (authMode) authMode.textContent = report.authMode || "approved";
  if (authViewer) authViewer.textContent = report.viewer || "Approved operator";

  renderPrivateDelivery(panel, report.delivery);
  renderPrivateQueue(panel, report.summary?.intakeQueue);
  renderPrivateWorkflow(panel, report.summary?.workflowTargets);
  renderPrivateRetention(panel, report.summary?.retentionPaths);
  renderLaunchReadinessReport(report);
  renderPrivateFunnel(panel, report.summary?.funnel || report.funnel);
  renderPrivateSummary(panel, "forms", report.summary?.submissions?.byFormType);
  renderPrivateSummary(panel, "roles", report.summary?.submissions?.byRolePath);
  renderPrivateSummary(panel, "interests", report.summary?.submissions?.byInterestPath);
  renderPrivateSummary(panel, "routing", report.summary?.submissions?.byRoutingQueue);
  renderPrivateSummary(panel, "delivery", report.summary?.submissions?.byDeliveryStatus);
  renderPrivateSummary(panel, "integrations", report.summary?.submissions?.byIntegrationStatus);
  renderPrivateSummary(panel, "handoffs", report.summary?.handoffs?.byTarget || report.summary?.handoffs?.byRoutingQueue);
  renderPrivateSummary(panel, "events", report.summary?.events?.byEvent);
  renderPrivateSummary(panel, "ctas", report.summary?.events?.byCtaId || report.summary?.events?.byCtaLabel);
  renderPrivateSummary(panel, "destinations", report.summary?.events?.byDestination || report.summary?.events?.byPage);
  renderPrivateSummary(panel, "pathways", report.summary?.retentionPaths?.topPathways);
  renderPrivateSummary(panel, "pathway-surfaces", report.summary?.retentionPaths?.bySurface);
  renderPrivateSummary(panel, "playback", report.summary?.events?.playbackByAction);
  renderPrivateSummary(panel, "playback-sources", report.summary?.events?.playbackBySourceType || report.summary?.events?.playbackByReportingKey);
  renderPrivateSummary(panel, "playback-milestones", report.summary?.events?.playbackMilestones);
  renderPrivateSummary(panel, "reactions", report.summary?.events?.fanReactions || report.summary?.events?.fanReactionsBySource);

  const list = panel.querySelector("[data-private-report-list]");
  if (!list) return;

  const items = [
    ...(report.latest?.submissions || []).map((item) => ({ ...item, type: "submission" })),
    ...(report.latest?.events || []).map((item) => ({ ...item, type: "event" })),
    ...(report.latest?.handoffs || []).map((item) => ({ ...item, type: "handoff" }))
  ].sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))).slice(0, 12);

  if (!items.length) {
    list.innerHTML = "<li>No protected activity found yet.</li>";
    return;
  }

  list.innerHTML = items.map((item) => {
    const label = item.receiptId || item.client_submission_id || item.event || item.type || "activity";
    const detail = item.integrationTarget || item.routing_label || item.routing_queue || item.detail?.destination || item.detail?.formType || item.detail?.surface || item.formType || item.inquiry_type || item.page || item.sourcePage || item.role_path || "Lux Veritas";
    const time = item.updatedAt || item.createdAt ? new Date(item.updatedAt || item.createdAt).toLocaleString() : "Recent";
    return `<li><strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail)}</span><small>${escapeHtml(time)}</small></li>`;
  }).join("");
}

function renderPrivateRetention(panel, retention = {}) {
  const summary = panel.querySelector('[data-private-retention="summary"]');
  const detail = panel.querySelector('[data-private-retention="detail"]');
  const list = panel.querySelector('[data-private-retention="list"]');
  const total = retention.totalClicks ?? 0;
  const flywheel = retention.fanFlywheelClicks ?? 0;
  const brandHouse = retention.brandHouseClicks ?? 0;
  if (summary) {
    summary.textContent = `${total} pathway click${total === 1 ? "" : "s"}`;
  }
  if (detail) {
    detail.textContent = `${flywheel} fan journey · ${brandHouse} brand house · sample ${retention.sampleSize ?? 0}`;
  }
  if (!list) return;
  const items = Array.isArray(retention.topPathways) ? retention.topPathways : [];
  if (!items.length) {
    list.innerHTML = "<li>Load private activity to view retention paths.</li>";
    return;
  }
  list.innerHTML = items.map((item) => (
    `<li><strong>${escapeHtml(item.label || item.intent || item.cta_id || "Pathway")}</strong><span>${escapeHtml(item.count || 0)} click${item.count === 1 ? "" : "s"}</span><small>${escapeHtml(item.surface || "pathway")} · ${escapeHtml(item.destination || "")}</small></li>`
  )).join("");
}

function renderPrivateQueue(panel, queue = {}) {
  const summary = panel.querySelector('[data-private-queue="summary"]');
  const detail = panel.querySelector('[data-private-queue="detail"]');
  const list = panel.querySelector('[data-private-queue="list"]');
  if (summary) {
    summary.textContent = `${queue.openItems ?? 0} open · ${queue.highPriority ?? 0} high priority`;
  }
  if (detail) {
    const pendingInbox = queue.pendingInbox ?? 0;
    const pendingHandoff = queue.pendingHandoff ?? 0;
    const nextAction = queue.nextAction || "Load private activity to view queue actions.";
    detail.textContent = `${nextAction} Pending inbox: ${pendingInbox}. Pending handoff: ${pendingHandoff}.`;
  }
  if (!list) return;
  const items = Array.isArray(queue.queues) ? queue.queues : [];
  if (!items.length) {
    list.innerHTML = "<li>Load private activity to view intake queues.</li>";
    return;
  }
  list.innerHTML = items.map((item) => {
    const delivery = `${item.sentInbox || 0} sent · ${item.pendingInbox || 0} pending inbox · ${item.pendingHandoff || 0} pending handoff`;
    const age = item.oldestAgeDays ? `Oldest: ${item.oldestAgeDays} day${item.oldestAgeDays === 1 ? "" : "s"}` : "Recent";
    return `<li><strong>${escapeHtml(item.label || item.queue)}</strong><span>${escapeHtml(item.reviewLabel || item.priority || "Review")} · ${escapeHtml(item.count || 0)} open · ${escapeHtml(item.sla || "")}</span><small>${escapeHtml(item.owner || "Operator")} · ${escapeHtml(item.nextAction || "")} · ${escapeHtml(delivery)} · ${escapeHtml(age)}</small></li>`;
  }).join("");
}

function renderPrivateWorkflow(panel, workflow = {}) {
  const primary = panel.querySelector('[data-private-workflow="primary"]');
  const detail = panel.querySelector('[data-private-workflow="detail"]');
  const targets = panel.querySelector('[data-private-workflow="targets"]');
  const queues = panel.querySelector('[data-private-workflow="queues"]');
  const guards = panel.querySelector('[data-private-workflow="guardrails"]');
  if (primary) {
    primary.textContent = workflow.recommendedLabel || "Load private activity";
  }
  if (detail) {
    const active = workflow.activeLabel || workflow.activeTarget || "Current private handoff";
    detail.textContent = workflow.nextAction
      ? `${workflow.nextAction} Active target: ${active}.`
      : "Load private activity to view the recommended workflow target.";
  }
  if (targets) {
    const items = Array.isArray(workflow.byRecommendedTarget) ? workflow.byRecommendedTarget : [];
    targets.innerHTML = items.length
      ? items.map((item) => (
        `<li><strong>${escapeHtml(item.label || item.target)}</strong><span>${escapeHtml(item.count || 0)} signal${item.count === 1 ? "" : "s"}</span></li>`
      )).join("")
      : "<li>Load private activity to view target demand.</li>";
  }
  if (queues) {
    const items = Array.isArray(workflow.queueRecommendations) ? workflow.queueRecommendations : [];
    queues.innerHTML = items.length
      ? items.map((item) => {
        const alternatives = Array.isArray(item.alternatives) && item.alternatives.length
          ? `Alt: ${item.alternatives.join(", ")}`
          : "No alternate target";
        return `<li><strong>${escapeHtml(item.label || item.queue)}</strong><span>${escapeHtml(item.recommendedLabel || item.recommendedPrimary)} · ${escapeHtml(item.count || 0)} signal${item.count === 1 ? "" : "s"}</span><small>${escapeHtml(alternatives)}</small></li>`;
      }).join("")
      : "<li>Load private activity to view queue recommendations.</li>";
  }
  if (guards) {
    const items = Array.isArray(workflow.guardrails) ? workflow.guardrails : [];
    guards.innerHTML = items.length
      ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
      : "<li>Choose a workflow owner before activation.</li>";
  }
}

function renderPrivateFunnel(panel, items = []) {
  const list = panel.querySelector("[data-private-funnel]");
  if (!list) return;
  if (!items.length) {
    list.innerHTML = "<li>No funnel records found yet.</li>";
    return;
  }
  list.innerHTML = items.map((item) => (
    `<li><strong>${escapeHtml(item.value ?? 0)}</strong><span>${escapeHtml(item.label || "Signal")}</span><small>${escapeHtml(item.detail || "Recent activity sample")}</small></li>`
  )).join("");
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
  const target = panel.querySelector('[data-private-delivery="target"]');
  const targetDetail = panel.querySelector('[data-private-delivery="targetDetail"]');
  const ready = delivery.inboxNotification === "ready";
  if (status) status.textContent = ready ? "Ready" : "Setup";
  if (detail) {
    const missing = Array.isArray(delivery.missing) && delivery.missing.length
      ? `Missing ${delivery.missing.join(", ")}`
      : "Store-first capture is ready";
    detail.textContent = ready ? "Inbox notifications active" : missing;
  }
  if (target) {
    target.textContent = delivery.integrationWebhook === "ready" && delivery.integrationTargetConfigured ? "Ready" : "Setup";
  }
  if (targetDetail) {
    const value = delivery.integrationTarget && delivery.integrationTarget !== "unconfigured"
      ? delivery.integrationTarget
      : "Target profile not configured";
    targetDetail.textContent = value;
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

async function replayPendingNotifications() {
  const token = document.querySelector("[data-report-token]")?.value.trim();
  if (!token) {
    setPrivateReportStatus("Enter an approved operator token first.");
    return;
  }

  setPrivateReportStatus("Checking pending inbox notifications...");
  try {
    const response = await fetch(reportEndpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ action: "replay_pending", limit: 20 })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || "replay_unavailable");
    if (result.skipped) {
      setPrivateReportStatus("Inbox provider is not configured yet. Stored submissions remain ready for replay.");
      return;
    }
    setPrivateReportStatus(`Replay checked ${result.checked || 0} pending record${result.checked === 1 ? "" : "s"} and sent ${result.replayed || 0}.`);
    await loadPrivateReport();
  } catch {
    setPrivateReportStatus("Pending notification replay is unavailable for this token.");
  }
}

async function replayPendingIntegration() {
  const token = document.querySelector("[data-report-token]")?.value.trim();
  if (!token) {
    setPrivateReportStatus("Enter an approved operator token first.");
    return;
  }

  setPrivateReportStatus("Checking pending private handoff...");
  try {
    const response = await fetch(reportEndpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ action: "replay_integration", limit: 20 })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || "handoff_replay_unavailable");
    if (result.skipped) {
      setPrivateReportStatus("Private handoff is not configured yet. Stored submissions remain ready for replay.");
      return;
    }
    setPrivateReportStatus(`Handoff replay checked ${result.checked || 0} pending record${result.checked === 1 ? "" : "s"} and sent ${result.replayed || 0}.`);
    await loadPrivateReport();
  } catch {
    setPrivateReportStatus("Pending handoff replay is unavailable for this token.");
  }
}

async function testInboxDelivery() {
  const token = document.querySelector("[data-report-token]")?.value.trim();
  if (!token) {
    setPrivateReportStatus("Enter an approved operator token first.");
    return;
  }

  setPrivateReportStatus("Testing inbox delivery...");
  try {
    const response = await fetch(reportEndpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ action: "test_inbox" })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || "inbox_test_unavailable");
    if (result.skipped) {
      setPrivateReportStatus("Inbox provider is not configured yet. Add the approved provider key before testing live email.");
      return;
    }
    if (result.sent) {
      setPrivateReportStatus("Inbox test sent. Check the Lux Veritas inbox for the provider test message.");
      await loadPrivateReport();
      return;
    }
    setPrivateReportStatus(`Inbox test checked but did not send: ${result.reason || "provider error"}.`);
  } catch {
    setPrivateReportStatus("Inbox test is unavailable for this token.");
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
  if (action === "replay-private") {
    replayPendingNotifications();
    return;
  }
  if (action === "replay-integration") {
    replayPendingIntegration();
    return;
  }
  if (action === "test-inbox") {
    testInboxDelivery();
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

  const actionItem = [...player.querySelectorAll("[data-media-item]")]
    .find((item) => item.dataset.action === action || item.dataset.kind === action);
  if (actionItem && !actionItem.classList.contains("active")) {
    setActiveMediaItem(player, actionItem, { record: false });
  }

  const title = player.querySelector("[data-media-title]")?.textContent?.trim() || "SPMVP";
  const status = player.querySelector("[data-media-status]");
  const activeItem = player.querySelector(".media-item.active");
  const approvedSource = activeItem?.dataset.sourceUrl;
  const sourceType = activeItem?.dataset.sourceType;
  const posterUrl = activeItem?.dataset.posterUrl;
  const sourceReady = /^https:\/\//i.test(approvedSource || "");
  const messages = {
    play: `${title} listen intent recorded. Full audio source attaches here when the approved release link is live.`,
    watch: `${title} watch intent recorded. Public video routing is ready for the approved visual source.`,
    radio: "Lux Radio intent recorded. Programming slots, live-room notes, and future episodes will attach here."
  };

  if (status) status.textContent = messages[action] || "Media intent recorded.";
  setMediaProgress(player, action === "play" ? 48 : action === "watch" ? 66 : 82);
  writeMediaEvent(action, player, activeItem?.dataset || {});
  updateMediaReport(player);
  renderFanSignal();

  if (sourceReady) {
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
    instrumentMediaElement(player, audio, item.sourceType);
    audio.dataset.playbackSourceType = item.sourceType || "";
    audio.hidden = false;
    audio.play().catch(() => {
      if (status) status.textContent = `${item.title} is ready. Press play in the audio control to begin.`;
    });
    return;
  }

  if (item.sourceType === "video" && video) {
    video.src = item.sourceUrl;
    if (item.posterUrl) video.poster = item.posterUrl;
    instrumentMediaElement(player, video, item.sourceType);
    video.dataset.playbackSourceType = item.sourceType || "";
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
  if (submitButton.disabled) return;
  const defaultLabel = submitButton.dataset.defaultLabel || submitButton.textContent || "Send to Lux Veritas";
  submitButton.disabled = true;
  submitButton.setAttribute("aria-busy", "true");
  submitButton.textContent = "Sending...";
  const progressTimer = startSubmitProgress(statusBox, "Sending your request...");

  try {
    const data = Object.fromEntries(new FormData(dialogForm).entries());
    if (data.company_url) {
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
      interest_paths: selectedInterestPaths(dialogForm),
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
        renderFanSignal();
        return;
      }
      if (result.delivery === "stored") {
        showSubmissionSuccess(payload, storedSubmissionMessage(result));
        renderFanSignal();
        return;
      }
    } catch (error) {
      if ([400, 429].includes(error?.status)) {
        showSubmissionError(error);
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
    renderFanSignal();
  } catch (error) {
    showSubmissionError({
      message: error?.message || "submission_error",
      status: null,
      result: { errors: ["the page could not finish this request"] }
    });
  } finally {
    stopSubmitProgress(progressTimer);
    submitButton.disabled = false;
    submitButton.removeAttribute("aria-busy");
    submitButton.textContent = defaultLabel;
  }
}

function portalSigninPayload(email) {
  return {
    name: "Portal visitor",
    email,
    phone: "",
    role_path: "General",
    inquiry_type: "Portal",
    access_path: "general",
    portal_role_target: "visitor",
    inquiry_key: "portal",
    message: "Private portal sign-in/access check submitted from the sign-in shell.",
    formType: "portal_signin",
    tag: "portal-signin",
    source: "luxveritas.media",
    source_page: window.location.pathname,
    timestamp: new Date().toISOString(),
    client_submission_id: submissionReceiptId(),
    consent_email: false,
    consent_sms: false,
    company_url: "",
    delivery_status: "prepared",
    ...formLegalPayload()
  };
}

function setPortalSigninStatus(status, html) {
  if (!status) return;
  status.innerHTML = html;
  status.hidden = false;
}

async function handlePortalSignin(event) {
  event.preventDefault();
  if (!portalSigninForm?.reportValidity()) return;

  const email = portalSigninForm.email.value.trim().toLowerCase();
  const status = portalSigninForm.querySelector("[data-portal-status]");
  const submitButton = portalSigninForm.querySelector("[data-portal-signin]");
  const defaultLabel = submitButton?.textContent || "Continue";
  if (submitButton?.disabled) return;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    submitButton.textContent = "Checking...";
  }
  const attempts = readJson("luxveritas_portal_attempts", []);
  const progressTimer = startSubmitProgress(status, "Checking screened access...");
  const attempt = {
    email,
    source_page: window.location.pathname,
    timestamp: new Date().toISOString(),
    status: "screened_access_required"
  };
  const payload = portalSigninPayload(email);

  attempts.push(attempt);
  writeJson("luxveritas_portal_attempts", attempts.slice(-50));
  saveLocalSubmission(payload);
  trackEvent("portal_signin_attempt", {
    status: attempt.status,
    receipt: payload.client_submission_id
  });

  const dialogEmail = dialogForm?.querySelector('[name="email"]');
  if (dialogEmail && !dialogEmail.value) dialogEmail.value = email;

  try {
    const result = await submitToServer(payload);
    if (!["sent", "stored"].includes(result.delivery)) {
      const error = new Error(result.reason || "submission_fallback");
      error.result = result;
      throw error;
    }
    updateLocalSubmission(payload.client_submission_id, {
      delivery_status: result.delivery || "accepted",
      provider_submission_id: result.id || null,
      delivered_at: result.delivery === "sent" ? new Date().toISOString() : null
    });
    trackEvent("portal_signin_capture", {
      delivery: result.delivery || "accepted",
      receipt: payload.client_submission_id
    });
    setPortalSigninStatus(
      status,
      `Portal access request recorded.<br /><span class="receipt-code">Receipt ${escapeHtml(payload.client_submission_id)}</span><br />If this email is already approved, account access will open during the private portal phase.`
    );
    renderFanSignal();
  } catch (error) {
    if (error?.status === 429 || error?.message === "rate_limited") {
      setPortalSigninStatus(status, "Too many attempts from this browser. Please wait a few minutes and try again.");
      trackEvent("portal_signin_rejected", { reason: "rate_limited", status: 429 });
      return;
    }

    const body = submissionBody(payload);
    const href = mailtoHref(payload);
    const copied = await copySubmissionToClipboard(body);
    updateLocalSubmission(payload.client_submission_id, {
      delivery_status: error?.name === "AbortError" ? "submission_timeout" : "email_draft",
      fallback_at: new Date().toISOString()
    });
    trackEvent("portal_signin_fallback", {
      reason: error?.name === "AbortError" ? "submission_timeout" : "network_error",
      copied,
      receipt: payload.client_submission_id
    });
    setPortalSigninStatus(
      status,
      `Portal access is screened. The site could not confirm the access request from this browser.${copied ? " A copy has been placed on your clipboard." : ""}<br /><span class="receipt-code">Receipt ${escapeHtml(payload.client_submission_id)}</span><br /><a class="button button-primary" href="${escapeHtml(href)}">Open email draft</a> <button class="inline-link" type="button" data-open-form="request">Request Access</button>.`
    );
    renderFanSignal();
  } finally {
    stopSubmitProgress(progressTimer);
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
      submitButton.textContent = defaultLabel;
    }
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
    trackInteraction("consent_update", button, { value: button.dataset.consent });
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
  button.addEventListener("click", () => {
    trackInteraction("dialog_close", button, { dialog: "capture" });
    dialog?.close();
  });
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-form]");
  if (!button) return;
  event.preventDefault();
  trackInteraction("form_open", button, { formType: button.dataset.openForm || "request" });
  openForm(button.dataset.openForm);
  renderFanSignal();
});

document.addEventListener("click", (event) => {
  const exportButton = event.target.closest("[data-fan-signal-export]");
  if (!exportButton) return;
  event.preventDefault();
  exportFanSignalPass(exportButton);
});

document.addEventListener("click", (event) => {
  const item = event.target.closest("[data-media-item]");
  if (!item) return;
  event.preventDefault();
  trackInteraction("media_select", item, {
    media_id: item.dataset.mediaId || null,
    title: item.dataset.title || null,
    source_status: item.dataset.sourceStatus || null,
    reporting_key: item.dataset.reportingKey || null
  });
  setActiveMediaItem(item.closest("[data-media-player]"), item);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-media-action]");
  if (!button) return;
  event.preventDefault();
  handleMediaAction(button.dataset.mediaAction, button.closest("[data-media-player]"));
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-fan-reaction]");
  if (!button) return;
  event.preventDefault();
  writeFanReaction(button, button.closest("[data-media-player]"));
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // Offline support is progressive enhancement only.
    });
  });
}
renderMediaReadinessReport();
renderLaunchReadinessReport();
renderLaunchCloseoutReport();
renderActionInventoryReport();
renderLocalReport();
renderFanSignal();

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
