import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const reportToken = process.env.LUX_REPORT_TOKEN || "";
const strict = process.env.LUX_OPERATOR_REPORT_STRICT === "1";
const expectReady = process.env.LUX_OPERATOR_REPORT_EXPECT_READY !== "0";
const issues = [];
const warnings = [];

const allowedAuthModes = new Set(["operator_token", "google_oauth", "approved"]);
const countFields = ["submissions", "events", "privateHandoffs", "pendingNotifications", "pendingIntegrations"];
const submissionSummaryFields = [
  "byFormType",
  "byInquiryType",
  "byRolePath",
  "byAccessPath",
  "byPortalRoleTarget",
  "byInterestPath",
  "byRoutingQueue",
  "byRoutingPriority",
  "byDeliveryStatus",
  "byIntegrationStatus",
  "bySourcePage"
];
const eventSummaryFields = [
  "byEvent",
  "byCtaId",
  "byCtaLabel",
  "byPage",
  "bySurface",
  "byDestination",
  "mediaDemand",
  "playbackByAction",
  "playbackBySourceType",
  "playbackByReportingKey",
  "playbackMilestones",
  "fanReactions",
  "fanReactionsBySource"
];
const handoffSummaryFields = ["byTarget", "byEventType", "bySourcePage", "byRoutingQueue"];

const secretValuePatterns = [
  ["Resend API key", /\bre_[A-Za-z0-9_-]{16,}\b/],
  ["OpenAI-style API key", /\bsk-[A-Za-z0-9_-]{16,}\b/],
  ["Google API key", /\bAIza[A-Za-z0-9_-]{16,}\b/],
  ["Bearer credential", /\bBearer\s+[A-Za-z0-9._-]{16,}\b/i],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/i]
];

function issue(message) {
  issues.push(message);
}

function warn(message) {
  if (strict) issues.push(message);
  else warnings.push(message);
}

async function fetchJson(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      text,
      json: text ? JSON.parse(text) : {}
    };
  } catch (error) {
    if (error?.message === "fetch failed" || error?.name === "TypeError") {
      return curlJson(path, options);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function curlJson(path, options = {}) {
  const marker = "__HTTP_STATUS__:";
  const args = [
    "-sS",
    "-m",
    "15",
    "--connect-timeout",
    "10",
    "--retry",
    "2",
    "--retry-all-errors",
    "-X",
    options.method || "GET"
  ];

  for (const [key, value] of Object.entries(options.headers || {})) {
    args.push("-H", `${key}: ${value}`);
  }
  if (options.body) args.push("--data", options.body);
  args.push("-w", `\n${marker}%{http_code}`, `${baseUrl}${path}`);

  const { stdout } = await execFileAsync("curl", args, { maxBuffer: 1024 * 1024 * 4 });
  const markerIndex = stdout.lastIndexOf(marker);
  if (markerIndex === -1) throw new Error("curl response missing status marker");

  const text = stdout.slice(0, markerIndex).trim();
  const status = Number(stdout.slice(markerIndex + marker.length).trim());
  return {
    status,
    ok: status >= 200 && status < 300,
    text,
    json: text ? JSON.parse(text) : {}
  };
}

function valueAt(root, path) {
  return path.split(".").reduce((current, part) => current?.[part], root);
}

function assertArray(root, path) {
  const value = valueAt(root, path);
  if (!Array.isArray(value)) issue(`/api/report: expected ${path} to be an array`);
  return Array.isArray(value) ? value : [];
}

function assertSummaryArrayItems(items, path) {
  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== "object") {
      issue(`/api/report: ${path}[${index}] is not an object`);
      continue;
    }
    if (typeof item.label !== "string" || !item.label) issue(`/api/report: ${path}[${index}] missing label`);
    if (typeof item.count !== "number") issue(`/api/report: ${path}[${index}] missing numeric count`);
  }
}

function assertFunnelItems(items, path) {
  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== "object") {
      issue(`/api/report: ${path}[${index}] is not an object`);
      continue;
    }
    if (typeof item.label !== "string" || !item.label) issue(`/api/report: ${path}[${index}] missing label`);
    if (typeof item.value !== "number") issue(`/api/report: ${path}[${index}] missing numeric value`);
    if (typeof item.detail !== "string") issue(`/api/report: ${path}[${index}] missing detail`);
  }
}

