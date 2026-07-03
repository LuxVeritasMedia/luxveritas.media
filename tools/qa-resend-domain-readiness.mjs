const apiKey = process.env.LUX_RESEND_API_KEY || "";
const targetDomain = (process.env.LUX_RESEND_DOMAIN || "luxveritas.media").trim().toLowerCase();
const fromEmail = (process.env.LUX_RESEND_FROM_EMAIL || "forms@luxveritas.media").trim().toLowerCase();
const apiBase = (process.env.LUX_RESEND_API_BASE || "https://api.resend.com").replace(/\/$/, "");
const strict = process.env.LUX_RESEND_DOMAIN_STRICT === "1";

function usage() {
  console.log("WARN Resend domain readiness skipped because LUX_RESEND_API_KEY is not set.");
  console.log("Set LUX_RESEND_API_KEY to the approved Resend API key, then run:");
  console.log("  LUX_RESEND_API_KEY='re_...' node tools/qa-resend-domain-readiness.mjs");
  console.log("Use LUX_RESEND_DOMAIN_STRICT=1 when missing domain proof should fail the command.");
  process.exit(strict ? 1 : 0);
}

function issue(message) {
  console.log(`BLOCK ${message}`);
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function warn(message) {
  console.log(`WARN ${message}`);
}

function senderDomain(email) {
  const match = email.match(/@([^>\s]+)>?$/);
  return match?.[1]?.toLowerCase() || "";
}

function isSendingReady(domain) {
  const status = String(domain?.status || "").toLowerCase();
  const sending = String(domain?.capabilities?.sending || "").toLowerCase();
  return sending === "enabled" && (status === "verified" || status === "partially_verified");
}

if (!apiKey) usage();

if (!/^re_/i.test(apiKey)) {
  console.error("LUX_RESEND_API_KEY does not look like a Resend API key. Expected it to start with re_.");
  process.exit(1);
}

if (!targetDomain) {
  issue("Target Resend domain is empty.");
  process.exit(1);
}

const fromDomain = senderDomain(fromEmail);
if (fromDomain !== targetDomain) {
  issue(`Sender ${fromEmail} does not belong to target domain ${targetDomain}.`);
  process.exit(1);
}

console.log(`Resend domain readiness for ${targetDomain}`);

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000);

let body;
let response;
try {
  response = await fetch(`${apiBase}/domains`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    signal: controller.signal
  });
  body = await response.json().catch(() => ({}));
} catch (error) {
  issue(`Resend domain lookup failed (${error?.message || String(error)}).`);
  process.exit(1);
} finally {
  clearTimeout(timeout);
}

if (!response.ok) {
  issue(`Resend domain lookup returned HTTP ${response.status} (${body?.message || body?.error || "unknown error"}).`);
  process.exit(1);
}

const domains = Array.isArray(body?.data) ? body.data : [];
const domain = domains.find((item) => String(item?.name || "").toLowerCase() === targetDomain);

if (!domain) {
  const names = domains.map((item) => item?.name).filter(Boolean).join(", ") || "none returned";
  issue(`Resend account does not list ${targetDomain}. Domains returned: ${names}.`);
  process.exit(1);
}

const status = String(domain.status || "unknown");
const sending = String(domain.capabilities?.sending || "unknown");
const receiving = String(domain.capabilities?.receiving || "unknown");

if (isSendingReady(domain)) {
  pass(`${targetDomain} is sending-ready in Resend (status ${status}, sending ${sending}).`);
} else {
  issue(`${targetDomain} is not sending-ready in Resend (status ${status}, sending ${sending}).`);
  process.exit(1);
}

if (status === "partially_verified") {
  warn(`${targetDomain} is partially verified; sending is enabled, but another capability may still be pending.`);
}

pass(`${fromEmail} is covered by ${targetDomain}.`);
console.log(`Resend checked: status ${status}, sending ${sending}, receiving ${receiving}.`);
