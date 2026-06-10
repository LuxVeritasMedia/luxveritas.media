import { createServer } from "node:http";
import { access, readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = "dist";
const externalBaseUrl = (process.env.LUX_BROWSER_BASE_URL || "").replace(/\/$/, "");
const bundledPlaywrightPath = "/Users/frederickparent/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const issues = [];
const submissions = [];
const events = [];
const reportRequests = [];

const mockReport = {
  ok: true,
  generatedAt: "2026-06-09T00:00:00.000Z",
  viewer: "info@luxveritas.media",
  authMode: "operator_token",
  counts: {
    submissions: 42,
    events: 128,
    privateHandoffs: 9,
    pendingNotifications: 7,
    pendingIntegrations: 11
  },
  latest: {
    submissions: [
      {
        id: "sub_qa_1",
        createdAt: "2026-06-09T00:00:00.000Z",
        formType: "fan",
        inquiry_type: "Membership",
        role_path: "Member",
        access_path: "member",
        portal_role_target: "member",
        inquiry_key: "membership",
        routing_queue: "membership_waitlist",
        routing_label: "Membership Waitlist",
        routing_priority: "standard",
        routing_next_action: "Send first-access follow-up",
        deliveryStatus: "stored",
        integrationStatus: "integration_not_configured",
        client_submission_id: "LV-QA-REPORT"
      }
    ],
    events: [
      {
        id: "evt_qa_1",
        createdAt: "2026-06-09T00:01:00.000Z",
        event: "media_action",
        page: "/music.html",
        detail: {
          cta_id: "media__media_action__play",
          action: "play",
          title: "SPMVP",
          surface: "media_player",
          destination: "/spmvp.html"
        }
      }
    ],
    handoffs: [
      {
        id: "handoff_qa_1",
        createdAt: "2026-06-09T00:02:00.000Z",
        updatedAt: "2026-06-09T00:03:00.000Z",
        eventType: "form.submission.received",
        integrationTarget: "firebase_handoff",
        submissionId: "sub_qa_1",
        receiptId: "LV-QA-HANDOFF",
        source: "luxveritas.media",
        sourcePage: "/membership.html",
        routing_queue: "membership_waitlist",
        routing_label: "Membership Waitlist",
        contact_email: "qa@luxveritas.media"
      }
    ]
  },
  delivery: {
    inboxNotification: "needs_setup",
    storeFirstCapture: "ready",
    integrationWebhook: "needs_setup",
    integrationTarget: "unconfigured",
    integrationTargetConfigured: false,
    operatorTokenConfigured: false,
    missing: ["RESEND_API_KEY", "FORM_INTEGRATION_URL", "FORM_INTEGRATION_TARGET", "REPORT_OPERATOR_TOKEN_SHA256"]
  },
  summary: {
    funnel: [
      { label: "Tracked views", value: 128, detail: "Consented page views in the recent activity sample" },
      { label: "Form opens", value: 42, detail: "33% of tracked views" },
      { label: "Server captures", value: 24, detail: "57% of form opens" },
      { label: "Media actions", value: 64, detail: "Listen, watch, radio, and media queue intent" }
    ],
    submissions: {
      byFormType: [{ label: "fan", count: 18 }],
      byRolePath: [{ label: "Member", count: 24 }],
      byRoutingQueue: [{ label: "Membership Waitlist", count: 24 }],
      byRoutingPriority: [{ label: "standard", count: 24 }],
      byDeliveryStatus: [{ label: "stored", count: 35 }, { label: "email_provider_not_configured", count: 7 }],
      byIntegrationStatus: [{ label: "integration_not_configured", count: 42 }]
    },
    handoffs: {
      byTarget: [{ label: "firebase_handoff", count: 9 }],
      byEventType: [{ label: "form.submission.received", count: 9 }],
      bySourcePage: [{ label: "/membership.html", count: 6 }],
      byRoutingQueue: [{ label: "Membership Waitlist", count: 6 }]
    },
    events: {
      byEvent: [{ label: "media_action", count: 64 }],
      byCtaId: [{ label: "media__media_action__play", count: 42 }],
      byDestination: [{ label: "/spmvp.html", count: 31 }],
      byPage: [{ label: "/music.html", count: 40 }]
    }
  }
};

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const flows = [
  { path: "/index.html", trigger: 'button[data-open-form="request"]', role: "General", inquiry: "Portal" },
  { path: "/join.html", trigger: 'button[data-open-form="fan"]', role: "Member", inquiry: "Membership" },
  { path: "/submissions.html", trigger: 'button[data-open-form="submission"]', role: "Creator", inquiry: "Submissions" },
  { path: "/membership.html", trigger: 'button[data-open-form="fan"]', role: "Member", inquiry: "Membership" },
  { path: "/store.html", trigger: 'button[data-open-form="fan"]', role: "Member", inquiry: "Membership" },
  { path: "/community.html", trigger: 'button[data-open-form="fan"]', role: "Member", inquiry: "Membership" },
  { path: "/investor.html", trigger: 'button[data-open-form="investor"]', role: "Investor", inquiry: "Investor" },
  { path: "/events.html", trigger: 'button[data-open-form="request"]', role: "General", inquiry: "Portal" },
  { path: "/contact.html", trigger: 'button[data-open-form="press"]', role: "Press", inquiry: "Press" }
];

function safePath(urlPath) {
  const path = decodeURIComponent(urlPath.split("?")[0] || "/");
  const filePath = path === "/" ? "/index.html" : path;
  const normalized = normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
  return join(root, normalized);
}

async function fileExists(path) {
  try {
    const info = await stat(path);
    return info.isFile();
  } catch {
    return false;
  }
}

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      let filePath = safePath(req.url || "/");
      if (!await fileExists(filePath) && !extname(filePath)) filePath = join(filePath, "index.html");
      if (!await fileExists(filePath)) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      const body = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream"
      });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error.message);
    }
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function loadPlaywright() {
  if (process.env.LUX_PLAYWRIGHT_MODULE) return import(`file://${process.env.LUX_PLAYWRIGHT_MODULE}`);
  try {
    await access(bundledPlaywrightPath);
    return import(`file://${bundledPlaywrightPath}`);
  } catch {
    return import("playwright");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCondition(condition, timeoutMs = 3000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return true;
    await sleep(intervalMs);
  }
  return condition();
}

async function launchBrowserWithRetry(chromium, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await chromium.launch({ headless: true });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(500 * attempt);
    }
  }
  throw lastError;
}

