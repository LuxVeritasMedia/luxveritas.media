import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const runId = (process.env.LUX_QA_RUN_ID || "").replace(/[^A-Za-z0-9_-]+/g, "").slice(0, 48);
const expectedFormCount = Number(process.env.LUX_QA_EXPECT_FORM_COUNT || 10);
const expectedEventCount = Number(process.env.LUX_QA_EXPECT_EVENT_COUNT || 9);
const issues = [];

async function readKeychainReportToken() {
  if (process.platform !== "darwin") return "";
  try {
    const { stdout } = await execFileAsync("security", [
      "find-generic-password",
      "-s",
      "Lux Veritas Report Operator Token",
      "-a",
      "info@luxveritas.media",
      "-w"
    ], {
      timeout: 5000,
      maxBuffer: 1024 * 16
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

const reportToken = process.env.LUX_REPORT_TOKEN || await readKeychainReportToken();

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

function latestArray(report, path) {
  const value = path.split(".").reduce((current, part) => current?.[part], report);
  return Array.isArray(value) ? value : [];
}

function countPrefix(values, prefix) {
  return values.filter((value) => String(value || "").startsWith(prefix)).length;
}

if (!runId) issues.push("Set LUX_QA_RUN_ID so the live write reconciliation can find this run.");
if (!reportToken) issues.push("Set LUX_REPORT_TOKEN or save the operator token in macOS Keychain before reconciliation.");

let report = null;
if (!issues.length) {
  const response = await fetchJson("/api/report", {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${reportToken}`
    }
  });

  if (!response.ok) {
    issues.push(`/api/report: approved operator request expected HTTP 200, received ${response.status} (${response.json?.error || "unknown"})`);
  } else {
    report = response.json;
  }
}

if (report) {
  const submissions = latestArray(report, "latest.submissions");
  const events = latestArray(report, "latest.events");
  const handoffs = latestArray(report, "latest.handoffs");
  const submissionPrefix = `LV-MATRIX-${runId}-`;
  const eventPrefix = `LV-EVENT-MATRIX-${runId}-`;
  const submissionIds = submissions.map((item) => item.client_submission_id);
  const eventIds = events.map((item) => item.detail?.qa_id);
  const handoffIds = handoffs.map((item) => item.receiptId);
  const submissionMatches = countPrefix(submissionIds, submissionPrefix);
  const eventMatches = countPrefix(eventIds, eventPrefix);
  const handoffMatches = countPrefix(handoffIds, submissionPrefix);

  if (submissionMatches < expectedFormCount) {
    issues.push(`/api/report: latest submissions include ${submissionMatches}/${expectedFormCount} QA writes for ${runId}`);
  }
  if (eventMatches < expectedEventCount) {
    issues.push(`/api/report: latest events include ${eventMatches}/${expectedEventCount} QA writes for ${runId}`);
  }
  if (report.delivery?.integrationConfigured && handoffMatches < 1) {
    issues.push(`/api/report: latest handoffs do not include a QA receipt for ${runId}`);
  }

  const fanReaction = events.find((item) => (
    String(item.detail?.qa_id || "").startsWith(eventPrefix)
    && item.event === "fan_reaction"
  ));
  if (!fanReaction) {
    issues.push(`/api/report: latest events do not include fan_reaction QA write for ${runId}`);
  } else {
    if (fanReaction.detail?.reaction !== "collect") {
      issues.push(`/api/report: fan_reaction QA write has reaction ${fanReaction.detail?.reaction || "missing"}, expected collect`);
    }
    if (fanReaction.detail?.reporting_key !== "spmvp_release_audio") {
      issues.push(`/api/report: fan_reaction QA write has reporting key ${fanReaction.detail?.reporting_key || "missing"}, expected spmvp_release_audio`);
    }
  }
}

if (issues.length) {
  console.error(`Live write reconciliation failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Live write reconciliation passed for ${baseUrl} run ${runId}.`);
