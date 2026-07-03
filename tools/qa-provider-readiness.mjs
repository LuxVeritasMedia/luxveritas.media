import {
  liveProviderDeliveryReadiness,
  providerSecretMetadataEntries,
  providerSecretValueStatusEntries,
  requiredProviderSecrets
} from "./lib/provider-readiness.mjs";
import { resolveReportOperatorToken } from "./lib/operator-token.mjs";

const project = process.env.LUX_FIREBASE_PROJECT || "lux-veritas-media";
const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const { token: reportToken, source: reportTokenSource } = await resolveReportOperatorToken();
const strict = process.env.LUX_PROVIDER_STRICT === "1";
const issues = [];
const localSecretIssues = [];
const warnings = [];
const passed = [];
let authUnavailable = false;

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
if (reportTokenSource === "macOS Keychain") {
  warn("Using macOS Keychain operator token for protected live provider readiness.");
}

const metadataEntries = await providerSecretMetadataEntries(project);
const metadata = Object.fromEntries(metadataEntries);
const valueStatusEntries = await providerSecretValueStatusEntries(project);
const valueStatus = Object.fromEntries(valueStatusEntries);

for (const name of requiredProviderSecrets) {
  const item = metadata[name];
  if (item.ok) {
    pass(`${name} secret metadata exists (version ${item.versionId}, ${item.state}).`);
  } else {
    if (item.status === "auth_unavailable") authUnavailable = true;
    const message = `${name} secret metadata missing or unavailable${item.error ? ` (${item.error})` : ""}.`;
    if (item.status === "auth_unavailable") localSecretIssues.push(message);
    else issue(message);
  }

  const status = valueStatus[name];
  if (status?.ok) {
    pass(`${name} secret value is active (${status.detail}).`);
  } else {
    if (status?.status === "auth_unavailable") authUnavailable = true;
    const message = `${name} secret value is not active${status?.detail ? ` (${status.detail})` : ""}.`;
    if (status?.status === "auth_unavailable") localSecretIssues.push(message);
    else issue(message);
  }
}

const readiness = await liveProviderDeliveryReadiness({ baseUrl, reportToken });
if (readiness.warning) warn(readiness.warning);
if (readiness.error) issue(readiness.error);

const delivery = readiness.delivery;
let liveProviderActive = false;
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

  liveProviderActive = Boolean(
    delivery.emailProviderConfigured
    && delivery.integrationConfigured
    && delivery.integrationTargetConfigured
    && delivery.operatorTokenConfigured
  );
}

if (localSecretIssues.length) {
  if (authUnavailable && liveProviderActive) {
    warn("Local Firebase CLI credentials are expired, so direct secret metadata could not be inspected; protected live provider report is active.");
    for (const item of localSecretIssues) warn(item);
  } else {
    for (const item of localSecretIssues) issue(item);
  }
}

for (const message of passed) console.log(`PASS ${message}`);
if (warnings.length) {
  console.log("Provider readiness warnings:");
  for (const warning of warnings) console.log(`WARN ${warning}`);
  if (authUnavailable && liveProviderActive) {
    console.log("");
    console.log("Local Firebase reauth guidance:");
    console.log("- This is an operator-machine issue only; the protected live provider report is active.");
    console.log("- Run: firebase login --reauth --no-localhost");
    console.log("- Select info@luxveritas.media and paste the one-time code into the terminal prompt only.");
    console.log("- Then rerun: node tools/qa-provider-readiness.mjs");
  }
}
if (issues.length) {
  console.log("Provider readiness blockers:");
  for (const item of issues) console.log(`BLOCK ${item}`);
  console.log("");
  console.log("Next setup commands:");
  if (authUnavailable) {
    console.log("- firebase login --reauth --no-localhost");
    console.log("- node tools/qa-provider-readiness.mjs");
  } else {
    const needsInbox = valueStatus.RESEND_API_KEY?.ok !== true;
    const needsIntegration = valueStatus.FORM_INTEGRATION_URL?.ok !== true
      || valueStatus.FORM_INTEGRATION_SIGNING_SECRET?.ok !== true
      || valueStatus.FORM_INTEGRATION_TARGET?.ok !== true;
    const needsOperatorToken = valueStatus.REPORT_OPERATOR_TOKEN_SHA256?.ok !== true;

    if (needsInbox) {
      console.log("- LUX_RESEND_API_KEY='re_...' node tools/activate-inbox-delivery.mjs");
    }
    if (needsIntegration) {
      console.log("- LUX_FORM_INTEGRATION_URL='https://...' LUX_FORM_INTEGRATION_SIGNING_SECRET='approved-shared-secret' LUX_FORM_INTEGRATION_TARGET='firebase_handoff' node tools/activate-private-integration.mjs");
    }
    if (needsOperatorToken) {
      console.log("- LUX_REPORT_TOKEN='paste-private-operator-token-here' node tools/generate-report-operator-token.mjs");
      console.log("- printf '%s' '<sha256>' | firebase functions:secrets:set REPORT_OPERATOR_TOKEN_SHA256 --project lux-veritas-media");
    }
    if (!needsInbox) {
      console.log("- firebase deploy --only functions:submitForm,functions:reportActivity --project lux-veritas-media --non-interactive --force");
    }
  }
  if (strict) process.exit(1);
}

console.log(`Provider readiness checked: ${passed.length} passed, ${warnings.length} warning(s), ${issues.length} blocker(s).`);
if (!strict && issues.length) {
  console.log("Run with LUX_PROVIDER_STRICT=1 when provider blockers must fail the command.");
}