async function openFlow(page, baseUrl, flow) {
  const beforeCount = submissions.length;
  await page.goto(`${baseUrl}${flow.path}`, { waitUntil: "domcontentloaded" });
  await page.click(flow.trigger);
  await page.waitForSelector("[data-dialog][open]", { timeout: 5000 });

  const role = await page.locator('select[name="role_path"]').inputValue();
  const inquiry = await page.locator('select[name="inquiry_type"]').inputValue();
  if (role !== flow.role) issues.push(`${flow.path}: expected role path ${flow.role}, found ${role || "blank"}`);
  if (inquiry !== flow.inquiry) issues.push(`${flow.path}: expected inquiry type ${flow.inquiry}, found ${inquiry || "blank"}`);

  await page.fill('input[name="name"]', "Lux Browser QA");
  await page.fill('input[name="email"]', "qa@luxveritas.media");
  await page.fill('textarea[name="message"]', `Browser flow QA for ${flow.path}`);
  await page.check('input[name="consent_email"]');
  await page.click("[data-submit-form]");
  await page.waitForFunction(() => {
    const status = document.querySelector("[data-form-status]");
    return status && !status.hidden && /Received\. Thank you|Sent\. Thank you|Too many attempts|Please check/i.test(status.textContent || "");
  }, null, { timeout: 6000 });

  const statusText = await page.locator("[data-form-status]").innerText();
  if (!/Received\. Thank you\. Your request is recorded with Lux Veritas\./.test(statusText)) {
    issues.push(`${flow.path}: expected stored-submission success, found "${statusText.replace(/\s+/g, " ")}"`);
  }

  await page.waitForFunction(() => {
    const button = document.querySelector("[data-submit-form]");
    return button && !button.disabled && button.textContent.trim().toLowerCase() === "send to lux veritas";
  }, null, { timeout: 3000 }).catch(() => {});
  const buttonText = await page.locator("[data-submit-form]").innerText();
  const buttonDisabled = await page.locator("[data-submit-form]").isDisabled();
  if (buttonDisabled || buttonText.trim().toLowerCase() !== "send to lux veritas") {
    issues.push(`${flow.path}: submit button did not reset after submit (text="${buttonText}", disabled=${buttonDisabled})`);
  }

  const payload = submissions.at(-1);
  if (submissions.length !== beforeCount + 1 || !payload) {
    issues.push(`${flow.path}: mocked submit endpoint did not receive a payload`);
    return;
  }
  for (const field of ["client_submission_id", "name", "email", "role_path", "inquiry_type", "message", "source_page", "public_terms_version", "privacy_version", "terms_version", "submission_terms_version"]) {
    if (!payload[field]) issues.push(`${flow.path}: submitted payload missing ${field}`);
  }
  if (payload.role_path !== flow.role) issues.push(`${flow.path}: payload role_path mismatch`);
  if (payload.inquiry_type !== flow.inquiry) issues.push(`${flow.path}: payload inquiry_type mismatch`);
}

