import { execFile } from "node:child_process";
import { promisify } from "node:util";

const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const writeEnabled = process.env.LUX_FORM_MATRIX_WRITE === "1";
const expectEmailSent = process.env.LUX_EXPECT_EMAIL_SENT === "1";
const strictLiveQa = process.env.LUX_STRICT_LIVE_QA === "1" || writeEnabled;
const maxNetworkAttempts = Math.max(1, Math.min(Number(process.env.LUX_FORM_MATRIX_ATTEMPTS) || 3, 5));
const issues = [];
const warnings = [];
const execFileAsync = promisify(execFile);

// Keep this under the live submit rate limit: one validation request plus one
// write for each unique capture intent exposed by the current public shell.
const matrix = [
  { sourcePage: "/index.html", formType: "request", tag: "request-access", rolePath: "General", inquiryType: "Portal" },
  { sourcePage: "/membership.html", formType: "fan", tag: "membership-waitlist", rolePath: "Member", inquiryType: "Membership" },
  { sourcePage: "/submissions.html", formType: "submission", tag: "submission", rolePath: "Creator", inquiryType: "Submissions" },
  { sourcePage: "/contact.html", formType: "press", tag: "press", rolePath: "Press", inquiryType: "Press" },
  { sourcePage: "/investor.html", formType: "investor", tag: "investor-access", rolePath: "Investor", inquiryType: "Investor" },
  { sourcePage: "/events/listening-room.html", formType: "event", tag: "event-interest", rolePath: "Event guest", inquiryType: "Events" },
  { sourcePage: "/codex-inner.html", formType: "codex", tag: "codex-request", rolePath: "Creator", inquiryType: "Portal" },
  { sourcePage: "/portal/releases.html", formType: "licensing", tag: "licensing-access", rolePath: "Partner", inquiryType: "Licensing" },
  { sourcePage: "/portal/library.html", formType: "creator", tag: "creator-access", rolePath: "Creator", inquiryType: "Portal" },
  { sourcePage: "/pilot-feedback.html", formType: "feedback", tag: "pilot-feedback", rolePath: "General", inquiryType: "Portal" },
  { sourcePage: "/auth/signin.html", formType: "portal_signin", tag: "portal-signin", rolePath: "General", inquiryType: "Portal" }
];
const expectedFormTypes = [
  "request",
  "fan",
  "submission",
  "press",
  "investor",
  "event",
  "codex",
  "licensing",
  "creator",
  "feedback",
  "portal_signin"
];

function stamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

const qaRunId = (process.env.LUX_QA_RUN_ID || stamp())
  .replace(/[^A-Za-z0-9_-]+/g, "")
  .slice(0, 48) || stamp();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(path, payload) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxNetworkAttempts; attempt += 1) {
    try {
      return await postJsonOnce(path, payload);
    } catch (error) {
      lastError = error;
      if (attempt < maxNetworkAttempts) await sleep(500 * attempt);
    }
  }

  const message = lastError?.message || String(lastError || "unknown error");
  throw new Error(`all ${maxNetworkAttempts} network attempt${maxNetworkAttempts === 1 ? "" : "s"} failed: ${message}`);
}

