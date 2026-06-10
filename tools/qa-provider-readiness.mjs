import {
  liveProviderDeliveryReadiness,
  providerSecretMetadataEntries,
  requiredProviderSecrets
} from "./lib/provider-readiness.mjs";

const project = process.env.LUX_FIREBASE_PROJECT || "lux-veritas-media";
const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const reportToken = process.env.LUX_REPORT_TOKEN || "";
const strict = process.env.LUX_PROVIDER_STRICT === "1";
const issues = [];
const warnings = [];
const passed = [];

function pass(message) {
  passed.push(message);
}

function issue(message) {
  issues.push(message);
}

function warn(message) {
  warnings.push(message);
}

console.log(`Provider readiness for project ${project}`);

const metadataEntries = await providerSecretMetadataEntries(project);
const metadata = Object.fromEntries(metadataEntries);

for (const name of requiredProviderSecrets) {
  const item = metadata[name];
  if (item.ok) {
    pass(`${name} secret metadata exists (version ${item.versionId}, ${item.state}).`);
  } else {
    issue(`${name} secret metadata missing or unavailable${item.error ? ` (${item.error})` : ""}.`);
  }
}

const readiness = await liveProviderDeliveryReadiness({ baseUrl, reportToken });
if (readiness.warning) warn(readiness.warning);
if (readiness.error) issue(readiness.error);

const delivery = readiness.delivery;
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