async function mediaFlow(page, baseUrl, path) {
  const beforeEventCount = events.length;
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("luxveritas_consent", "accepted"));
  await page.click('[data-media-action="play"]');
  await page.waitForFunction(() => {
    const sourceShell = document.querySelector("[data-media-source-shell]");
    const followup = document.querySelector("[data-media-followup]");
    return (sourceShell && !sourceShell.hidden) || (followup && !followup.hidden);
  }, null, { timeout: 5000 });

  const mediaState = await page.evaluate(() => {
    const sourceShell = document.querySelector("[data-media-source-shell]");
    const followup = document.querySelector("[data-media-followup]");
    const audio = document.querySelector("[data-media-audio]");
    const video = document.querySelector("[data-media-video]");
    return {
      sourceVisible: Boolean(sourceShell && !sourceShell.hidden),
      followupVisible: Boolean(followup && !followup.hidden),
      audioVisible: Boolean(audio && !audio.hidden),
      videoVisible: Boolean(video && !video.hidden)
    };
  });

  if (mediaState.sourceVisible) {
    if (!mediaState.audioVisible && !mediaState.videoVisible) {
      issues.push(`${path}: media source shell opened without playable audio or video`);
    }
  } else {
    const followupText = await page.locator("[data-media-followup]").innerText();
    if (!/Join for access|source opens|first access/i.test(followupText)) {
      issues.push(`${path}: media follow-up did not show conversion copy`);
    }
    await page.click("[data-media-followup-action]");
    await page.waitForSelector("[data-dialog][open]", { timeout: 5000 });
    const role = await page.locator('select[name="role_path"]').inputValue();
    const inquiry = await page.locator('select[name="inquiry_type"]').inputValue();
    if (role !== "Member" || inquiry !== "Membership") {
      issues.push(`${path}: media follow-up did not open membership defaults`);
    }
  }
  const mediaEvent = events.slice(beforeEventCount).find((item) => item.event === "media_action");
  if (!mediaEvent) {
    issues.push(`${path}: media action did not report to event endpoint`);
    return;
  }
  for (const field of ["source_status", "source_ready", "source_required", "reporting_key"]) {
    if (mediaEvent.detail?.[field] == null) issues.push(`${path}: media event missing ${field}`);
  }
  if (mediaState.sourceVisible) {
    if (mediaEvent.detail?.source_status !== "ready" || mediaEvent.detail?.source_ready !== true) {
      issues.push(`${path}: media event did not report ready source state`);
    }
  } else if (mediaEvent.detail?.source_status !== "queued" || mediaEvent.detail?.source_ready !== false) {
    issues.push(`${path}: media event did not report queued source state`);
  }
}

