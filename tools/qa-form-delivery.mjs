import { execFile } from "node:child_process";
import { promisify } from "node:util";

const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const writeEnabled = process.env.LUX_FORM_WRITE === "1";
const expectEmailSent = process.env.LUX_EXPECT_EMAIL_SENT === "1";
const strictLiveQa = process.env.LUX_STRICT_LIVE_QA === "1" || writeEnabled;
const issues = [];
const warnings = [];
const execFileAsync = promisify(execFile);

function parseJson(text) {
  return text ? JSON.parse(text) : {};
}

async function curlWithTimeout(path, options = {}) {
  const timeoutSeconds = Math.ceil((options.timeoutMs || 15000) / 1000);
  const marker = "__HTTP_STATUS__:";
  const args = [
    "-sS",
    "-m",
    String(timeoutSeconds),
    "-X",
    options.method || "GET",
    "-w",
    `\n${marker}%{http_code}`
  ];

  for (const [key, value] of Object.entries(options.headers || {})) {
    args.push("-H", `${key}: ${value}`);
  }
  if (options.body) args.push("--data", options.body);
  args.push(`${baseUrl}${path}`);

  const { stdout } = await execFileAsync("curl", args, {
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
    json: parseJson(text),
    text
  };
}

async function fetchWithTimeout(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method || "GET",
      headers: options.headers,
      body: options.body,
      signal: controller.signal
    });
    const text = await response.text();
    const json = parseJson(text);
    return { response, json, text };
  } catch (error) {
    if (error?.message === "fetch failed" || error?.name === "TypeError") {
      return curlWithTimeout(path, options);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

try {
  const { response, json } = await fetchWithTimeout("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ name: "Codex QA" })
  });

  if (response.status !== 400 && response.status !== 429) {
    issues.push(`/api/submit validation check expected HTTP 400 or 429, received ${response.status}`);
  }
  if (response.status === 400 && json.error !== "validation_failed") {
    issues.push(`/api/submit validation check returned unexpected error: ${json.error || "none"}`);
  }
} catch (error) {
  const message = `/api/submit validation check failed: ${error.message}`;
  if (strictLiveQa) issues.push(message);
  else warnings.push(`${message}. Live network check skipped in non-strict mode.`);
}

if (writeEnabled) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const payload = {
    client_submission_id: `LV-QA-${stamp}`,
    name: "Codex Form Delivery QA",
    email: process.env.LUX_FORM_EMAIL || "info@luxveritas.media",
    phone: "",
    role_path: "General",
    inquiry_type: "General",
    message: "QA test for Lux Veritas form delivery. Safe to archive.",
    formType: "request",
    tag: "qa-form-delivery",
    source: "luxveritas.media",
    source_page: "/qa-form-delivery",
    consent_email: "yes",
    consent_sms: "no",
    company_url: ""
  };

  try {
    const { response, json } = await fetchWithTimeout("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok && response.status !== 202) {
      issues.push(`/api/submit write check expected accepted response, received HTTP ${response.status}`);
    }
    if (!json.ok || !json.id) {
      issues.push("/api/submit write check did not return ok:true with an id");
    }
    if (json.delivery === "sent") {
      console.log(`Form delivery QA sent inbox notification for ${payload.client_submission_id}.`);
    } else if (json.delivery === "stored") {
      const reason = json.reason ? ` (${json.reason})` : "";
      const message = `Form delivery QA stored ${payload.client_submission_id}, but inbox notification is not active${reason}.`;
      if (expectEmailSent) issues.push(message);
      else warnings.push(message);
    } else {
      const message = `Form delivery QA returned delivery=${json.delivery || "unknown"} for ${payload.client_submission_id}.`;
      if (expectEmailSent) issues.push(message);
      else warnings.push(message);
    }
  } catch (error) {
    issues.push(`/api/submit write check failed: ${error.message}`);
  }
} else {
  warnings.push("Skipped live write check. Set LUX_FORM_WRITE=1 to create a QA submission.");
}

if (warnings.length) {
  console.warn("Form delivery QA warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (issues.length) {
  console.error(`Form delivery QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Form delivery QA passed for ${baseUrl}.`);