function checkWorkflowTargets(report) {
  const workflow = valueAt(report, "summary.workflowTargets");
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    issue("/api/report: summary.workflowTargets is missing or not an object");
    return;
  }

  for (const field of ["activeTarget", "activeLabel", "decisionStatus", "recommendedPrimary", "recommendedLabel", "nextAction"]) {
    if (typeof workflow[field] !== "string" || !workflow[field]) {
      issue(`/api/report: summary.workflowTargets.${field} is missing`);
    }
  }
  if (typeof workflow.recommendedSignalCount !== "number") {
    issue("/api/report: summary.workflowTargets.recommendedSignalCount is missing or not numeric");
  }

  for (const path of ["summary.workflowTargets.byRecommendedTarget", "summary.workflowTargets.queueRecommendations", "summary.workflowTargets.guardrails"]) {
    const value = valueAt(report, path);
    if (!Array.isArray(value)) issue(`/api/report: expected ${path} to be an array`);
  }

  for (const [index, item] of (workflow.byRecommendedTarget || []).entries()) {
    if (typeof item.label !== "string" || !item.label) issue(`/api/report: summary.workflowTargets.byRecommendedTarget[${index}] missing label`);
    if (typeof item.target !== "string" || !item.target) issue(`/api/report: summary.workflowTargets.byRecommendedTarget[${index}] missing target`);
    if (typeof item.count !== "number") issue(`/api/report: summary.workflowTargets.byRecommendedTarget[${index}] missing numeric count`);
  }

  for (const [index, item] of (workflow.queueRecommendations || []).entries()) {
    for (const field of ["queue", "label", "recommendedPrimary", "recommendedLabel", "reason"]) {
      if (typeof item[field] !== "string" || !item[field]) {
        issue(`/api/report: summary.workflowTargets.queueRecommendations[${index}].${field} is missing`);
      }
    }
    if (typeof item.count !== "number") issue(`/api/report: summary.workflowTargets.queueRecommendations[${index}] missing numeric count`);
    if (!Array.isArray(item.alternatives)) issue(`/api/report: summary.workflowTargets.queueRecommendations[${index}].alternatives is not an array`);
  }

  for (const [index, item] of (workflow.guardrails || []).entries()) {
    if (typeof item !== "string" || !item) issue(`/api/report: summary.workflowTargets.guardrails[${index}] is missing`);
  }
}

function checkIntakeQueue(report) {
  const queue = valueAt(report, "summary.intakeQueue");
  if (!queue || typeof queue !== "object" || Array.isArray(queue)) {
    issue("/api/report: summary.intakeQueue is missing or not an object");
    return;
  }

  for (const field of ["sampleSize", "openItems", "highPriority", "pendingInbox", "pendingHandoff"]) {
    if (typeof queue[field] !== "number") {
      issue(`/api/report: summary.intakeQueue.${field} is missing or not numeric`);
    }
  }
  for (const field of ["topQueue", "nextAction"]) {
    if (typeof queue[field] !== "string") {
      issue(`/api/report: summary.intakeQueue.${field} is missing`);
    }
  }
  if (!Array.isArray(queue.queues)) {
    issue("/api/report: summary.intakeQueue.queues is not an array");
    return;
  }

  for (const [index, item] of queue.queues.entries()) {
    for (const field of ["queue", "label", "owner", "priority", "sla", "nextAction", "reviewSignal", "reviewLabel"]) {
      if (typeof item[field] !== "string" || !item[field]) {
        issue(`/api/report: summary.intakeQueue.queues[${index}].${field} is missing`);
      }
    }
    for (const field of ["count", "pendingInbox", "pendingHandoff", "sentInbox", "acceptedHandoff", "highPriority", "oldestAgeDays"]) {
      if (typeof item[field] !== "number") {
        issue(`/api/report: summary.intakeQueue.queues[${index}].${field} is missing or not numeric`);
      }
    }
  }
}