async function interactionReportingFlow(page, baseUrl) {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("luxveritas_consent"));
  await page.reload({ waitUntil: "domcontentloaded" });
  const beforeConsentEvents = events.length;
  await page.waitForSelector('[data-consent="accepted"]', { timeout: 5000 });
  await page.click('[data-consent="accepted"]');
  await waitForCondition(() => events.length > beforeConsentEvents);
  const consentEvent = events.slice(beforeConsentEvents).find((item) => item.event === "consent_update");
  if (!consentEvent) {
    issues.push(`/index.html: consent button did not report consent_update`);
  } else {
    for (const field of ["cta_id", "label", "surface", "intent", "value"]) {
      if (consentEvent.detail?.[field] == null) issues.push(`/index.html: consent_update missing ${field}`);
    }
    if (consentEvent.detail?.value !== "accepted") {
      issues.push(`/index.html: consent_update reported unexpected value ${consentEvent.detail?.value || "missing"}`);
    }
  }

  const beforeCloseEvents = events.length;
  await page.click('button[data-open-form="request"]');
  await page.waitForSelector("[data-dialog][open]", { timeout: 5000 });
  await page.click("[data-close-dialog]");
  await waitForCondition(() => events.length > beforeCloseEvents);
  const closeEvent = events.slice(beforeCloseEvents).find((item) => item.event === "dialog_close");
  if (!closeEvent) {
    issues.push(`/index.html: dialog close button did not report dialog_close`);
  } else {
    if (!closeEvent.detail?.cta_id || closeEvent.detail?.dialog !== "capture") {
      issues.push(`/index.html: dialog_close missing stable detail`);
    }
  }

  await page.goto(`${baseUrl}/music.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("luxveritas_consent", "accepted"));
  await page.reload({ waitUntil: "domcontentloaded" });
  const mediaItems = page.locator("[data-media-item]");
  if (await mediaItems.count() < 2) {
    issues.push(`/music.html: expected at least two media items for selection reporting`);
    return;
  }
  const beforeSelectEvents = events.length;
  await mediaItems.nth(1).click();
  await waitForCondition(() => events.length > beforeSelectEvents);
  const selectEvent = events.slice(beforeSelectEvents).find((item) => item.event === "media_select");
  if (!selectEvent) {
    issues.push(`/music.html: media item button did not report media_select`);
  } else {
    for (const field of ["cta_id", "media_id", "title", "source_status", "reporting_key"]) {
      if (selectEvent.detail?.[field] == null) issues.push(`/music.html: media_select missing ${field}`);
    }
  }
}

async function portalSigninFlow(page, baseUrl) {
  const beforeSubmitCount = submissions.length;
  const beforeEventCount = events.length;
  await page.goto(`${baseUrl}/auth/signin.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("luxveritas_consent", "accepted"));
  await page.fill('[data-portal-signin-form] input[name="email"]', "portal-qa@luxveritas.media");
  await page.click("[data-portal-signin]");
  await page.waitForFunction(() => {
    const status = document.querySelector("[data-portal-status]");
    return status && !status.hidden && /Portal access request recorded/i.test(status.textContent || "");
  }, null, { timeout: 6000 });

  const statusText = await page.locator("[data-portal-status]").innerText();
  if (!/Receipt LV-/.test(statusText)) {
    issues.push(`/auth/signin.html: portal sign-in status did not include a receipt`);
  }

  await page.waitForFunction(() => {
    const button = document.querySelector("[data-portal-signin]");
    return button && !button.disabled && button.textContent.trim().toLowerCase() === "continue";
  }, null, { timeout: 3000 }).catch(() => {});
  const buttonText = await page.locator("[data-portal-signin]").innerText();
  const buttonDisabled = await page.locator("[data-portal-signin]").isDisabled();
  if (buttonDisabled || buttonText.trim().toLowerCase() !== "continue") {
    issues.push(`/auth/signin.html: portal sign-in button did not reset after submit (text="${buttonText}", disabled=${buttonDisabled})`);
  }

  const payload = submissions.at(-1);
  if (submissions.length !== beforeSubmitCount + 1 || !payload) {
    issues.push(`/auth/signin.html: portal sign-in did not submit an access payload`);
    return;
  }
  for (const field of ["client_submission_id", "name", "email", "role_path", "inquiry_type", "message", "source_page", "public_terms_version", "privacy_version", "terms_version", "submission_terms_version"]) {
    if (!payload[field]) issues.push(`/auth/signin.html: portal sign-in payload missing ${field}`);
  }
  if (payload.formType !== "portal_signin") issues.push(`/auth/signin.html: portal sign-in payload formType mismatch`);
  if (payload.role_path !== "General" || payload.inquiry_type !== "Portal") {
    issues.push(`/auth/signin.html: portal sign-in payload did not route to General / Portal`);
  }
  if (payload.email !== "portal-qa@luxveritas.media") {
    issues.push(`/auth/signin.html: portal sign-in payload email mismatch`);
  }

  await waitForCondition(() => events.length > beforeEventCount);
  const captureEvent = events.slice(beforeEventCount).find((item) => item.event === "portal_signin_capture");
  if (!captureEvent) {
    issues.push(`/auth/signin.html: portal sign-in did not report portal_signin_capture`);
  } else if (!captureEvent.detail?.receipt || captureEvent.detail?.delivery !== "stored") {
    issues.push(`/auth/signin.html: portal_signin_capture missing receipt or delivery detail`);
  }
}

