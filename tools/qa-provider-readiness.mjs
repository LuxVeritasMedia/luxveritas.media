import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const project = process.env.LUX_FIREBASE_PROJECT || "lux-veritas-media";
const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const reportToken = process.env.LUX_REPORT_TOKEN || "";
const strict = process.env.LUX_PROVIDER_STRICT === "1";
const issues = [];
const warnings = [];
const passed = [];

const requiredSecrets = [
  "RESEND_API_KEY",
  "FORM_INTEGRATION_URL",
  "FORM_INTEGRATION_SIGNING_SECRET",
  "FORM_INTEGRATION_TARGET",
  "REPORT_OPERATOR_TOKEN_SHA256"
];

function pass(message) {
  passed.push(message);
}

function issue(message) {
  issues.push(message);
}

function warn(message) {
  warnings.push(message);
}

async function secretMetadata(name) {
  try {
    const { stdout } = await execFileAsync("firebase", [
      "functions:secrets:get",
      name,
      "--project",
      project,
      "--json"
    ], { maxBuffer: 1024 * 1024 });
    const body = JSON.parse(stdout);
    const item = body.result?.secrets?.[0];
    return {
      ok: body.status === "success" && item?.state === "ENABLED",
      versionId: item?.versionId || "",
      createTime: item?.createTime || "",
      state: item?.state || "missing"
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || String(error)
    };
  }
}

async function secretMetadataEntries() {
  const entries = [];
  for (const name of requiredSecrets) {
    entries.push([name, await secretMetadata(name)]);
  }
  return entries;
}

async function liveDeliveryReadiness() {
  if (!reportToken) {
    warn("Set LUX_REPORT_TOKEN to check live provider readiness from /api/report.");
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}/api/report`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${reportToken}`
      },
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.ok) {
      issue(`/api/report readiness check failed with HTTP ${response.status} (${body.error || "unknown"}).`);
      return null;
    }
    return body.delivery || {};
  } catch (error) {
    issue(`/api/report readiness check failed (${error?.message || String(error)}).`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

console.log(`Provider readiness for project ${project}`);

const metadataEntries = await secretMetadataEntries();
const metadata = Object.fromEntries(metadataEntries);

for (const name of requiredSecrets) {
  const item = metadata[name];
  if (item.ok) {
    pass(`${name} secret metadata exists (version ${item.versionId}, ${item.state}).`);
  } else {
    issue(`${name} secret metadata missing or unavailable${item.error ? ` (${item.error})` : ""}.`);
  }
}

const delivery = await liveDeliveryReadiness();
if (delivery) {
  if (delivery.emailProviderConfigured) {
    pass("Live inbox provider value is active.");
  } else {
    issue("Live inbox provider value is not active.");
  }

  if (delivery.integrationConfigured && delivery.integrationTargetConfigured) {
    pass(`Live private handoff is active for target ${delivery.integrationTarget || "configured"}.`);
  } else {
    issue(`Live private handoff is not active${delivery.integrationTarget ? ` (target ${delivery.integrationTarget})` : ""}.`);
  }

  if (delivery.operatorTokenConfigured) {
    pass("Live operator report token is configured.");
  } else {
    issue("Live operator report token is not configured.");
  }

  if (Array.isArray(delivery.missing) && delivery.missing.length) {
    warn(`Live readiness reports missing: ${delivery.missing.join(", ")}.`);
  }
}

for (const message of passed) console.log(`PASS ${message}`);
if (warnings.length) {
  console.log("Provider readiness warnings:");
  for (const warning of warnings) console.log(`WARN ${warning}`);
}
if (issues.length) {
  console.log("Provider readiness blockers:");
  for (const item of issues) console.log(`BLOCK ${item}`);
  console.log("");
  console.log("Next setup commands:");
  console.log("- LUX_RESEND_API_KEY='re_...' node tools/setup-inbox-provider-secret.mjs");
  console.log("- LUX_FORM_INTEGRATION_URL='https://...' LUX_FORM_INTEGRATION_TARGET='private_workflow' node tools/setup-private-integration-secret.mjs");
  console.log("- firebase deploy --only functions:submitForm,functions:reportActivity --project lux-veritas-media --non-interactive --force");
  if (strict) process.exit(1);
}

console.log(`Provider readiness checked: ${passed.length} passed, ${warnings.length} warning(s), ${issues.length} blocker(s).`);
if (!strict && issues.length) {
  console.log("Run with LUX_PROVIDER_STRICT=1 when provider blockers must fail the command.");
}
