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
let submitMode = "stored";
const buildManifest = JSON.parse(await readFile("data/lux-build-manifest.json", "utf8"));
const actionInventory = JSON.parse(await readFile("data/lux-action-inventory.json", "utf8"));
const openApprovals = JSON.parse(await readFile("data/lux-open-approvals.json", "utf8"));
const expectedAssetVersion = buildManifest.assetVersion || buildManifest.version || "";

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
    pendingIntegrations: 0
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
        interest_paths: ["music", "events"],
        routing_queue: "membership_waitlist",
        routing_label: "Membership Waitlist",
        routing_priority: "standard",
        routing_next_action: "Send first-access follow-up",
        deliveryStatus: "stored",
        integrationStatus: "sent",
        client_submission_id: "LV-QA-REPORT"
      },
      {
        id: "sub_qa_feedback",
        createdAt: "2026-06-09T00:04:00.000Z",
        formType: "feedback",
        inquiry_type: "Pilot Feedback",
        role_path: "General",
        access_path: "general",
        portal_role_target: "visitor",
        inquiry_key: "pilot_feedback",
        interest_paths: ["music"],
        routing_queue: "access_review",
        routing_label: "Pilot Feedback",
        routing_priority: "high",
        routing_next_action: "Review tester issue and update release QA notes",
        deliveryStatus: "sent",
        integrationStatus: "sent",
        source_page: "/pilot-feedback.html",
        client_submission_id: "LV-QA-FEEDBACK"
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
      },
      {
        id: "evt_qa_2",
        createdAt: "2026-06-09T00:01:30.000Z",
        event: "media_playback",
        page: "/music.html",
        detail: {
          cta_id: "music__media_playback__ended",
          action: "ended",
          title: "SPMVP",
          source_type: "audio",
          reporting_key: "spmvp_release_audio",
          milestone: "ended",
          progress_percent: 100
        }
      },
      {
        id: "evt_qa_3",
        createdAt: "2026-06-09T00:02:00.000Z",
        event: "fan_reaction",
        page: "/music.html",
        detail: {
          cta_id: "music__fan_reaction__collect",
          reaction: "collect",
          reaction_label: "Collect",
          title: "SPMVP",
          reporting_key: "spmvp_release_audio"
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
    inboxNotification: "ready",
    storeFirstCapture: "ready",
    integrationWebhook: "ready",
    integrationTarget: "firebase_handoff",
    integrationTargetConfigured: true,
    operatorTokenConfigured: true,
    missing: []
  },
  summary: {
    funnel: [
      { label: "Tracked views", value: 128, detail: "Consented page views in the recent activity sample" },
      { label: "Form opens", value: 42, detail: "33% of tracked views" },
      { label: "Server captures", value: 24, detail: "57% of form opens" },
      { label: "Media actions", value: 64, detail: "Listen, watch, radio, and media queue intent" },
      { label: "Playback events", value: 30, detail: "7 ended signals" }
    ],
    retentionPaths: {
      sampleSize: 128,
      totalClicks: 45,
      fanFlywheelClicks: 23,
      brandHouseClicks: 14,
      releaseRoomClicks: 8,
      topPathways: [
        {
          label: "Listen Start With Sound",
          count: 23,
          surface: "fan_flywheel",
          intent: "flywheel_listen",
          destination: "/music.html",
          cta_id: "fan_flywheel__link_click__flywheel_listen"
        },
        {
          label: "Lux Veritas Records",
          count: 14,
          surface: "brand_house",
          intent: "house_lvr",
          destination: "/music.html",
          cta_id: "brand_house__link_click__house_lvr"
        },
        {
          label: "Hold the object",
          count: 8,
          surface: "release_room",
          intent: "release_collect",
          destination: "/store.html",
          cta_id: "release_room__link_click__release_collect"
        }
      ],
      bySurface: [{ label: "fan_flywheel", count: 23 }, { label: "brand_house", count: 14 }, { label: "release_room", count: 8 }],
      byIntent: [{ label: "flywheel_listen", count: 23 }, { label: "house_lvr", count: 14 }, { label: "release_collect", count: 8 }],
      byDestination: [{ label: "/music.html", count: 37 }, { label: "/store.html", count: 8 }]
    },
    submissions: {
      byFormType: [{ label: "fan", count: 18 }],
      byRolePath: [{ label: "Member", count: 24 }],
      byInterestPath: [{ label: "music", count: 24 }, { label: "events", count: 12 }],
      byRoutingQueue: [{ label: "Membership Waitlist", count: 24 }],
      byRoutingPriority: [{ label: "standard", count: 24 }],
      byDeliveryStatus: [{ label: "stored", count: 35 }, { label: "email_provider_not_configured", count: 7 }],
      byIntegrationStatus: [{ label: "sent", count: 42 }]
    },
    pilotFeedback: {
      total: 3,
      highPriority: 3,
      pendingInbox: 0,
      pendingHandoff: 0,
      latestAt: "2026-06-09T00:04:00.000Z",
      oldestAgeDays: 0,
      bySourcePage: [{ label: "/pilot-feedback.html", count: 3 }],
      byDeliveryStatus: [{ label: "sent", count: 3 }],
      byIntegrationStatus: [{ label: "sent", count: 3 }],
      latest: [
        {
          receiptId: "LV-QA-FEEDBACK",
          sourcePage: "/pilot-feedback.html",
          routingPriority: "high",
          deliveryStatus: "sent",
          integrationStatus: "sent",
          nextAction: "Review tester issue and update release QA notes",
          createdAt: "2026-06-09T00:04:00.000Z"
        }
      ]
    },
    handoffs: {
      byTarget: [{ label: "firebase_handoff", count: 9 }],
      byEventType: [{ label: "form.submission.received", count: 9 }],
      bySourcePage: [{ label: "/membership.html", count: 6 }],
      byRoutingQueue: [{ label: "Membership Waitlist", count: 6 }]
    },
    intakeQueue: {
      sampleSize: 42,
      openItems: 24,
      highPriority: 0,
      pendingInbox: 7,
      pendingHandoff: 0,
      topQueue: "Membership Waitlist",
      nextAction: "Send first-access follow-up for Membership Waitlist.",
      queues: [
        {
          queue: "membership_waitlist",
          label: "Membership Waitlist",
          owner: "Membership operator",
          priority: "standard",
          sla: "3 business days",
          nextAction: "Send first-access follow-up",
          count: 24,
          pendingInbox: 7,
          pendingHandoff: 0,
          sentInbox: 17,
          acceptedHandoff: 24,
          highPriority: 0,
          oldestAgeDays: 1,
          latestAt: "2026-06-09T00:00:00.000Z",
          reviewSignal: "inbox_attention",
          reviewLabel: "Inbox attention"
        }
      ]
    },
    workflowTargets: {
      activeTarget: "firebase_handoff",
      activeLabel: "Firebase Private Handoff",
      decisionStatus: "demand_signal_ready",
      recommendedPrimary: "ghl_crm",
      recommendedLabel: "GoHighLevel CRM",
      recommendedSignalCount: 24,
      nextAction: "Review GoHighLevel CRM as the first external workflow candidate before changing Firebase secrets.",
      byRecommendedTarget: [{ target: "ghl_crm", label: "GoHighLevel CRM", count: 24 }],
      queueRecommendations: [
        {
          queue: "membership_waitlist",
          label: "Membership Waitlist",
          count: 24,
          recommendedPrimary: "ghl_crm",
          recommendedLabel: "GoHighLevel CRM",
          alternatives: ["google_workspace"],
          reason: "Membership and first-access leads benefit from tags, follow-up stages, and screened nurture."
        }
      ],
      guardrails: [
        "Choose one workflow owner before activation.",
        "Keep receiver URLs and signing material in Firebase Secret Manager only."
      ]
    },
    events: {
      byEvent: [{ label: "page_view", count: 32 }, { label: "media_action", count: 64 }],
      byCtaId: [{ label: "media__media_action__play", count: 42 }],
      byDestination: [{ label: "/spmvp.html", count: 31 }],
      byPage: [{ label: "/music.html", count: 40 }],
      playbackByAction: [{ label: "play", count: 18 }, { label: "ended", count: 7 }],
      playbackBySourceType: [{ label: "audio", count: 14 }, { label: "video", count: 9 }, { label: "stream", count: 5 }],
      playbackByReportingKey: [{ label: "spmvp_release_audio", count: 14 }],
      playbackMilestones: [{ label: "25%", count: 8 }, { label: "ended", count: 7 }],
      fanReactions: [{ label: "Collect", count: 12 }],
      fanReactionsBySource: [{ label: "spmvp_release_audio", count: 12 }]
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

function browserLaunchOptions() {
  const options = { headless: true };
  if (process.env.LUX_PLAYWRIGHT_CHANNEL) options.channel = process.env.LUX_PLAYWRIGHT_CHANNEL;
  if (process.env.LUX_PLAYWRIGHT_EXECUTABLE) options.executablePath = process.env.LUX_PLAYWRIGHT_EXECUTABLE;
  return options;
}

async function launchBrowserWithRetry(chromium, attempts = 3) {
  let lastError;
  const launchOptions = browserLaunchOptions();
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await chromium.launch(launchOptions);
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
  await page.check('input[name="interest_paths"][value="music"]');
  await page.check('input[name="interest_paths"][value="events"]');
  await page.check('input[name="consent_email"]');
  await clickSubmitButton(page);
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
  if (!Array.isArray(payload.interest_paths) || !payload.interest_paths.includes("music") || !payload.interest_paths.includes("events")) {
    issues.push(`${flow.path}: submitted payload missing expected interest paths`);
  }
}

async function clickSubmitButton(page) {
  const button = page.locator("[data-submit-form]").first();
  await button.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  await button.click({ force: true });
}

async function assertSubmitButtonReset(page, selector, label, timeout = 3000) {
  await page.waitForFunction(({ selector, label }) => {
    const button = document.querySelector(selector);
    return button && !button.disabled && button.textContent.trim().toLowerCase() === label;
  }, { selector, label }, { timeout }).catch(() => {});
  const buttonText = await page.locator(selector).innerText();
  const buttonDisabled = await page.locator(selector).isDisabled();
  if (buttonDisabled || buttonText.trim().toLowerCase() !== label) {
    issues.push(`submit reset failed for ${selector} (text="${buttonText}", disabled=${buttonDisabled})`);
  }
}

async function formFallbackFlow(page, baseUrl) {
  submitMode = "fallback";
  await page.goto(`${baseUrl}/join.html`, { waitUntil: "domcontentloaded" });
  await page.click('button[data-open-form="fan"]');
  await page.waitForSelector("[data-dialog][open]", { timeout: 5000 });
  await page.fill('input[name="name"]', "Lux Fallback QA");
  await page.fill('input[name="email"]', "fallback@luxveritas.media");
  await page.fill('textarea[name="message"]', "Browser fallback QA");
  await page.check('input[name="consent_email"]');
  await clickSubmitButton(page);
  await page.waitForFunction(() => {
    const status = document.querySelector("[data-form-status]");
    return status && !status.hidden && /Open email draft|direct handoff is not available/i.test(status.textContent || "");
  }, null, { timeout: 6000 });
  const statusText = await page.locator("[data-form-status]").innerText();
  if (!/Open email draft|direct handoff is not available/i.test(statusText)) {
    issues.push(`/join.html: fallback submit did not expose email-draft recovery`);
  }
  await assertSubmitButtonReset(page, "[data-submit-form]", "send to lux veritas");
  submitMode = "stored";
}

async function formRateLimitFlow(page, baseUrl) {
  submitMode = "rate_limited";
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
  await page.click('button[data-open-form="request"]');
  await page.waitForSelector("[data-dialog][open]", { timeout: 5000 });
  await page.fill('input[name="name"]', "Lux Rate QA");
  await page.fill('input[name="email"]', "rate@luxveritas.media");
  await page.fill('textarea[name="message"]', "Browser rate-limit QA");
  await clickSubmitButton(page);
  await page.waitForFunction(() => {
    const status = document.querySelector("[data-form-status]");
    return status && !status.hidden && /Too many attempts/i.test(status.textContent || "");
  }, null, { timeout: 6000 });
  await assertSubmitButtonReset(page, "[data-submit-form]", "send to lux veritas");
  submitMode = "stored";
}

async function portalFallbackFlow(page, baseUrl) {
  submitMode = "fallback";
  await page.goto(`${baseUrl}/auth/signin.html`, { waitUntil: "domcontentloaded" });
  await page.fill('[data-portal-signin-form] input[name="email"]', "portal-fallback@luxveritas.media");
  await page.click("[data-portal-signin]");
  await page.waitForFunction(() => {
    const status = document.querySelector("[data-portal-status]");
    return status && !status.hidden && /Open email draft|could not confirm/i.test(status.textContent || "");
  }, null, { timeout: 6000 });
  const statusText = await page.locator("[data-portal-status]").innerText();
  if (!/Open email draft|could not confirm/i.test(statusText)) {
    issues.push(`/auth/signin.html: portal fallback did not expose email-draft recovery`);
  }
  await assertSubmitButtonReset(page, "[data-portal-signin]", "continue");
  submitMode = "stored";
}

async function pageViewReportingFlow(page, baseUrl) {
  const beforeEventCount = events.length;
  await page.goto(`${baseUrl}/join.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("luxveritas_consent", "accepted"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForCondition(() => events.slice(beforeEventCount).some((item) => item.event === "page_view"), 6000);
  const pageView = events.slice(beforeEventCount).find((item) => item.event === "page_view");
  if (!pageView) {
    issues.push("/join.html: consented page view did not report to event endpoint");
    return;
  }
  if (pageView.page !== "/join.html") issues.push(`/join.html: page_view page mismatch ${pageView.page || "missing"}`);
  if (pageView.consent !== "accepted") issues.push("/join.html: page_view did not include accepted consent state");
  for (const [field, expected] of [
    ["surface", "page"],
    ["intent", "view"],
    ["source", "load"],
    ["buildVersion", expectedAssetVersion]
  ]) {
    if (pageView.detail?.[field] !== expected) {
      issues.push(`/join.html: page_view detail.${field} expected ${expected}, found ${pageView.detail?.[field] || "missing"}`);
    }
  }
  if (!pageView.detail?.title || !pageView.detail?.cta_id?.includes("page_view")) {
    issues.push("/join.html: page_view missing title or cta_id");
  }
}

async function clickMediaAction(page, action) {
  const button = page.locator(`[data-media-player] [data-media-action="${action}"]`).first();
  await button.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  await button.click({ force: true });
}

async function mediaFlow(page, baseUrl, path) {
  const beforeEventCount = events.length;
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("luxveritas_consent", "accepted"));
  await clickMediaAction(page, "play");
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
  await waitForCondition(() => events.slice(beforeEventCount).some((item) => item.event === "media_action"), 6000);
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

async function mediaActionMappingFlow(page, baseUrl) {
  const actionExpectations = [
    { action: "play", sourceType: "audio", reportingKey: "spmvp_release_audio", visible: "audio" },
    { action: "watch", sourceType: "video", reportingKey: "spmvp_visual_world", visible: "video" },
    { action: "radio", sourceType: "stream", reportingKey: "lux_radio_stream", visible: "audio" }
  ];

  for (const expected of actionExpectations) {
    const beforeEventCount = events.length;
    await page.goto(`${baseUrl}/music.html`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("luxveritas_consent", "accepted"));
    await clickMediaAction(page, expected.action);
    await page.waitForFunction(() => {
      const shell = document.querySelector("[data-media-source-shell]");
      return shell && !shell.hidden;
    }, null, { timeout: 5000 });

    const state = await page.evaluate(() => {
      const active = document.querySelector("[data-media-player] [data-media-item].active");
      const audio = document.querySelector("[data-media-audio]");
      const video = document.querySelector("[data-media-video]");
      return {
        sourceType: active?.dataset.sourceType || "",
        reportingKey: active?.dataset.reportingKey || "",
        audioVisible: Boolean(audio && !audio.hidden),
        videoVisible: Boolean(video && !video.hidden),
        title: document.querySelector("[data-media-title]")?.textContent || ""
      };
    });

    if (state.sourceType !== expected.sourceType) {
      issues.push(`/music.html: ${expected.action} selected sourceType ${state.sourceType || "missing"}, expected ${expected.sourceType}`);
    }
    if (state.reportingKey !== expected.reportingKey) {
      issues.push(`/music.html: ${expected.action} selected reportingKey ${state.reportingKey || "missing"}, expected ${expected.reportingKey}`);
    }
    if (expected.visible === "audio" && !state.audioVisible) {
      issues.push(`/music.html: ${expected.action} did not reveal audio playback shell`);
    }
    if (expected.visible === "video" && !state.videoVisible) {
      issues.push(`/music.html: ${expected.action} did not reveal video playback shell`);
    }

    const mediaEvent = events.slice(beforeEventCount).find((item) => item.event === "media_action" && item.detail?.action === expected.action);
    if (!mediaEvent) {
      issues.push(`/music.html: ${expected.action} did not report media_action`);
      continue;
    }
    if (mediaEvent.detail?.source_type !== expected.sourceType) {
      issues.push(`/music.html: ${expected.action} reported source_type ${mediaEvent.detail?.source_type || "missing"}, expected ${expected.sourceType}`);
    }
    if (mediaEvent.detail?.reporting_key !== expected.reportingKey) {
      issues.push(`/music.html: ${expected.action} reported reporting_key ${mediaEvent.detail?.reporting_key || "missing"}, expected ${expected.reportingKey}`);
    }
  }
}

async function musicHeroMediaFlow(page, baseUrl) {
  await page.goto(`${baseUrl}/music.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("luxveritas_consent", "accepted"));

  const heroListen = page.locator("main .hero-actions [data-media-action=\"play\"]").first();
  const heroWatch = page.locator("main .hero-actions [data-media-action=\"watch\"]").first();
  const heroJoin = page.locator("main .hero-actions [data-open-form=\"fan\"]").first();
  if (await heroListen.count() !== 1 || await heroWatch.count() !== 1 || await heroJoin.count() !== 1) {
    issues.push("/music.html: hero must expose Listen player action, Watch player action, and Join fan capture");
    return;
  }

  const beforeListenEvents = events.length;
  await heroListen.click();
  await page.waitForSelector("[data-media-audio]:not([hidden])", { timeout: 5000 });
  const listenState = await page.evaluate(() => {
    const active = document.querySelector("[data-media-player] [data-media-item].active");
    return {
      sourceType: active?.dataset.sourceType || "",
      reportingKey: active?.dataset.reportingKey || "",
      dialogOpen: Boolean(document.querySelector("[data-dialog][open]"))
    };
  });
  if (listenState.sourceType !== "audio" || listenState.reportingKey !== "spmvp_release_audio") {
    issues.push(`/music.html: hero Listen selected ${listenState.sourceType || "missing"} / ${listenState.reportingKey || "missing"}`);
  }
  if (listenState.dialogOpen) {
    issues.push("/music.html: hero Listen opened the capture dialog instead of the player");
  }
  const listenEvent = events.slice(beforeListenEvents).find((item) => item.event === "media_action" && item.detail?.action === "play");
  if (!listenEvent || listenEvent.detail?.reporting_key !== "spmvp_release_audio") {
    issues.push("/music.html: hero Listen did not report the release audio media action");
  }

  const beforeWatchEvents = events.length;
  await heroWatch.click();
  await page.waitForSelector("[data-media-video]:not([hidden])", { timeout: 5000 });
  const watchState = await page.evaluate(() => {
    const active = document.querySelector("[data-media-player] [data-media-item].active");
    return {
      sourceType: active?.dataset.sourceType || "",
      reportingKey: active?.dataset.reportingKey || "",
      dialogOpen: Boolean(document.querySelector("[data-dialog][open]"))
    };
  });
  if (watchState.sourceType !== "video" || watchState.reportingKey !== "spmvp_visual_world") {
    issues.push(`/music.html: hero Watch selected ${watchState.sourceType || "missing"} / ${watchState.reportingKey || "missing"}`);
  }
  if (watchState.dialogOpen) {
    issues.push("/music.html: hero Watch opened the capture dialog instead of the player");
  }
  const watchEvent = events.slice(beforeWatchEvents).find((item) => item.event === "media_action" && item.detail?.action === "watch");
  if (!watchEvent || watchEvent.detail?.reporting_key !== "spmvp_visual_world") {
    issues.push("/music.html: hero Watch did not report the visual media action");
  }
}

async function mediaPlaybackReportingFlow(page, baseUrl) {
  const playbackExpectations = [
    { action: "play", sourceType: "audio", selector: "[data-media-audio]" },
    { action: "watch", sourceType: "video", selector: "[data-media-video]" },
    { action: "radio", sourceType: "stream", selector: "[data-media-audio]" }
  ];

  for (const expected of playbackExpectations) {
    const beforeEventCount = events.length;
    await page.goto(`${baseUrl}/music.html`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("luxveritas_consent", "accepted"));
    await clickMediaAction(page, expected.action);
    await page.waitForSelector(`${expected.selector}:not([hidden])`, { timeout: 5000 });

    await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (!element) return;
      try {
        Object.defineProperty(element, "duration", { configurable: true, value: 100 });
      } catch {
        // Native media duration may be read-only; the event itself still verifies reporting.
      }
      try {
        Object.defineProperty(element, "currentTime", { configurable: true, value: 0 });
      } catch {
        element.currentTime = 0;
      }
      element.dispatchEvent(new Event("play"));
      try {
        Object.defineProperty(element, "currentTime", { configurable: true, value: 30 });
      } catch {
        element.currentTime = 30;
      }
      element.dispatchEvent(new Event("timeupdate"));
      element.dispatchEvent(new Event("pause"));
      try {
        Object.defineProperty(element, "currentTime", { configurable: true, value: 100 });
      } catch {
        element.currentTime = 100;
      }
      try {
        Object.defineProperty(element, "ended", { configurable: true, value: true });
      } catch {
        // Native ended state may be read-only; dispatching ended still exercises the listener.
      }
      element.dispatchEvent(new Event("ended"));
    }, expected.selector);

    await waitForCondition(() => (
      events.slice(beforeEventCount).some((item) => item.event === "media_playback" && item.detail?.action === "ended")
    ));

    const playbackEvents = events.slice(beforeEventCount).filter((item) => item.event === "media_playback");
    for (const action of ["play", "pause", "ended"]) {
      const found = playbackEvents.find((item) => item.detail?.action === action && item.detail?.source_type === expected.sourceType);
      if (!found) issues.push(`/music.html: ${expected.action} did not report ${expected.sourceType} playback ${action}`);
    }
    const milestone = playbackEvents.find((item) => (
      item.detail?.action === "milestone"
      && item.detail?.source_type === expected.sourceType
      && (expected.sourceType === "stream" || item.detail?.milestone === "25%")
    ));
    if (!milestone) {
      issues.push(`/music.html: ${expected.action} did not report ${expected.sourceType} playback milestone`);
    }

    const localPlayback = await page.evaluate((sourceType) => {
      const items = JSON.parse(localStorage.getItem("luxveritas_media_events") || "[]");
      return items.filter((item) => item.event === "media_playback" && item.source_type === sourceType).length;
    }, expected.sourceType);
    if (localPlayback < 3) {
      issues.push(`/music.html: ${expected.action} did not persist local ${expected.sourceType} playback events`);
    }
    const reportText = await page.locator("[data-media-report]").innerText();
    if (!/media signal/i.test(reportText)) {
      issues.push(`/music.html: ${expected.action} playback did not update media signal report`);
    }
  }
}

async function fanReactionFlow(page, baseUrl) {
  const beforeEventCount = events.length;
  await page.goto(`${baseUrl}/music.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("luxveritas_media_events");
    localStorage.setItem("luxveritas_consent", "accepted");
  });
  await page.waitForSelector('[data-fan-reaction="collect"]', { timeout: 5000 });
  await page.click('[data-fan-reaction="collect"]');
  await waitForCondition(() => (
    events.slice(beforeEventCount).some((item) => item.event === "fan_reaction" && item.detail?.reaction === "collect")
  ), 6000);

  const reaction = events.slice(beforeEventCount).find((item) => item.event === "fan_reaction");
  if (!reaction) {
    issues.push("/music.html: fan reaction did not report");
    return;
  }
  if (reaction.detail?.reaction_label !== "Collect") {
    issues.push(`/music.html: fan reaction label ${reaction.detail?.reaction_label || "missing"} did not match Collect`);
  }
  if (reaction.detail?.reporting_key !== "spmvp_release_audio") {
    issues.push(`/music.html: fan reaction reporting key ${reaction.detail?.reporting_key || "missing"} did not match active source`);
  }

  const localReaction = await page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem("luxveritas_media_events") || "[]");
    return items.find((item) => item.event === "fan_reaction" && item.reaction === "collect") || null;
  });
  if (!localReaction) {
    issues.push("/music.html: fan reaction was not saved to local signal events");
  }
  const reportText = await page.locator("[data-media-report]").innerText();
  if (!/Collect saved/i.test(reportText)) {
    issues.push(`/music.html: fan reaction did not update media report text (${reportText})`);
  }
  const sessionState = await page.evaluate(() => ({
    depth: document.querySelector("[data-media-session-depth]")?.textContent?.trim() || "",
    next: document.querySelector("[data-media-session-next]")?.textContent?.trim() || "",
    count: Number(document.querySelector("[data-media-session-count]")?.textContent?.trim() || "0"),
    source: document.querySelector("[data-media-session-source]")?.textContent?.trim() || ""
  }));
  if (sessionState.count < 1) {
    issues.push(`/music.html: media session did not count fan reaction activity`);
  }
  if (!/Signal opened|Returning signal|Circle ready/i.test(sessionState.depth)) {
    issues.push(`/music.html: media session depth did not advance after fan reaction (${sessionState.depth || "missing"})`);
  }
  if (!/replay|collect|invite|create|join|watch/i.test(sessionState.next)) {
    issues.push(`/music.html: media session next move did not guide fan retention (${sessionState.next || "missing"})`);
  }
  if (!/Audio|Signal|release/i.test(sessionState.source)) {
    issues.push(`/music.html: media session source label did not render active source (${sessionState.source || "missing"})`);
  }
}

async function fanSignalPassFlow(page, baseUrl) {
  await page.goto(`${baseUrl}/music.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("luxveritas_media_events");
    localStorage.removeItem("luxveritas_submissions");
    localStorage.removeItem("luxveritas_portal_attempts");
    localStorage.setItem("luxveritas_consent", "accepted");
    delete document.documentElement.dataset.lastDownloadName;
    delete document.documentElement.dataset.lastDownloadType;
  });
  await clickMediaAction(page, "play");
  await page.click('[data-fan-reaction="collect"]');
  await page.waitForFunction(() => {
    const value = Number(document.querySelector('[data-fan-signal-count="media"]')?.textContent?.trim() || "0");
    return value >= 1;
  }, null, { timeout: 5000 });
  const signalList = await page.locator("[data-fan-signal-list]").innerText();
  if (!/SPMVP play/i.test(signalList) || !/SPMVP Collect/i.test(signalList)) {
    issues.push(`/music.html: fan signal list did not capture media play and fan reaction`);
  }

  await page.click("[data-fan-signal-export]");
  await page.waitForFunction(() => {
    return document.documentElement.dataset.lastDownloadName?.startsWith("luxveritas-signal-pass-")
      && document.documentElement.dataset.lastDownloadType === "application/json";
  }, null, { timeout: 5000 });
  const exportState = await page.evaluate(() => ({
    filename: document.documentElement.dataset.lastDownloadName || "",
    type: document.documentElement.dataset.lastDownloadType || "",
    detail: document.querySelector("[data-fan-signal-detail]")?.textContent || "",
    receiptVisible: Boolean(document.querySelector("[data-fan-signal-receipt]") && !document.querySelector("[data-fan-signal-receipt]").hidden),
    receiptTier: document.querySelector("[data-fan-signal-receipt-tier]")?.textContent || "",
    receiptDetail: document.querySelector("[data-fan-signal-receipt-detail]")?.textContent || "",
    storedReceipt: JSON.parse(localStorage.getItem("luxveritas_signal_pass_receipt") || "null")
  }));
  if (!exportState.filename.startsWith("luxveritas-signal-pass-")) {
    issues.push(`/music.html: signal pass export suggested unexpected filename ${exportState.filename || "none"}`);
  }
  if (exportState.type !== "application/json") {
    issues.push(`/music.html: signal pass export used unexpected type ${exportState.type || "none"}`);
  }
  if (!/Signal pass saved/i.test(exportState.detail)) {
    issues.push(`/music.html: signal pass export did not confirm local receipt`);
  }
  if (!exportState.receiptVisible) {
    issues.push("/music.html: signal pass export did not reveal visible local receipt");
  }
  if (!/Listener|Circle Path|Signal Holder|First Signal/i.test(exportState.receiptTier)) {
    issues.push(`/music.html: signal pass receipt tier was not rendered (${exportState.receiptTier || "missing"})`);
  }
  if (!/score/i.test(exportState.receiptDetail) || !/media/i.test(exportState.receiptDetail)) {
    issues.push(`/music.html: signal pass receipt detail did not summarize score and media (${exportState.receiptDetail || "missing"})`);
  }
  if (!exportState.storedReceipt?.counts || exportState.storedReceipt.counts.media < 1) {
    issues.push("/music.html: signal pass receipt did not persist fan signal counts");
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

async function pathwayLinkReportingFlow(page, baseUrl) {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("luxveritas_consent", "accepted"));
  await page.reload({ waitUntil: "domcontentloaded" });

  const beforeFlywheelEvents = events.length;
  await page.click('[data-fan-flywheel-stage="listen"]');
  await waitForCondition(() => (
    events.slice(beforeFlywheelEvents).some((item) => (
      item.event === "link_click"
      && item.detail?.surface === "fan_flywheel"
      && item.detail?.intent === "flywheel_listen"
      && item.detail?.destination === "/music.html"
    ))
  ), 6000);
  const flywheelEvent = events.slice(beforeFlywheelEvents).find((item) => item.detail?.intent === "flywheel_listen");
  if (!flywheelEvent) {
    issues.push("/index.html: fan flywheel link did not report stable link_click");
  } else if (flywheelEvent.detail?.cta_id !== "fan_flywheel__link_click__flywheel_listen") {
    issues.push(`/index.html: fan flywheel link reported unexpected cta_id ${flywheelEvent.detail?.cta_id || "missing"}`);
  }

  await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("luxveritas_consent", "accepted"));
  await page.reload({ waitUntil: "domcontentloaded" });

  const beforeHouseEvents = events.length;
  await page.click('[data-house-mark="LVR"]');
  await waitForCondition(() => (
    events.slice(beforeHouseEvents).some((item) => (
      item.event === "link_click"
      && item.detail?.surface === "brand_house"
      && item.detail?.intent === "house_lvr"
      && item.detail?.destination === "/music.html"
    ))
  ), 6000);
  const houseEvent = events.slice(beforeHouseEvents).find((item) => item.detail?.intent === "house_lvr");
  if (!houseEvent) {
    issues.push("/index.html: brand-house link did not report stable link_click");
  } else if (houseEvent.detail?.cta_id !== "brand_house__link_click__house_lvr") {
    issues.push(`/index.html: brand-house link reported unexpected cta_id ${houseEvent.detail?.cta_id || "missing"}`);
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
  await page.waitForFunction(() => {
    const summary = document.querySelector("[data-launch-closeout-summary]");
    return summary && /closeout items closed|unavailable/i.test(summary.textContent || "");
  }, null, { timeout: 5000 });
  await page.waitForFunction(() => {
    const summary = document.querySelector("[data-open-approvals-summary]");
    return summary && /public-launch blockers|unavailable/i.test(summary.textContent || "");
  }, null, { timeout: 5000 });
  await page.waitForFunction(() => {
    const summary = document.querySelector('[data-action-inventory="summary"]');
    return summary && /actions across|unavailable/i.test(summary.textContent || "");
  }, null, { timeout: 5000 });
  const mediaSummary = await page.locator("[data-media-readiness-summary]").innerText();
  const mediaReadiness = await page.locator("[data-media-readiness-list]").innerText();
  const launchSummaryBeforeLoad = await page.locator("[data-launch-readiness-summary]").innerText();
  const launchReadinessBeforeLoad = await page.locator("[data-launch-readiness-list]").innerText();
  const closeoutSummaryBeforeLoad = await page.locator("[data-launch-closeout-summary]").innerText();
  const closeoutBeforeLoad = await page.locator("[data-launch-closeout-list]").innerText();
  const openApprovalsSummary = await page.locator("[data-open-approvals-summary]").innerText();
  const openApprovalsList = await page.locator("[data-open-approvals-list]").innerText();
  const actionCoverageSummary = await page.locator('[data-action-inventory="summary"]').innerText();
  const actionCoverageDetail = await page.locator('[data-action-inventory="detail"]').innerText();
  const actionCoverageTypes = await page.locator('[data-action-inventory="types"]').innerText();
  const actionCoverageEvents = await page.locator('[data-action-inventory="events"]').innerText();
  const actionCoverageRoutes = await page.locator('[data-action-inventory="routes"]').innerText();
  const actionCoverageStatus = await page.locator('[data-action-inventory="status"]').innerText();
  if (!/3 of 3 source-ready/.test(mediaSummary)) {
    issues.push(`/portal/reporting.html: expected media readiness summary, found "${mediaSummary}"`);
  }
  if (!/\d+ of 7 launch gates ready/.test(launchSummaryBeforeLoad)) {
    issues.push(`/portal/reporting.html: expected launch readiness summary, found "${launchSummaryBeforeLoad}"`);
  }
  if (!/\d+ of 4 closeout items closed/.test(closeoutSummaryBeforeLoad)) {
    issues.push(`/portal/reporting.html: expected closeout summary, found "${closeoutSummaryBeforeLoad}"`);
  }
  const expectedApprovalSummary = `${openApprovals.counts.publicLaunchBlockers} public-launch blockers, ${openApprovals.counts.totalOpenOrConditional} open or conditional`;
  if (!openApprovalsSummary.includes(expectedApprovalSummary)) {
    issues.push(`/portal/reporting.html: expected open approvals summary "${expectedApprovalSummary}", found "${openApprovalsSummary}"`);
  }
  const expectedActionSummary = `${actionInventory.actionCount} actions across ${actionInventory.routeCount} surfaces`;
  if (!actionCoverageSummary.includes(expectedActionSummary)) {
    issues.push(`/portal/reporting.html: expected action coverage summary "${expectedActionSummary}", found "${actionCoverageSummary}"`);
  }
  if (!new RegExp(`Build ${expectedAssetVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(actionCoverageDetail)) {
    issues.push(`/portal/reporting.html: action coverage detail did not show current build, found "${actionCoverageDetail}"`);
  }
  for (const label of ["link_click", "form_open", "navigation_toggle", "consent_update"]) {
    if (!actionCoverageTypes.includes(label)) {
      issues.push(`/portal/reporting.html: action coverage types missing ${label}`);
    }
  }
  for (const label of ["lead_accepted", "media_action", "report_action"]) {
    if (!actionCoverageEvents.includes(label)) {
      issues.push(`/portal/reporting.html: action coverage events missing ${label}`);
    }
  }
  for (const label of ["index.html", "music.html", "portal/reporting.html"]) {
    if (!actionCoverageRoutes.includes(label)) {
      issues.push(`/portal/reporting.html: action coverage routes missing ${label}`);
    }
  }
  for (const label of ["consented_event", "server_capture", "protected_operator", "local_receipt"]) {
    if (!actionCoverageStatus.includes(label)) {
      issues.push(`/portal/reporting.html: action coverage reporting channels missing ${label}`);
    }
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
  for (const label of ["WWW Hosting and Certificate", "Inbox Provider", "Privacy Approval", "Terms Approval"]) {
    if (!closeoutBeforeLoad.includes(label)) {
      issues.push(`/portal/reporting.html: launch closeout missing ${label}`);
    }
  }
  for (const label of ["Privacy Review", "Terms Review", "Functions Deploy IAM", "External Workflow Target"]) {
    if (!openApprovalsList.includes(label)) {
      issues.push(`/portal/reporting.html: open approvals missing ${label}`);
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
    return list && /Inbox Notifications/i.test(list.textContent || "");
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
  const interestsSummary = await page.locator('[data-private-summary="interests"]').innerText();
  const routingSummary = await page.locator('[data-private-summary="routing"]').innerText();
  const deliverySummary = await page.locator('[data-private-summary="delivery"]').innerText();
  const integrationsSummary = await page.locator('[data-private-summary="integrations"]').innerText();
  const handoffsSummary = await page.locator('[data-private-summary="handoffs"]').innerText();
  const eventsSummary = await page.locator('[data-private-summary="events"]').innerText();
  const ctasSummary = await page.locator('[data-private-summary="ctas"]').innerText();
  const destinationsSummary = await page.locator('[data-private-summary="destinations"]').innerText();
  const pathwaysSummary = await page.locator('[data-private-summary="pathways"]').innerText();
  const pathwaySurfaceSummary = await page.locator('[data-private-summary="pathway-surfaces"]').innerText();
  const retentionSummary = await page.locator('[data-private-retention="summary"]').innerText();
  const retentionDetail = await page.locator('[data-private-retention="detail"]').innerText();
  const retentionList = await page.locator('[data-private-retention="list"]').innerText();
  const playbackSummary = await page.locator('[data-private-summary="playback"]').innerText();
  const playbackSourcesSummary = await page.locator('[data-private-summary="playback-sources"]').innerText();
  const playbackMilestonesSummary = await page.locator('[data-private-summary="playback-milestones"]').innerText();
  const reactionsSummary = await page.locator('[data-private-summary="reactions"]').innerText();
  const workflowPrimary = await page.locator('[data-private-workflow="primary"]').innerText();
  const workflowDetail = await page.locator('[data-private-workflow="detail"]').innerText();
  const workflowTargets = await page.locator('[data-private-workflow="targets"]').innerText();
  const workflowQueues = await page.locator('[data-private-workflow="queues"]').innerText();
  const workflowGuardrails = await page.locator('[data-private-workflow="guardrails"]').innerText();
  const queueSummary = await page.locator('[data-private-queue="summary"]').innerText();
  const queueDetail = await page.locator('[data-private-queue="detail"]').innerText();
  const queueList = await page.locator('[data-private-queue="list"]').innerText();
  const funnelSummary = await page.locator("[data-private-funnel]").innerText();
  const feedbackSummary = await page.locator('[data-private-feedback="summary"]').innerText();
  const feedbackDetail = await page.locator('[data-private-feedback="detail"]').innerText();
  const feedbackList = await page.locator('[data-private-feedback="list"]').innerText();
  const launchSummary = await page.locator("[data-launch-readiness-summary]").innerText();
  const launchReadiness = await page.locator("[data-launch-readiness-list]").innerText();
  const closeoutSummary = await page.locator("[data-launch-closeout-summary]").innerText();
  const closeoutReadiness = await page.locator("[data-launch-closeout-list]").innerText();
  const latest = await page.locator("[data-private-report-list]").innerText();

  if (submissionCount !== "42") issues.push(`/portal/reporting.html: expected 42 submissions, found ${submissionCount}`);
  if (eventCount !== "128") issues.push(`/portal/reporting.html: expected 128 events, found ${eventCount}`);
  if (privateHandoffCount !== "9") issues.push(`/portal/reporting.html: expected 9 accepted handoffs, found ${privateHandoffCount}`);
  if (pendingHandoffCount !== "0") issues.push(`/portal/reporting.html: expected 0 pending integrations, found ${pendingHandoffCount}`);
  if (deliveryStatus !== "Ready") issues.push(`/portal/reporting.html: expected delivery ready status, found ${deliveryStatus}`);
  if (!/Inbox notifications active/.test(deliveryDetail)) {
    issues.push(`/portal/reporting.html: missing delivery ready detail`);
  }
  if (handoffTargetStatus !== "Ready") {
    issues.push(`/portal/reporting.html: expected handoff target ready status, found ${handoffTargetStatus}`);
  }
  if (!/firebase_handoff/i.test(handoffTargetDetail)) {
    issues.push(`/portal/reporting.html: missing handoff target detail`);
  }
  if (reportAuthMode !== "operator_token" || reportAuthViewer !== "info@luxveritas.media") {
    issues.push(`/portal/reporting.html: report auth details did not render`);
  }
  for (const [label, text] of [
    ["forms", formsSummary],
    ["roles", rolesSummary],
    ["interests", interestsSummary],
    ["routing", routingSummary],
    ["delivery", deliverySummary],
    ["integrations", integrationsSummary],
    ["handoffs", handoffsSummary],
    ["events", eventsSummary],
    ["ctas", ctasSummary],
    ["destinations", destinationsSummary],
    ["pathways", pathwaysSummary],
    ["pathway-surfaces", pathwaySurfaceSummary],
    ["retention-summary", retentionSummary],
    ["retention-detail", retentionDetail],
    ["retention-list", retentionList],
    ["playback", playbackSummary],
    ["playback-sources", playbackSourcesSummary],
    ["playback-milestones", playbackMilestonesSummary],
    ["reactions", reactionsSummary],
    ["workflow-primary", workflowPrimary],
    ["workflow-targets", workflowTargets],
    ["workflow-queues", workflowQueues],
    ["workflow-guardrails", workflowGuardrails],
    ["queue-summary", queueSummary],
    ["queue-detail", queueDetail],
    ["queue-list", queueList],
    ["funnel", funnelSummary],
    ["feedback-summary", feedbackSummary],
    ["feedback-detail", feedbackDetail],
    ["feedback-list", feedbackList],
    ["latest", latest]
  ]) {
    if (!text || /Load private activity|No records found/i.test(text)) {
      issues.push(`/portal/reporting.html: ${label} report did not render loaded values`);
    }
  }
  if (!/LV-QA-REPORT/.test(latest) || !/media_action/.test(latest) || !/media_playback/.test(latest)) {
    issues.push(`/portal/reporting.html: latest protected activity missing mocked records`);
  }
  if (!/3 pilot notes/.test(feedbackSummary) || !/3 high priority/.test(feedbackSummary) || !/LV-QA-FEEDBACK/.test(feedbackList)) {
    issues.push(`/portal/reporting.html: pilot feedback summary did not render mocked triage values`);
  }
  if (!/Membership Waitlist/.test(routingSummary)) {
    issues.push(`/portal/reporting.html: screened routing summary missing mocked queue`);
  }
  if (!/GoHighLevel CRM/.test(workflowPrimary) || !/Firebase Private Handoff/.test(workflowDetail)) {
    issues.push(`/portal/reporting.html: workflow target recommendation did not render primary and active target`);
  }
  if (!/GoHighLevel CRM/.test(workflowTargets) || !/Membership Waitlist/.test(workflowQueues)) {
    issues.push(`/portal/reporting.html: workflow target demand did not render queue recommendations`);
  }
  if (!/Firebase Secret Manager/.test(workflowGuardrails)) {
    issues.push(`/portal/reporting.html: workflow guardrails did not render`);
  }
  if (!/24 open/.test(queueSummary) || !/Pending inbox: 7/.test(queueDetail)) {
    issues.push(`/portal/reporting.html: intake queue summary did not render open and pending values`);
  }
  if (!/Membership Waitlist/i.test(queueList) || !/Inbox attention/i.test(queueList) || !/Membership operator/i.test(queueList)) {
    issues.push(`/portal/reporting.html: intake queue list did not render queue, review signal, and owner (text="${queueList.replace(/\s+/g, " ")}")`);
  }
  if (!/music/.test(interestsSummary) || !/events/.test(interestsSummary)) {
    issues.push(`/portal/reporting.html: interest summary missing mocked interest paths`);
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
  const workflowExportReady = await page.evaluate(() => {
    return privateReportRows(privateReportCache).some((row) => (
      row.type === "workflow_target"
      && row.label === "GoHighLevel CRM"
      && /Membership Waitlist/.test(row.detail)
    ));
  });
  if (!workflowExportReady) {
    issues.push(`/portal/reporting.html: workflow recommendation was missing from private export rows`);
  }
  const queueExportReady = await page.evaluate(() => {
    return privateReportRows(privateReportCache).some((row) => (
      row.type === "intake_queue"
      && row.label === "Membership Waitlist"
      && /Inbox attention/.test(row.detail)
    ));
  });
  if (!queueExportReady) {
    issues.push(`/portal/reporting.html: intake queue records were missing from private export rows`);
  }
  const feedbackExportReady = await page.evaluate(() => {
    return privateReportRows(privateReportCache).some((row) => (
      row.type === "pilot_feedback"
      && row.label === "LV-QA-FEEDBACK"
      && /Review tester issue/.test(row.detail)
    ));
  });
  if (!feedbackExportReady) {
    issues.push(`/portal/reporting.html: pilot feedback records were missing from private export rows`);
  }
  const playbackExportReady = await page.evaluate(() => {
    return privateReportRows(privateReportCache).some((row) => (
      row.type === "media_playback"
      && row.label === "ended"
      && /SPMVP/.test(row.detail)
    ));
  });
  if (!playbackExportReady) {
    issues.push(`/portal/reporting.html: playback records were missing from private export rows`);
  }
  const reactionExportReady = await page.evaluate(() => {
    return privateReportRows(privateReportCache).some((row) => (
      row.type === "fan_reaction"
      && row.label === "Collect"
      && /SPMVP/.test(row.detail)
    ));
  });
  if (!reactionExportReady) {
    issues.push(`/portal/reporting.html: fan reaction records were missing from private export rows`);
  }
  if (!/media__media_action__play/.test(ctasSummary)) {
    issues.push(`/portal/reporting.html: CTA signal summary missing mocked CTA ID`);
  }
  if (!/45 pathway clicks/.test(retentionSummary) || !/23 fan journey/.test(retentionDetail) || !/14 brand house/.test(retentionDetail) || !/8 release room/.test(retentionDetail)) {
    issues.push(`/portal/reporting.html: retention path summary did not render totals`);
  }
  if (!/Listen Start With Sound/.test(retentionList) || !/Lux Veritas Records/.test(retentionList) || !/Hold the object/.test(retentionList)) {
    issues.push(`/portal/reporting.html: retention path list missing mocked pathway cards`);
  }
  if (!/fan_flywheel/.test(pathwaySurfaceSummary) || !/brand_house/.test(pathwaySurfaceSummary) || !/release_room/.test(pathwaySurfaceSummary)) {
    issues.push(`/portal/reporting.html: pathway surface summary missing mocked surfaces`);
  }
  if (!/flywheel_listen/.test(pathwaysSummary) && !/Listen Start With Sound/.test(pathwaysSummary)) {
    issues.push(`/portal/reporting.html: pathway card summary missing mocked flywheel path`);
  }
  const pathwayExportReady = await page.evaluate(() => {
    return privateReportRows(privateReportCache).some((row) => (
      row.type === "retention_path"
      && row.label === "Listen Start With Sound"
      && /fan_flywheel/.test(row.detail)
    ));
  });
  if (!pathwayExportReady) {
    issues.push(`/portal/reporting.html: retention paths were missing from private export rows`);
  }
  if (!/ended/.test(playbackSummary) || !/play/.test(playbackSummary)) {
    issues.push(`/portal/reporting.html: playback action summary missing mocked lifecycle values`);
  }
  if (!/audio/.test(playbackSourcesSummary) || !/stream/.test(playbackSourcesSummary)) {
    issues.push(`/portal/reporting.html: playback source summary missing mocked media source values`);
  }
  if (!/25%/.test(playbackMilestonesSummary) || !/ended/.test(playbackMilestonesSummary)) {
    issues.push(`/portal/reporting.html: playback milestone summary missing mocked retention values`);
  }
  if (!/Collect/.test(reactionsSummary)) {
    issues.push(`/portal/reporting.html: fan reaction summary missing mocked reaction values`);
  }
  if (!/Server captures/.test(funnelSummary) || !/Media actions/.test(funnelSummary) || !/Playback events/.test(funnelSummary)) {
    issues.push(`/portal/reporting.html: pilot funnel missing capture/media values`);
  }
  if (!/\d+ of 7 launch gates ready/.test(launchSummary) || !/Inbox Notifications/i.test(launchReadiness)) {
    issues.push(`/portal/reporting.html: launch gates did not render blocker state (summary="${launchSummary}", list="${launchReadiness.replace(/\s+/g, " ")}")`);
  }
  if (!/\d+ of 4 closeout items closed/.test(closeoutSummary) || !/Inbox Provider\s+Closed/i.test(closeoutReadiness.replace(/\s+/g, " "))) {
    issues.push(`/portal/reporting.html: launch closeout did not render state (summary="${closeoutSummary}", list="${closeoutReadiness.replace(/\s+/g, " ")}")`);
  }

  const reportRequestCountBeforeInboxTest = reportRequests.length;
  await page.click('[data-report-action="test-inbox"]');
  let inboxTestRequest = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    inboxTestRequest = reportRequests
      .slice(reportRequestCountBeforeInboxTest)
      .find((request) => request?.body?.action === "test_inbox") || null;
    if (inboxTestRequest) break;
    await page.waitForTimeout(250);
  }
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
    return status && /Private handoff is not configured yet|Handoff replay checked|Private activity loaded/i.test(status.textContent || "");
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
    if (submitMode === "rate_limited") {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "rate_limited" })
      });
      return;
    }
    if (submitMode === "fallback") {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          delivery: "fallback",
          reason: "qa_mock_fallback",
          id: payload.client_submission_id || "LV-BROWSER-QA",
          stored: false
        })
      });
      return;
    }
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
          replayed: 1,
          checked: 1,
          skipped: false,
          reason: "sent"
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
          sent: true,
          skipped: false,
          reason: "sent"
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

  await pageViewReportingFlow(page, baseUrl);
  for (const flow of flows) {
    await openFlow(page, baseUrl, flow);
  }
  await formFallbackFlow(page, baseUrl);
  await formRateLimitFlow(page, baseUrl);
  await interactionReportingFlow(page, baseUrl);
  await pathwayLinkReportingFlow(page, baseUrl);
  await portalSigninFlow(page, baseUrl);
  await portalFallbackFlow(page, baseUrl);
  for (const path of ["/music.html", "/spmvp.html"]) {
    await mediaFlow(page, baseUrl, path);
  }
  await mediaActionMappingFlow(page, baseUrl);
  await musicHeroMediaFlow(page, baseUrl);
  await mediaPlaybackReportingFlow(page, baseUrl);
  await fanReactionFlow(page, baseUrl);
  await fanSignalPassFlow(page, baseUrl);
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

console.log(`Browser flow QA passed for consented page-view reporting, ${flows.length} form flows, form fallback/rate-limit, portal sign-in/fallback, 2 media flows, media action/playback mapping, signal pass export, interaction/pathway reporting, and operator reporting at ${baseUrl}.`);