async function portalAccessFlow(page, baseUrl) {
  await page.goto(`${baseUrl}/portal/index.html`, { waitUntil: "domcontentloaded" });
  const html = await page.content();
  for (const role of ["member", "artist", "creator", "press", "partner", "investor", "operator"]) {
    if (!html.includes(`data-portal-role="${role}"`)) {
      issues.push(`/portal/index.html: missing portal role ${role}`);
    }
  }
  if (!html.includes('name="robots" content="noindex, nofollow"')) {
    issues.push("/portal/index.html: missing noindex metadata");
  }
  await page.click('[data-portal-role="creator"] [data-open-form="creator"]');
  await page.waitForSelector("[data-dialog][open]", { timeout: 5000 });
  const role = await page.locator('select[name="role_path"]').inputValue();
  const inquiry = await page.locator('select[name="inquiry_type"]').inputValue();
  if (role !== "Creator" || inquiry !== "Portal") {
    issues.push(`/portal/index.html: creator role card did not open creator access defaults`);
  }
}

async function operatorReportFlow(page, baseUrl) {
  await page.goto(`${baseUrl}/portal/reporting.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const summary = document.querySelector("[data-media-readiness-summary]");
    return summary && /source-ready|unavailable/i.test(summary.textContent || "");
  }, null, { timeout: 5000 });
  await page.waitForFunction(() => {
    const summary = document.querySelector("[data-launch-readiness-summary]");
    return summary && /launch gates ready|unavailable/i.test(summary.textContent || "");
  }, null, { timeout: 5000 });
  const mediaSummary = await page.locator("[data-media-readiness-summary]").innerText();
  const mediaReadiness = await page.locator("[data-media-readiness-list]").innerText();
  const launchSummaryBeforeLoad = await page.locator("[data-launch-readiness-summary]").innerText();
  const launchReadinessBeforeLoad = await page.locator("[data-launch-readiness-list]").innerText();
  if (!/3 of 3 source-ready/.test(mediaSummary)) {
    issues.push(`/portal/reporting.html: expected media readiness summary, found "${mediaSummary}"`);
  }
  if (!/1 of 7 launch gates ready/.test(launchSummaryBeforeLoad)) {
    issues.push(`/portal/reporting.html: expected launch readiness summary, found "${launchSummaryBeforeLoad}"`);
  }
  for (const label of ["SPMVP", "Visual World", "Lux Radio"]) {
    if (!mediaReadiness.includes(label)) {
      issues.push(`/portal/reporting.html: media readiness missing ${label}`);
    }
  }
  for (const label of ["Media Sources", "Inbox Notifications", "Privacy Review", "WWW Redirect"]) {
    if (!launchReadinessBeforeLoad.includes(label)) {
      issues.push(`/portal/reporting.html: launch readiness missing ${label}`);
    }
  }

  await page.click('[data-report-action="load-private"]');
  await page.waitForSelector("[data-private-report-status]:not([hidden])", { timeout: 5000 });
  let statusText = await page.locator("[data-private-report-status]").innerText();
  if (!/Enter an approved operator token first/i.test(statusText)) {
    issues.push(`/portal/reporting.html: missing empty-token status, found "${statusText}"`);
  }

  await page.fill("[data-report-token]", "qa-operator-token");
  await page.click('[data-report-action="load-private"]');
  await page.waitForFunction(() => {
    const status = document.querySelector("[data-private-report-status]");
    return status && /Private activity loaded\./i.test(status.textContent || "");
  }, null, { timeout: 6000 });

  statusText = await page.locator("[data-private-report-status]").innerText();
  if (!/Private activity loaded\./i.test(statusText)) {
    issues.push(`/portal/reporting.html: private report did not load, found "${statusText}"`);
  }
  await page.waitForFunction(() => {
    const list = document.querySelector("[data-launch-readiness-list]");
    return list && /Inbox notification provider is not active/i.test(list.textContent || "");
  }, null, { timeout: 5000 }).catch(() => {});

  const submissionCount = await page.locator('[data-private-count="submissions"]').innerText();
  const eventCount = await page.locator('[data-private-count="events"]').innerText();
  const privateHandoffCount = await page.locator('[data-private-count="privateHandoffs"]').innerText();
  const pendingHandoffCount = await page.locator('[data-private-count="pendingIntegrations"]').innerText();
  const deliveryStatus = await page.locator('[data-private-delivery="status"]').innerText();
  const deliveryDetail = await page.locator('[data-private-delivery="detail"]').innerText();
  const handoffTargetStatus = await page.locator('[data-private-delivery="target"]').innerText();
  const handoffTargetDetail = await page.locator('[data-private-delivery="targetDetail"]').innerText();
  const reportAuthMode = await page.locator('[data-private-auth="mode"]').innerText();
  const reportAuthViewer = await page.locator('[data-private-auth="viewer"]').innerText();
  const formsSummary = await page.locator('[data-private-summary="forms"]').innerText();
  const rolesSummary = await page.locator('[data-private-summary="roles"]').innerText();
  const routingSummary = await page.locator('[data-private-summary="routing"]').innerText();
  const deliverySummary = await page.locator('[data-private-summary="delivery"]').innerText();
  const integrationsSummary = await page.locator('[data-private-summary="integrations"]').innerText();
  const handoffsSummary = await page.locator('[data-private-summary="handoffs"]').innerText();
  const eventsSummary = await page.locator('[data-private-summary="events"]').innerText();
  const ctasSummary = await page.locator('[data-private-summary="ctas"]').innerText();
  const destinationsSummary = await page.locator('[data-private-summary="destinations"]').innerText();
  const funnelSummary = await page.locator("[data-private-funnel]").innerText();
  const launchSummary = await page.locator("[data-launch-readiness-summary]").innerText();
  const launchReadiness = await page.locator("[data-launch-readiness-list]").innerText();
  const latest = await page.locator("[data-private-report-list]").innerText();

  if (submissionCount !== "42") issues.push(`/portal/reporting.html: expected 42 submissions, found ${submissionCount}`);
  if (eventCount !== "128") issues.push(`/portal/reporting.html: expected 128 events, found ${eventCount}`);
  if (privateHandoffCount !== "9") issues.push(`/portal/reporting.html: expected 9 accepted handoffs, found ${privateHandoffCount}`);
  if (pendingHandoffCount !== "11") issues.push(`/portal/reporting.html: expected 11 pending integrations, found ${pendingHandoffCount}`);
  if (deliveryStatus !== "Setup") issues.push(`/portal/reporting.html: expected delivery setup status, found ${deliveryStatus}`);
  if (!/RESEND_API_KEY/.test(deliveryDetail) || !/FORM_INTEGRATION_URL/.test(deliveryDetail) || !/FORM_INTEGRATION_TARGET/.test(deliveryDetail)) {
    issues.push(`/portal/reporting.html: missing delivery setup detail`);
  }
  if (handoffTargetStatus !== "Setup") {
    issues.push(`/portal/reporting.html: expected handoff target setup status, found ${handoffTargetStatus}`);
  }
  if (!/Target profile not configured/i.test(handoffTargetDetail)) {
    issues.push(`/portal/reporting.html: missing handoff target detail`);
  }
  if (reportAuthMode !== "operator_token" || reportAuthViewer !== "info@luxveritas.media") {
    issues.push(`/portal/reporting.html: report auth details did not render`);
  }
  for (const [label, text] of [
    ["forms", formsSummary],
    ["roles", rolesSummary],
    ["routing", routingSummary],
    ["delivery", deliverySummary],
    ["integrations", integrationsSummary],
    ["handoffs", handoffsSummary],
    ["events", eventsSummary],
    ["ctas", ctasSummary],
    ["destinations", destinationsSummary],
    ["funnel", funnelSummary],
    ["latest", latest]
  ]) {
    if (!text || /Load private activity|No records found/i.test(text)) {
      issues.push(`/portal/reporting.html: ${label} report did not render loaded values`);
    }
  }
  if (!/LV-QA-REPORT/.test(latest) || !/media_action/.test(latest)) {
    issues.push(`/portal/reporting.html: latest protected activity missing mocked records`);
  }
  if (!/Membership Waitlist/.test(routingSummary)) {
    issues.push(`/portal/reporting.html: screened routing summary missing mocked queue`);
  }
  if (!/email_provider_not_configured/.test(deliverySummary)) {
    issues.push(`/portal/reporting.html: inbox outcomes summary missing mocked delivery status`);
  }
  if (!/firebase_handoff/.test(handoffsSummary) || !/LV-QA-HANDOFF/.test(latest)) {
    issues.push(`/portal/reporting.html: accepted handoff records did not render`);
  }
  const handoffExportReady = await page.evaluate(() => {
    return privateReportRows(privateReportCache).some((row) => (
      row.type === "handoff"
      && row.label === "LV-QA-HANDOFF"
      && row.detail === "firebase_handoff"
    ));
  });
  if (!handoffExportReady) {
    issues.push(`/portal/reporting.html: accepted handoff records were missing from private export rows`);
  }
  if (!/media__media_action__play/.test(ctasSummary)) {
    issues.push(`/portal/reporting.html: CTA signal summary missing mocked CTA ID`);
  }
  if (!/Server captures/.test(funnelSummary) || !/Media actions/.test(funnelSummary)) {
    issues.push(`/portal/reporting.html: pilot funnel missing capture/media values`);
  }
  if (!/1 of 7 launch gates ready/.test(launchSummary) || !/Inbox notification provider is not active/i.test(launchReadiness)) {
    issues.push(`/portal/reporting.html: launch gates did not render blocker state (summary="${launchSummary}", list="${launchReadiness.replace(/\s+/g, " ")}")`);
  }

  await page.click('[data-report-action="test-inbox"]');
  await page.waitForFunction(() => {
    const status = document.querySelector("[data-private-report-status]");
    return status && /Inbox provider is not configured yet/i.test(status.textContent || "");
  }, null, { timeout: 5000 });
  const inboxTestRequest = reportRequests.at(-1);
  if (inboxTestRequest?.body?.action !== "test_inbox") {
    issues.push(`/portal/reporting.html: test inbox did not send protected test_inbox action`);
  }

  for (const [action, expectedName] of [
    ["export-private-json", "luxveritas-private-report-"],
    ["export-private-csv", "luxveritas-private-report-"]
  ]) {
    await page.click(`[data-report-action="${action}"]`);
    await page.waitForFunction((name) => {
      return document.documentElement.dataset.lastDownloadName?.startsWith(name);
    }, expectedName, { timeout: 5000 });
    const filename = await page.evaluate(() => document.documentElement.dataset.lastDownloadName || "");
    if (!filename.startsWith(expectedName)) {
      issues.push(`/portal/reporting.html: ${action} suggested unexpected filename ${filename || "none"}`);
    }
  }

  const request = reportRequests.at(-1);
  if (!request || request.authorization !== "Bearer qa-operator-token") {
    issues.push(`/portal/reporting.html: private report did not send bearer token`);
  }

  const replayIntegrationButton = page.locator('[data-report-action="replay-integration"]');
  await replayIntegrationButton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await replayIntegrationButton.click();
  await page.waitForFunction(() => {
    const status = document.querySelector("[data-private-report-status]");
    return status && /Private handoff is not configured yet|Handoff replay checked/i.test(status.textContent || "");
  }, null, { timeout: 5000 });
}

const localServer = externalBaseUrl ? { server: null, baseUrl: externalBaseUrl } : await startServer();
const { server, baseUrl } = localServer;
let browser;
let context;

try {
  const { chromium } = await loadPlaywright();
  browser = await launchBrowserWithRetry(chromium);
  context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  await page.route("**/api/submit", async (route) => {
    const payload = JSON.parse(route.request().postData() || "{}");
    submissions.push(payload);
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        delivery: "stored",
        reason: "qa_mock",
        id: payload.client_submission_id || "LV-BROWSER-QA",
        stored: true
      })
    });
  });

  await page.route("**/api/event", async (route) => {
    const payload = JSON.parse(route.request().postData() || "{}");
    events.push(payload);
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, delivery: "stored", id: "LV-EVENT-QA", stored: true })
    });
  });

  await page.route("**/api/report", async (route) => {
    const postData = route.request().postData();
    reportRequests.push({
      authorization: route.request().headers().authorization || "",
      body: postData ? JSON.parse(postData) : null
    });
    if (postData && JSON.parse(postData).action === "replay_integration") {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          replayed: 0,
          checked: 0,
          skipped: true,
          reason: "integration_not_configured"
        })
      });
      return;
    }
    if (postData && JSON.parse(postData).action === "test_inbox") {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          sent: false,
          skipped: true,
          reason: "email_provider_not_configured"
        })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockReport)
    });
  });

  for (const flow of flows) {
    await openFlow(page, baseUrl, flow);
  }
  await interactionReportingFlow(page, baseUrl);
  await portalSigninFlow(page, baseUrl);
  for (const path of ["/music.html", "/spmvp.html"]) {
    await mediaFlow(page, baseUrl, path);
  }
  await portalAccessFlow(page, baseUrl);
  await operatorReportFlow(page, baseUrl);
} catch (error) {
  issues.push(`browser flow failed: ${error.stack || error.message}`);
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}

if (issues.length) {
  console.error(`Browser flow QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Browser flow QA passed for ${flows.length} form flows, portal sign-in, 2 media flows, interaction reporting, and operator reporting at ${baseUrl}.`);
