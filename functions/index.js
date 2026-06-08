import admin from "firebase-admin";
import crypto from "node:crypto";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

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
const rateBuckets = new Map();

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
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
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

function validate(payload) {
  const errors = [];
  const clean = {
    client_submission_id: text(payload.client_submission_id, 80),
    name: text(payload.name, 140),
    email: text(payload.email, 180).toLowerCase(),
    phone: text(payload.phone, 80),
    role_path: text(payload.role_path, 80),
    inquiry_type: text(payload.inquiry_type, 80),
    message: text(payload.message, 5000),
    formType: text(payload.formType, 80),
    tag: text(payload.tag, 120),
    source: text(payload.source, 120),
    source_page: text(payload.source_page, 240),
    consent_email: payload.consent_email === "yes" || payload.consent_email === true,
    consent_sms: payload.consent_sms === "yes" || payload.consent_sms === true,
    company_url: text(payload.company_url, 240)
  };

  if (clean.company_url) errors.push("spam");
  if (!clean.name) errors.push("name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) errors.push("valid email is required");
  if (!clean.role_path) errors.push("role path is required");
  if (!clean.inquiry_type) errors.push("inquiry type is required");
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
    `Inquiry type: ${payload.inquiry_type}`,
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
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FORM_FROM_EMAIL;
  const to = process.env.FORM_TO_EMAIL || "info@luxveritas.media";

  if (!apiKey || !from) {
    return { delivered: false, reason: "email_provider_not_configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: payload.email,
      subject: subjectFor(payload),
      text: emailText(payload, id)
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.error("Resend delivery failed", { status: response.status, body, id });
    return { delivered: false, reason: "email_provider_error", providerStatus: response.status };
  }

  return { delivered: true, providerId: body.id || null };
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
      const delivery = await sendEmail(clean, id);
      if (stored) {
        await doc.update({
          deliveryStatus: delivery.delivered ? "sent" : delivery.reason,
          delivery,
          deliveredAt: delivery.delivered ? admin.firestore.FieldValue.serverTimestamp() : null
        });
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
        await doc.update({
          deliveryStatus: "relay_error",
          relayError: text(error?.message, 500)
        });
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