async function postJsonOnce(path, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await response.text();
    return { response, json: text ? JSON.parse(text) : {} };
  } catch (error) {
    if (error?.message === "fetch failed" || error?.name === "TypeError") {
      return curlJson(path, payload);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function curlJson(path, payload) {
  const marker = "__HTTP_STATUS__:";
  const { stdout } = await execFileAsync("curl", [
    "-sS",
    "-m",
    "15",
    "--connect-timeout",
    "10",
    "--retry",
    "2",
    "--retry-all-errors",
    "-X",
    "POST",
    "-H",
    "Content-Type: application/json",
    "-H",
    "Accept: application/json",
    "--data",
    JSON.stringify(payload),
    "-w",
    `\n${marker}%{http_code}`,
    `${baseUrl}${path}`
  ], {
    maxBuffer: 1024 * 1024
  });
  const markerIndex = stdout.lastIndexOf(marker);
  if (markerIndex === -1) throw new Error("curl response missing status marker");
  const text = stdout.slice(0, markerIndex).trim();
  const status = Number(stdout.slice(markerIndex + marker.length).trim());
  return {
    response: {
      ok: status >= 200 && status < 300,
      status
    },
    json: text ? JSON.parse(text) : {}
  };
}

async function validationCheck() {
  const { response, json } = await postJson("/api/submit", { name: "Lux Matrix QA" });
  if (response.status !== 400 && response.status !== 429) {
    issues.push(`validation check expected HTTP 400 or 429, received ${response.status}`);
  }
  if (response.status === 400 && json.error !== "validation_failed") {
    issues.push(`validation check returned unexpected error: ${json.error || "none"}`);
  }
}

async function writeCheck(item, index) {
  const id = `LV-MATRIX-${qaRunId}-${String(index + 1).padStart(2, "0")}`;
  const payload = {
    client_submission_id: id,
    name: `Codex Matrix QA ${index + 1}`,
    email: process.env.LUX_FORM_EMAIL || "info@luxveritas.media",
    phone: "",
    role_path: item.rolePath,
    inquiry_type: item.inquiryType,
    message: `QA matrix test for ${item.formType} capture from ${item.sourcePage}. Safe to archive.`,
    formType: item.formType,
    tag: item.tag,
    interest_paths: ["music", "events"],
    source: "luxveritas.media",
    source_page: item.sourcePage,
    consent_email: "yes",
    consent_sms: "no",
    company_url: ""
  };

  const { response, json } = await postJson("/api/submit", payload);
  if (!response.ok && response.status !== 202) {
    issues.push(`${item.sourcePage}: expected accepted response, received HTTP ${response.status}`);
    return;
  }
  if (!json.ok || !json.id) {
    issues.push(`${item.sourcePage}: response did not return ok:true with an id`);
  }
  if (!["sent", "stored"].includes(json.delivery)) {
    issues.push(`${item.sourcePage}: expected delivery sent or stored, received ${json.delivery || "unknown"}`);
  }
  if (expectEmailSent && json.delivery !== "sent") {
    issues.push(`${item.sourcePage}: expected inbox sent, received ${json.delivery || "unknown"} (${json.reason || "no reason"})`);
  }
  if (json.delivery === "stored") {
    warnings.push(`${item.sourcePage} (${item.formType}): stored ${id}; inbox not active yet (${json.reason || "stored"}).`);
  } else {
    console.log(`${item.sourcePage} (${item.formType}): sent ${id}.`);
  }
}

function matrixCoverageCheck() {
  const formTypes = new Set(matrix.map((item) => item.formType));
  const missing = expectedFormTypes.filter((formType) => !formTypes.has(formType));
  const duplicates = matrix
    .map((item) => item.formType)
    .filter((formType, index, all) => all.indexOf(formType) !== index);

  if (missing.length) {
    issues.push(`live form matrix missing capture intent(s): ${missing.join(", ")}`);
  }
  if (duplicates.length) {
    issues.push(`live form matrix has duplicate capture intent(s): ${[...new Set(duplicates)].join(", ")}`);
  }
  if (matrix.length + 1 > 20) {
    issues.push(`live form matrix has ${matrix.length} write checks plus validation; keep total under the submit rate limit of 20.`);
  }
}

matrixCoverageCheck();

try {
  await validationCheck();
} catch (error) {
  const message = `validation check failed: ${error.message}`;
  if (strictLiveQa) issues.push(message);
  else warnings.push(`${message}. Live network check skipped in non-strict mode.`);
}

if (writeEnabled) {
  for (const [index, item] of matrix.entries()) {
    await writeCheck(item, index);
  }
} else {
  warnings.push(`Skipped live matrix writes for ${matrix.length} capture intent(s). Set LUX_FORM_MATRIX_WRITE=1 to create one QA submission per intent.`);
}

if (warnings.length) {
  console.warn("Live form matrix QA warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (issues.length) {
  console.error(`Live form matrix QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Live form matrix QA passed for ${baseUrl} with ${matrix.length} capture intent(s).`);