function scanSecretValues(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanSecretValues(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => scanSecretValues(item, `${path}.${key}`));
    return;
  }
  if (typeof value !== "string") return;

  for (const [label, pattern] of secretValuePatterns) {
    if (pattern.test(value)) issue(`/api/report: ${path} appears to expose a ${label}`);
  }
}

async function checkProtection() {
  const response = await fetchJson("/api/report", {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (response.status === 401) return;
  if (response.status === 403 && /Forbidden/i.test(response.text)) {
    issue("/api/report: Cloud Run public access is blocked before the function can enforce auth");
    return;
  }
  if (response.ok) {
    issue("/api/report: unauthenticated request returned HTTP 200");
    return;
  }
  issue(`/api/report: unauthenticated request expected HTTP 401, received ${response.status}`);
}

function checkReportBody(report) {
  if (report.ok !== true) issue("/api/report: expected ok:true");
  if (!report.generatedAt || Number.isNaN(Date.parse(report.generatedAt))) {
    issue("/api/report: generatedAt is missing or not ISO-like");
  }
  if (!report.viewer || typeof report.viewer !== "string") issue("/api/report: viewer is missing");
  if (!allowedAuthModes.has(report.authMode)) {
    issue(`/api/report: unexpected authMode ${report.authMode || "none"}`);
  }

  for (const field of countFields) {
    if (typeof report.counts?.[field] !== "number") issue(`/api/report: counts.${field} is missing or not numeric`);
  }

  const delivery = report.delivery || {};
  if (expectReady) {
    if (delivery.inboxNotification !== "ready") issue("/api/report: inbox notifications are not ready");
    if (delivery.storeFirstCapture !== "ready") issue("/api/report: store-first capture is not ready");
    if (delivery.integrationWebhook !== "ready") issue("/api/report: private handoff webhook is not ready");
    if (delivery.emailProviderConfigured !== true) issue("/api/report: email provider is not configured");
    if (delivery.integrationConfigured !== true) issue("/api/report: private handoff integration is not configured");
    if (delivery.integrationTargetConfigured !== true) issue("/api/report: private handoff target is not configured");
    if (delivery.operatorTokenConfigured !== true) issue("/api/report: operator report token is not configured");
    if (Array.isArray(delivery.missing) && delivery.missing.length) {
      issue(`/api/report: readiness still reports missing ${delivery.missing.join(", ")}`);
    }
  }

  for (const path of ["latest.submissions", "latest.events", "latest.handoffs"]) {
    const latest = assertArray(report, path);
    if (latest.length > 20) issue(`/api/report: ${path} should expose at most 20 records`);
  }

  assertFunnelItems(assertArray(report, "summary.funnel"), "summary.funnel");
  for (const field of submissionSummaryFields) {
    assertSummaryArrayItems(assertArray(report, `summary.submissions.${field}`), `summary.submissions.${field}`);
  }
  for (const field of eventSummaryFields) {
    assertSummaryArrayItems(assertArray(report, `summary.events.${field}`), `summary.events.${field}`);
  }
  for (const field of handoffSummaryFields) {
    assertSummaryArrayItems(assertArray(report, `summary.handoffs.${field}`), `summary.handoffs.${field}`);
  }
  checkIntakeQueue(report);
  checkWorkflowTargets(report);

  scanSecretValues(report);
}

async function checkApprovedReport() {
  if (!reportToken) {
    warn("Set LUX_REPORT_TOKEN to verify live approved-operator report values.");
    return;
  }

  const response = await fetchJson("/api/report", {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${reportToken}`
    }
  });

  if (!response.ok) {
    issue(`/api/report: approved operator request expected HTTP 200, received ${response.status} (${response.json?.error || "unknown"})`);
    return;
  }

  checkReportBody(response.json);
}

await checkProtection();
await checkApprovedReport();

if (warnings.length) {
  console.warn("Live operator report QA warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (issues.length) {
  console.error(`Live operator report QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Live operator report QA passed for ${baseUrl}${reportToken ? " with approved report values" : " protection-only mode"}.`);
