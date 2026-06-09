import admin from "firebase-admin";
import crypto from "node:crypto";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

const defaultToEmail = "info@luxveritas.media";
const defaultFromEmail = "Lux Veritas <forms@luxveritas.media>";
const allowedOrigins = new Set([
  "https://luxveritas.media",
  "https://www.luxveritas.media",
  "https://lux-veritas-media.web.app",
  "https://lux-veritas-media.firebaseapp.com",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
]);
const rateWindowMs = 10 * 60 * 1000;
const maxRequestsPerWindow = 5;
const maxEventsPerWindow = 40;
const maxReportsPerWindow = 20;
const maxReplayPerWindow = 8;
const emailTimeoutMs = 6000;
const integrationTimeoutMs = 6000;
const rateBuckets = new Map();
const pendingDeliveryStatuses = [
  "received",
  "email_provider_not_configured",
  "email_provider_timeout",
  "email_provider_request_failed",
  "email_provider_error",
  "email_relay_error",
  "relay_error"
];

function getDb() {
  if (!admin.apps.length) admin.initializeApp();
  return admin.firestore();
}

function json(res, status, body) {
  res.status(status).json(body);
}

function setCors(req, res) {
  const origin = req.get("origin");
  if (allowedOrigins.has(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function clientKey(req) {
  return req.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || "unknown";
}

function clientHash(req) {
  return crypto.createHash("sha256").update(clientKey(req)).digest("hex");
}

function isRateLimited(req, maxRequests = maxRequestsPerWindow, namespace = "default") {
  const now = Date.now();
  const key = `${namespace}:${clientKey(req)}`;
  const bucket = rateBuckets.get(key) || [];
  const recent = bucket.filter((time) => now - time < rateWindowMs);
  recent.push(now);
  rateBuckets.set(key, recent);
  return recent.length > maxRequests;
}

function text(value, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

function emailProviderKey() {
  return process.env.RESEND_API_KEY || "";
}

function integrationUrl() {
  return process.env.FORM_INTEGRATION_URL || "";
}

function integrationSigningSecret() {
  return process.env.FORM_INTEGRATION_SIGNING_SECRET || "";
}

const accessPathMap = {
  Member: { access_path: "member", portal_role_target: "member" },
  Artist: { access_path: "artist", portal_role_target: "artist" },
  Creator: { access_path: "creator", portal_role_target: "creator" },
  Press: { access_path: "press", portal_role_target: "press" },
  Partner: { access_path: "partner", portal_role_target: "partner" },
  Investor: { access_path: "investor", portal_role_target: "investor" },
  "Event guest": { access_path: "event_guest", portal_role_target: "member" },
  General: { access_path: "general", portal_role_target: "visitor" }
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

const routingMap = {
  membership: {
    routing_queue: "membership_waitlist",
    routing_label: "Membership Waitlist",
    routing_priority: "standard",
    routing_next_action: "Send first-access follow-up",
    routing_sla: "3 business days"
  },
  submissions: {
    routing_queue: "submission_review",
    routing_label: "Submission Review",
    routing_priority: "high",
    routing_next_action: "Review materials and rights-safe fit",
    routing_sla: "5 business days"
  },
  events: {
    routing_queue: "event_access",
    routing_label: "Event Access",
    routing_priority: "standard",
    routing_next_action: "Screen event fit and invitation path",
    routing_sla: "3 business days"
  },
  event_guest: {
    routing_queue: "event_access",
    routing_label: "Event Access",
    routing_priority: "standard",
    routing_next_action: "Screen event fit and invitation path",
    routing_sla: "3 business days"
  },
  press: {
    routing_queue: "press_contact",
    routing_label: "Press Contact",
    routing_priority: "standard",
    routing_next_action: "Route to press response",
    routing_sla: "2 business days"
  },
  partnership: {
    routing_queue: "partner_licensing",
    routing_label: "Partner / Licensing",
    routing_priority: "high",
    routing_next_action: "Screen use case and access level",
    routing_sla: "3 business days"
  },
  licensing: {
    routing_queue: "partner_licensing",
    routing_label: "Partner / Licensing",
    routing_priority: "high",
    routing_next_action: "Screen use case and access level",
    routing_sla: "3 business days"
  },
  partner: {
    routing_queue: "partner_licensing",
    routing_label: "Partner / Licensing",
    routing_priority: "high",
    routing_next_action: "Screen use case and access level",
    routing_sla: "3 business days"
  },
  investor: {
    routing_queue: "strategic_access",
    routing_label: "Strategic Access",
    routing_priority: "high",
    routing_next_action: "Screen strategic fit before materials",
    routing_sla: "2 business days"
  },
  portal: {
    routing_queue: "access_review",
    routing_label: "Access Review",
    routing_priority: "standard",
    routing_next_action: "Confirm role path and access need",
    routing_sla: "3 business days"
  },
  general: {
    routing_queue: "access_review",
    routing_label: "Access Review",
    routing_priority: "standard",
    routing_next_action: "Confirm role path and access need",
    routing_sla: "3 business days"
  }
};

function deriveRouting(payload = {}) {
  return routingMap[payload.inquiry_key]
    || routingMap[payload.access_path]
    || routingMap.general;
}

function validate(payload) {
  const errors = [];
  const rolePath = text(payload.role_path, 80);
  const inquiryType = text(payload.inquiry_type, 80);
  const accessPath = accessPathMap[rolePath] || null;
  const inquiryKey = inquiryKeyMap[inquiryType] || null;
  const cleanBase = {
    client_submission_id: text(payload.client_submission_id, 80),
    name: text(payload.name, 140),
    email: text(payload.email, 180).toLowerCase(),
    phone: text(payload.phone, 80),
    role_path: rolePath,
    inquiry_type: inquiryType,
    access_path: accessPath?.access_path || "",
    portal_role_target: accessPath?.portal_role_target || "",
    inquiry_key: inquiryKey || "",
    message: text(payload.message, 5000),
    formType: text(payload.formType, 80),
    tag: text(payload.tag, 120),
    source: text(payload.source, 120),
    source_page: text(payload.source_page, 240),
    consent_email: payload.consent_email === "yes" || payload.consent_email === true,
    consent_sms: payload.consent_sms === "yes" || payload.consent_sms === true,
    company_url: text(payload.company_url, 240)
  };
  const clean = {
    ...cleanBase,
    ...deriveRouting(cleanBase)
  };

  if (clean.company_url) errors.push("spam");
  if (!clean.name) errors.push("name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) errors.push("valid email is required");
  if (!clean.role_path) errors.push("role path is required");
  else if (!accessPath) errors.push("recognized role path is required");
  if (!clean.inquiry_type) errors.push("inquiry type is required");
  else if (!inquiryKey) errors.push("recognized inquiry type is required");
  if (!clean.message) errors.push("message is required");

  return { clean, errors };
}

function validateEvent(payload) {
  const event = text(payload.event, 80);
  const page = text(payload.page, 240);
  const consent = text(payload.consent, 40);
  const timestamp = text(payload.timestamp, 80);
  const detail = payload.detail && typeof payload.detail === "object" && !Array.isArray(payload.detail)
    ? Object.fromEntries(Object.entries(payload.detail).slice(0, 24).map(([key, value]) => [
      text(key, 80),
      typeof value === "object" ? text(JSON.stringify(value), 500) : text(value, 500)
    ]))
    : {};
  const errors = [];

  if (!event) errors.push("event is required");
  if (!page) errors.push("page is required");
  if (consent !== "accepted") errors.push("analytics consent is required");

  return {
    clean: {
      event,
      page,
      consent,
      timestamp,
      detail
    },
    errors
  };
}

async function authorizeReport(req) {
  const header = req.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, error: "missing_token" };

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, status: 401, error: "invalid_token" };

  const email = text(body.email, 240).toLowerCase();
  const hostedDomain = text(body.hd, 120).toLowerCase();
  const allowedEmails = new Set(
    text(process.env.REPORT_ALLOWED_EMAILS || "info@luxveritas.media", 1000)
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
  const allowedDomain = text(process.env.REPORT_ALLOWED_DOMAIN || "luxveritas.media", 120).toLowerCase();
  const allowed = allowedEmails.has(email) || (allowedDomain && hostedDomain === allowedDomain);

  if (!allowed) return { ok: false, status: 403, error: "not_allowed" };
  return { ok: true, email };
}

function cleanDoc(snapshot) {
  const data = snapshot.data() || {};
  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null;
  const routing = deriveRouting(data);
  return {
    id: snapshot.id,
    createdAt,
    event: data.event || null,
    page: data.page || data.source_page || null,
    formType: data.formType || null,
    inquiry_type: data.inquiry_type || null,
    role_path: data.role_path || null,
    access_path: data.access_path || null,
    portal_role_target: data.portal_role_target || null,
    inquiry_key: data.inquiry_key || null,
    routing_queue: data.routing_queue || routing.routing_queue,
    routing_label: data.routing_label || routing.routing_label,
    routing_priority: data.routing_priority || routing.routing_priority,
    routing_next_action: data.routing_next_action || routing.routing_next_action,
    routing_sla: data.routing_sla || routing.routing_sla,
    deliveryStatus: data.deliveryStatus || null,
    integrationStatus: data.integrationStatus || null,
    client_submission_id: data.client_submission_id || null,
    detail: data.detail || null
  };
}

function cleanReplayDoc(snapshot) {
  const data = snapshot.data() || {};
  const routing = deriveRouting(data);
  return {
    id: snapshot.id,
    client_submission_id: data.client_submission_id || null,
    name: data.name || "",
    email: data.email || "",
    phone: data.phone || "",
    role_path: data.role_path || "",
    access_path: data.access_path || "",
    portal_role_target: data.portal_role_target || "",
    inquiry_type: data.inquiry_type || "",
    inquiry_key: data.inquiry_key || "",
    routing_queue: data.routing_queue || routing.routing_queue,
    routing_label: data.routing_label || routing.routing_label,
    routing_priority: data.routing_priority || routing.routing_priority,
    routing_next_action: data.routing_next_action || routing.routing_next_action,
    routing_sla: data.routing_sla || routing.routing_sla,
    formType: data.formType || "",
    tag: data.tag || "",
    source: data.source || "luxveritas.media",
    source_page: data.source_page || "",
    consent_email: Boolean(data.consent_email),
    consent_sms: Boolean(data.consent_sms),
    message: data.message || ""
  };
}

function topCounts(items, pick, limit = 8) {
  const counts = new Map();
  for (const item of items) {
    const raw = pick(item);
    const value = text(raw, 160);
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function countWhere(items, pick) {
  return items.reduce((count, item) => count + (pick(item) ? 1 : 0), 0);
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function buildPilotFunnel(submissionItems, eventItems) {
  const views = countWhere(eventItems, (item) => item.event === "view_content");
  const formOpens = countWhere(eventItems, (item) => item.event === "form_open");
  const mediaActions = countWhere(eventItems, (item) => item.event === "media_action");
  const acceptedLeads = countWhere(eventItems, (item) => item.event === "lead_accepted");
  const fallbackLeads = countWhere(eventItems, (item) => item.event === "lead_fallback");
  const rejectedLeads = countWhere(eventItems, (item) => item.event === "lead_rejected");
  const serverCaptures = submissionItems.length;
  const memberDemand = countWhere(submissionItems, (item) => item.access_path === "member" || item.inquiry_key === "membership");
  const creatorDemand = countWhere(submissionItems, (item) => ["artist", "creator"].includes(item.access_path) || item.inquiry_key === "submissions");
  const partnerDemand = countWhere(submissionItems, (item) => ["partner", "investor"].includes(item.access_path) || ["partnership", "licensing", "investor"].includes(item.inquiry_key));

  return [
    {
      label: "Tracked views",
      value: views,
      detail: "Consented page views in the recent activity sample"
    },
    {
      label: "Form opens",
      value: formOpens,
      detail: `${percent(formOpens, views)}% of tracked views`
    },
    {
      label: "Server captures",
      value: serverCaptures,
      detail: `${percent(serverCaptures, formOpens)}% of form opens`
    },
    {
      label: "Accepted locally",
      value: acceptedLeads,
      detail: `${fallbackLeads} fallback, ${rejectedLeads} rejected`
    },
    {
      label: "Media actions",
      value: mediaActions,
      detail: "Listen, watch, radio, and media queue intent"
    },
    {
      label: "Member demand",
      value: memberDemand,
      detail: `${creatorDemand} creator path, ${partnerDemand} partner path`
    }
  ];
}

function summarizeActivity(submissionDocs, eventDocs) {
  const submissionItems = submissionDocs.map((snapshot) => snapshot.data() || {});
  const eventItems = eventDocs.map((snapshot) => snapshot.data() || {});
  return {
    funnel: buildPilotFunnel(submissionItems, eventItems),
    submissions: {
      byFormType: topCounts(submissionItems, (item) => item.formType || "request"),
      byInquiryType: topCounts(submissionItems, (item) => item.inquiry_type),
      byRolePath: topCounts(submissionItems, (item) => item.role_path),
      byAccessPath: topCounts(submissionItems, (item) => item.access_path),
      byPortalRoleTarget: topCounts(submissionItems, (item) => item.portal_role_target),
      byRoutingQueue: topCounts(submissionItems, (item) => item.routing_label || item.routing_queue),
      byRoutingPriority: topCounts(submissionItems, (item) => item.routing_priority),
      byDeliveryStatus: topCounts(submissionItems, (item) => item.deliveryStatus),
      byIntegrationStatus: topCounts(submissionItems, (item) => item.integrationStatus),
      bySourcePage: topCounts(submissionItems, (item) => item.source_page)
    },
    events: {
      byEvent: topCounts(eventItems, (item) => item.event),
      byPage: topCounts(eventItems, (item) => item.page),
      bySurface: topCounts(eventItems, (item) => item.detail?.surface),
      byDestination: topCounts(eventItems, (item) => item.detail?.destination),
      mediaDemand: topCounts(eventItems.filter((item) => item.event === "media_action"), (item) => item.detail?.action || item.detail?.title)
    }
  };
}

function deliveryReadiness() {
  const to = text(process.env.FORM_TO_EMAIL || defaultToEmail, 240);
  const from = text(process.env.FORM_FROM_EMAIL || defaultFromEmail, 240);
  const hasEmailProvider = Boolean(emailProviderKey());
  const hasIntegration = Boolean(integrationUrl());
  const ready = Boolean(hasEmailProvider && from && to);

  return {
    inboxNotification: ready ? "ready" : "needs_setup",
    storeFirstCapture: "ready",
    integrationWebhook: hasIntegration ? "ready" : "needs_setup",
    toConfigured: Boolean(to),
    fromConfigured: Boolean(from),
    emailProviderConfigured: hasEmailProvider,
    integrationConfigured: hasIntegration,
    toEmail: to,
    missing: [
      hasEmailProvider ? null : "RESEND_API_KEY",
      hasIntegration ? null : "FORM_INTEGRATION_URL",
      from ? null : "FORM_FROM_EMAIL",
      to ? null : "FORM_TO_EMAIL"
    ].filter(Boolean)
  };
}

async function collectionCount(collection) {
  const result = await collection.count().get();
  return result.data().count || 0;
}

async function pendingNotificationCount(collection) {
  const result = await collection.where("deliveryStatus", "in", pendingDeliveryStatuses).count().get();
  return result.data().count || 0;
}

function subjectFor(payload) {
  const type = payload.inquiry_type || payload.formType || "Website Inquiry";
  const receipt = payload.client_submission_id ? ` [${payload.client_submission_id}]` : "";
  return `Lux Veritas ${type}: ${payload.name}${receipt}`;
}

function emailText(payload, id) {
  return [
    "Lux Veritas website submission",
    "",
    `Submission ID: ${id}`,
    `Receipt ID: ${payload.client_submission_id || id}`,
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone}`,
    `Role path: ${payload.role_path}`,
    `Access path: ${payload.access_path}`,
    `Portal role target: ${payload.portal_role_target}`,
    `Inquiry type: ${payload.inquiry_type}`,
    `Inquiry key: ${payload.inquiry_key}`,
    `Routing queue: ${payload.routing_queue}`,
    `Routing priority: ${payload.routing_priority}`,
    `Routing next action: ${payload.routing_next_action}`,
    `Routing SLA: ${payload.routing_sla}`,
    `Form type: ${payload.formType}`,
    `Source page: ${payload.source_page}`,
    `Email consent: ${payload.consent_email ? "yes" : "no"}`,
    `SMS consent: ${payload.consent_sms ? "yes" : "no"}`,
    "",
    "Message:",
    payload.message
  ].join("\n");
}

async function sendEmail(payload, id) {
  const apiKey = emailProviderKey();
  const from = process.env.FORM_FROM_EMAIL || defaultFromEmail;
  const to = process.env.FORM_TO_EMAIL || defaultToEmail;

  if (!apiKey || !from) {
    return { delivered: false, reason: "email_provider_not_configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), emailTimeoutMs);
  let response;

  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: payload.email,
        subject: subjectFor(payload),
        text: emailText(payload, id)
      })
    });
  } catch (error) {
    logger.error("Resend delivery request failed", {
      errorName: error?.name || null,
      errorMessage: error?.message || String(error),
      id
    });
    return {
      delivered: false,
      reason: error?.name === "AbortError" ? "email_provider_timeout" : "email_provider_request_failed"
    };
  } finally {
    clearTimeout(timeout);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.error("Resend delivery failed", { status: response.status, body, id });
    return { delivered: false, reason: "email_provider_error", providerStatus: response.status };
  }

  return { delivered: true, providerId: body.id || null };
}

function integrationPayload(payload, id) {
  return {
    submissionId: id,
    receiptId: payload.client_submission_id || id,
    receivedAt: new Date().toISOString(),
    source: payload.source || "luxveritas.media",
    sourcePage: payload.source_page || "",
    formType: payload.formType || "",
    tag: payload.tag || "",
    inquiryType: payload.inquiry_type || "",
    inquiryKey: payload.inquiry_key || "",
    rolePath: payload.role_path || "",
    accessPath: payload.access_path || "",
    portalRoleTarget: payload.portal_role_target || "",
    routing: {
      queue: payload.routing_queue || "",
      label: payload.routing_label || "",
      priority: payload.routing_priority || "",
      nextAction: payload.routing_next_action || "",
      sla: payload.routing_sla || ""
    },
    contact: {
      name: payload.name,
      email: payload.email,
      phone: payload.phone
    },
    consent: {
      email: Boolean(payload.consent_email),
      sms: Boolean(payload.consent_sms)
    },
    message: payload.message
  };
}

async function sendIntegration(payload, id) {
  const url = integrationUrl();
  if (!url) {
    return { delivered: false, reason: "integration_not_configured" };
  }
  if (!/^https:\/\//i.test(url)) {
    return { delivered: false, reason: "integration_url_invalid" };
  }

  const body = JSON.stringify(integrationPayload(payload, id));
  const secret = integrationSigningSecret();
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "LuxVeritas-FormIntegration/1.0"
  };
  if (secret) {
    headers["X-Lux-Signature"] = crypto.createHmac("sha256", secret).update(body).digest("hex");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), integrationTimeoutMs);
  let response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      signal: controller.signal,
      body
    });
  } catch (error) {
    logger.error("Form integration request failed", {
      errorName: error?.name || null,
      errorMessage: error?.message || String(error),
      id
    });
    return {
      delivered: false,
      reason: error?.name === "AbortError" ? "integration_timeout" : "integration_request_failed"
    };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    logger.error("Form integration failed", { status: response.status, id });
    return { delivered: false, reason: "integration_error", providerStatus: response.status };
  }

  return { delivered: true, providerStatus: response.status };
}

function settledRelay(result, fallbackReason) {
  if (result.status === "fulfilled") return result.value;
  return {
    delivered: false,
    reason: fallbackReason,
    error: text(result.reason?.message || result.reason, 500)
  };
}

async function updateDocSafe(doc, data, id, stage) {
  try {
    await doc.update(data);
  } catch (error) {
    logger.error("Submission status update failed", {
      id,
      stage,
      errorCode: error?.code || null,
      errorMessage: error?.message || String(error)
    });
  }
}

async function replayPendingInbox(req, res, auth) {
  const readiness = deliveryReadiness();
  if (!readiness.emailProviderConfigured) {
    json(res, 202, {
      ok: true,
      replayed: 0,
      skipped: true,
      reason: "email_provider_not_configured",
      delivery: readiness
    });
    return;
  }

  const limit = Math.max(1, Math.min(Number(req.body?.limit) || 20, 50));
  const db = getDb();
  const submissions = db.collection("form_submissions");

  try {
    const pendingSnapshot = await submissions
      .where("deliveryStatus", "in", pendingDeliveryStatuses)
      .limit(limit)
      .get();

    const results = [];
    for (const snapshot of pendingSnapshot.docs) {
      const payload = cleanReplayDoc(snapshot);
      const delivery = await sendEmail(payload, snapshot.id);
      await updateDocSafe(snapshot.ref, {
        deliveryStatus: delivery.delivered ? "sent" : delivery.reason,
        delivery,
        replayedBy: auth.email,
        replayedAt: admin.firestore.FieldValue.serverTimestamp(),
        deliveredAt: delivery.delivered ? admin.firestore.FieldValue.serverTimestamp() : null
      }, snapshot.id, "replay_delivery");
      results.push({
        id: snapshot.id,
        receiptId: payload.client_submission_id || snapshot.id,
        deliveryStatus: delivery.delivered ? "sent" : delivery.reason
      });
    }

    json(res, 200, {
      ok: true,
      replayed: results.filter((item) => item.deliveryStatus === "sent").length,
      checked: results.length,
      results
    });
  } catch (error) {
    logger.error("Pending notification replay failed", {
      errorCode: error?.code || null,
      errorMessage: error?.message || String(error)
    });
    json(res, 500, { ok: false, error: "replay_unavailable" });
  }
}

export const submitForm = onRequest(
  {
    region: "us-central1",
    cors: false,
    maxInstances: 10
  },
  async (req, res) => {
    setCors(req, res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      json(res, 405, { ok: false, error: "method_not_allowed" });
      return;
    }

    if (isRateLimited(req, maxRequestsPerWindow, "submit")) {
      json(res, 429, { ok: false, error: "rate_limited" });
      return;
    }

    const { clean, errors } = validate(req.body || {});
    if (errors.length) {
      const status = errors.includes("spam") ? 202 : 400;
      json(res, status, { ok: status === 202, error: status === 202 ? null : "validation_failed", errors });
      return;
    }

    const id = crypto.randomUUID();
    const doc = getDb().collection("form_submissions").doc(id);
    let stored = false;

    try {
      await doc.set({
        ...clean,
        userAgent: text(req.get("user-agent"), 400),
        clientHash: clientHash(req),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        deliveryStatus: "received"
      });
      stored = true;
    } catch (error) {
      logger.error("Submission storage failed", {
        id,
        errorCode: error?.code || null,
        errorMessage: error?.message || String(error)
      });
    }

    try {
      const [deliveryResult, integrationResult] = await Promise.allSettled([
        sendEmail(clean, id),
        sendIntegration(clean, id)
      ]);
      const delivery = settledRelay(deliveryResult, "email_relay_error");
      const integration = settledRelay(integrationResult, "integration_relay_error");

      if (stored) {
        await updateDocSafe(doc, {
          deliveryStatus: delivery.delivered ? "sent" : delivery.reason,
          delivery,
          integrationStatus: integration.delivered ? "sent" : integration.reason,
          integration,
          deliveredAt: delivery.delivered ? admin.firestore.FieldValue.serverTimestamp() : null
        }, id, "relay_complete");
      }

      if (delivery.delivered) {
        json(res, 200, { ok: true, delivery: "sent", id, stored });
      } else {
        json(res, 202, { ok: true, delivery: stored ? "stored" : "fallback", reason: delivery.reason, id, stored });
      }
    } catch (error) {
      logger.error("Submission relay failed", {
        id,
        errorCode: error?.code || null,
        errorMessage: error?.message || String(error)
      });
      if (stored) {
        await updateDocSafe(doc, {
          deliveryStatus: "relay_error",
          relayError: text(error?.message, 500)
        }, id, "relay_error");
      }
      json(res, 202, { ok: true, delivery: stored ? "stored" : "fallback", reason: "relay_error", id, stored });
    }
  }
);

export const trackSiteEvent = onRequest(
  {
    region: "us-central1",
    cors: false,
    maxInstances: 10
  },
  async (req, res) => {
    setCors(req, res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      json(res, 405, { ok: false, error: "method_not_allowed" });
      return;
    }

    if (isRateLimited(req, maxEventsPerWindow, "event")) {
      json(res, 429, { ok: false, error: "rate_limited" });
      return;
    }

    const { clean, errors } = validateEvent(req.body || {});
    if (errors.length) {
      json(res, 400, { ok: false, error: "validation_failed", errors });
      return;
    }

    const id = crypto.randomUUID();

    try {
      await getDb().collection("site_events").doc(id).set({
        ...clean,
        userAgent: text(req.get("user-agent"), 400),
        clientHash: clientHash(req),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      json(res, 202, { ok: true, delivery: "stored", id, stored: true });
    } catch (error) {
      logger.error("Site event storage failed", {
        id,
        errorCode: error?.code || null,
        errorMessage: error?.message || String(error)
      });
      json(res, 202, { ok: true, delivery: "fallback", reason: "storage_unavailable", id, stored: false });
    }
  }
);

export const reportActivity = onRequest(
  {
    region: "us-central1",
    cors: false,
    maxInstances: 5
  },
  async (req, res) => {
    setCors(req, res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (!["GET", "POST"].includes(req.method)) {
      json(res, 405, { ok: false, error: "method_not_allowed" });
      return;
    }

    const isReplay = req.method === "POST" && req.body?.action === "replay_pending";
    const namespace = isReplay ? "replay" : "report";
    const maxRequests = isReplay ? maxReplayPerWindow : maxReportsPerWindow;
    if (isRateLimited(req, maxRequests, namespace)) {
      json(res, 429, { ok: false, error: "rate_limited" });
      return;
    }

    const auth = await authorizeReport(req);
    if (!auth.ok) {
      json(res, auth.status, { ok: false, error: auth.error });
      return;
    }

    if (req.method === "POST") {
      if (!isReplay) {
        json(res, 400, { ok: false, error: "unknown_report_action" });
        return;
      }
      await replayPendingInbox(req, res, auth);
      return;
    }

    const db = getDb();
    const submissions = db.collection("form_submissions");
    const events = db.collection("site_events");

    try {
      const [submissionCount, eventCount, pendingNotifications, latestSubmissions, latestEvents, summarySubmissions, summaryEvents] = await Promise.all([
        collectionCount(submissions),
        collectionCount(events),
        pendingNotificationCount(submissions),
        submissions.orderBy("createdAt", "desc").limit(20).get(),
        events.orderBy("createdAt", "desc").limit(20).get(),
        submissions.orderBy("createdAt", "desc").limit(200).get(),
        events.orderBy("createdAt", "desc").limit(300).get()
      ]);

      json(res, 200, {
        ok: true,
        generatedAt: new Date().toISOString(),
        viewer: auth.email,
        counts: {
          submissions: submissionCount,
          events: eventCount,
          pendingNotifications
        },
        latest: {
          submissions: latestSubmissions.docs.map(cleanDoc),
          events: latestEvents.docs.map(cleanDoc)
        },
        delivery: deliveryReadiness(),
        summary: summarizeActivity(summarySubmissions.docs, summaryEvents.docs)
      });
    } catch (error) {
      logger.error("Activity report failed", {
        errorCode: error?.code || null,
        errorMessage: error?.message || String(error)
      });
      json(res, 500, { ok: false, error: "report_unavailable" });
    }
  }
);
