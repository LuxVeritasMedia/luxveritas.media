import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { resolveReportOperatorToken } from "./lib/operator-token.mjs";

const execFileAsync = promisify(execFile);
const node = process.execPath;
const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const writeTests = process.env.LUX_PILOT_WRITE_TESTS === "1";
const dryRun = process.env.LUX_PILOT_WRITE_DRY_RUN === "1";
const expectedFormCaptureIntents = 11;
const expectedEventWrites = 13;
const qaRunId = (process.env.LUX_QA_RUN_ID || new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14))
  .replace(/[^A-Za-z0-9_-]+/g, "")
  .slice(0, 48);

const failures = [];
const passed = [];

const { token: reportToken, source: reportTokenSource } = await resolveReportOperatorToken();

const checks = [
  {
    label: "Operator Environment",
    script: "tools/qa-operator-environment.mjs",
    env: {}
  },
  {
    label: "MVP Status",
    script: "tools/qa-mvp-status.mjs",
    env: {},
    allowPreRefreshEvidence: writeTests
  },
  {
    label: "Deploy Status",
    script: "tools/qa-deploy-status.mjs",
    env: { LUX_DEPLOY_STATUS_STRICT: "1" }
  },
  {
    label: "Domain Readiness",
    script: "tools/qa-domain-readiness.mjs",
    env: { LUX_DOMAIN_STRICT: "1" }
  },
  {
    label: "Provider Readiness",
    script: "tools/qa-provider-readiness.mjs",
    env: { LUX_PROVIDER_STRICT: "1" },
    needsReportToken: true
  },
  {
    label: "Live Site",
    script: "tools/qa-live-site.mjs",
    env: {},
    allowPreRefreshEvidence: writeTests
  },
  {
    label: "Live Assets",
    script: "tools/qa-live-assets.mjs",
    env: {}
  },
  {
    label: "Live Media Sources",
    script: "tools/qa-live-media-sources.mjs",
    env: {}
  },
  {
    label: "Live Browser Flows",
    script: "tools/qa-browser-flows.mjs",
    env: { LUX_BROWSER_BASE_URL: baseUrl },
    retries: 1
  },
  {
    label: "Live Operator Report",
    script: "tools/qa-live-operator-report.mjs",
    env: { LUX_OPERATOR_REPORT_STRICT: "1" },
    needsReportToken: true
  },
  {
    label: "Release Readiness",
    script: "tools/qa-release-readiness.mjs",
    env: {},
    needsReportToken: true,
    allowLegalOnly: true,
    allowStalePilotEvidence: writeTests
  },
  (writeTests || dryRun) ? {
    label: writeTests ? "Live Form Write Matrix" : "Live Form Matrix Dry Run",
    script: "tools/qa-live-form-matrix.mjs",
    env: {
      LUX_FORM_MATRIX_WRITE: writeTests ? "1" : "0",
      LUX_EXPECT_EMAIL_SENT: writeTests ? "1" : "0",
      LUX_STRICT_LIVE_QA: "1",
      LUX_QA_RUN_ID: qaRunId
    },
    timeoutMs: writeTests ? 900000 : 180000
  } : null,
  (writeTests || dryRun) ? {
    label: writeTests ? "Live Event Write Matrix" : "Live Event Matrix Dry Run",
    script: "tools/qa-live-event-matrix.mjs",
    env: {
      LUX_EVENT_MATRIX_WRITE: writeTests ? "1" : "0",
      LUX_STRICT_LIVE_QA: "1",
      LUX_QA_RUN_ID: qaRunId
    }
  } : null,
  writeTests ? {
    label: "Post-Write Report Reconciliation",
    script: "tools/qa-live-write-reconciliation.mjs",
    env: {
      LUX_QA_RUN_ID: qaRunId,
      LUX_QA_EXPECT_FORM_COUNT: String(expectedFormCaptureIntents),
      LUX_QA_EXPECT_EVENT_COUNT: String(expectedEventWrites)
    },
    needsReportToken: true,
    timeoutMs: 300000
  } : null
].filter(Boolean);

function compactOutput(output) {
  return output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => (
      line
      && /^(BLOCK|FAIL|WARN|PASS|- |Live |Release readiness|Provider readiness|Domain readiness|Deploy status|Operator environment|MVP status|Browser flow|Run with|Checks with warnings)/i.test(line)
    ))
    .slice(-44)
    .join("\n");
}

function releaseBlockers(output) {
  const blockers = [];
  let collecting = false;
  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();
    if (/^Release readiness blockers/i.test(line)) {
      collecting = true;
      continue;
    }
    if (collecting && /^(Release readiness checked|Run with)/i.test(line)) {
      collecting = false;
      continue;
    }
    if (collecting && /^- /.test(line)) {
      blockers.push(line.replace(/^- /, ""));
    }
  }
  return blockers;
}

function isAllowedLegalBlocker(blocker) {
  return /Privacy page legal review (complete|is approved|is not approved)/i.test(blocker)
    || /Terms page legal review (complete|is approved|is not approved)/i.test(blocker);
}

function isAllowedReleaseReadinessBlocker(blocker, check) {
  if (isAllowedLegalBlocker(blocker)) return true;
  return check.allowStalePilotEvidence === true && (
    /pilot write evidence is stale/i.test(blocker)
    || /Pilot bug register asset version matches generated build/i.test(blocker)
    || /Pilot bug register references current pilot write evidence/i.test(blocker)
  );
}

function isAllowedPreRefreshEvidenceOutput(output) {
  const issueLines = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, ""));
  if (!issueLines.length) return false;
  return issueLines.every((line) => (
    /pilot write evidence must include \d+ event writes/i.test(line)
    || /pilot write evidence assetVersion .* does not match current build/i.test(line)
    || /write evidence must cover 11 forms and \d+ events/i.test(line)
    || /assetVersion does not match live build manifest/i.test(line)
    || /asset version does not match live build manifest/i.test(line)
    || /assetVersion must match current build/i.test(line)
  ));
}

function qaRunDateLabel() {
  return `${qaRunId.slice(0, 4)}-${qaRunId.slice(4, 6)}-${qaRunId.slice(6, 8)}`;
}

function replacePilotEvidenceMarkers(current, evidence) {
  return current
    .replace(/((?:The )?[Pp]ilot write gate last passed on )\d{4}-\d{2}-\d{2}/, `$1${qaRunDateLabel()}`)
    .replace(/(Inbox delivery was (?:last )?confirmed by the )\d{4}-\d{2}-\d{2}( pilot write gate, QA run ID `)[^`]+(`)/g, `$1${qaRunDateLabel()}$2${qaRunId}$3`)
    .replace(/(Inbox provider closeout is resolved: the )\d{4}-\d{2}-\d{2}( pilot write gate confirmed)/g, `$1${qaRunDateLabel()}$2`)
    .replace(/QA run ID: `[^`]+`/g, `QA run ID: \`${qaRunId}\``)
    .replace(/Asset version: `[^`]+`/g, `Asset version: \`${evidence.assetVersion}\``)
    .replace(/Current asset version is `[^`]+`/g, `Current asset version is \`${evidence.assetVersion}\``)
    .replace(/Current pilot evidence asset version: `[^`]+`/g, `Current pilot evidence asset version: \`${evidence.assetVersion}\``)
    .replace(/Current asset version: `[^`]+`/g, `Current asset version: \`${evidence.assetVersion}\``)
    .replace(/Current live asset version: `[^`]+`/g, `Current live asset version: \`${evidence.assetVersion}\``)
    .replace(/Live build version: `[^`]+`/g, `Live build version: \`${evidence.assetVersion}\``)
    .replace(/Latest pilot QA run: `[^`]+`/g, `Latest pilot QA run: \`${qaRunId}\``)
    .replace(/Pilot evidence updated: `[^`]+`/g, `Pilot evidence updated: \`${evidence.updatedAt}\``)
    .replace(/\b12 live event writes\b/g, `${expectedEventWrites} live event writes`)
    .replace(/\b12 event writes\b/g, `${expectedEventWrites} event writes`)
    .replace(/\bLive event\/reporting writes: `?\d+`?/g, `Live event/reporting writes: \`${expectedEventWrites}\``)
    .replace(/\bEvent\/reporting writes: `?12`?/g, `Event/reporting writes: \`${expectedEventWrites}\``);
}

async function refreshPilotEvidenceDocs(evidence) {
  const replacements = [
    "docs/final-launch-runbook.md",
    "docs/production-release-handoff.md",
    "docs/launch-blocker-resolution.md",
    "docs/legal-review-packet.md"
  ];
  for (const file of replacements) {
    const current = await readFile(file, "utf8");
    const next = replacePilotEvidenceMarkers(current, evidence);
    await writeFile(file, next);
  }
}

async function refreshPilotEvidenceState(evidence) {
  const [phaseRaw, bugRaw] = await Promise.all([
    readFile("data/lux-phase-status.json", "utf8"),
    readFile("data/lux-pilot-bug-register.json", "utf8")
  ]);
  const phaseStatus = JSON.parse(phaseRaw);
  const bugRegister = JSON.parse(bugRaw);
  const capabilities = new Set([
    ...(Array.isArray(phaseStatus.pilotEvidence?.verifiedCapabilities) ? phaseStatus.pilotEvidence.verifiedCapabilities : []),
    "release_room_reporting",
    "page_view_reporting"
  ]);

  phaseStatus.updatedAt = evidence.updatedAt;
  phaseStatus.pilotEvidence = {
    ...(phaseStatus.pilotEvidence || {}),
    assetVersion: evidence.assetVersion,
    qaRunId: evidence.qaRunId,
    result: evidence.result,
    evidenceFile: "data/lux-pilot-write-evidence.json",
    verifiedCapabilities: [...capabilities]
  };

  bugRegister.updatedAt = evidence.updatedAt;
  bugRegister.evidence = {
    ...(bugRegister.evidence || {}),
    assetVersion: evidence.assetVersion,
    pilotWriteQaRunId: evidence.qaRunId,
    pilotWriteEvidenceFile: "data/lux-pilot-write-evidence.json"
  };

  await Promise.all([
    writeFile("data/lux-phase-status.json", `${JSON.stringify(phaseStatus, null, 2)}\n`),
    writeFile("data/lux-pilot-bug-register.json", `${JSON.stringify(bugRegister, null, 2)}\n`)
  ]);
}

async function writePilotEvidence() {
  const buildManifest = JSON.parse(await readFile("data/lux-build-manifest.json", "utf8"));
  const evidence = {
    schemaVersion: "luxveritas.pilot_write_evidence.v1",
    updatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    liveUrl: baseUrl,
    assetVersion: buildManifest.assetVersion || buildManifest.version || "",
    qaRunId,
    command: "LUX_PILOT_WRITE_TESTS=1 node tools/qa-pilot-write-gate.mjs",
    result: "passed",
    operatorTokenSource: reportTokenSource,
    writeEvidence: {
      formCaptureIntents: expectedFormCaptureIntents,
      eventWrites: expectedEventWrites,
      inboxDeliveryRequired: true,
      operatorReportVerified: true,
      postWriteReconciliation: true
    },
    coverage: {
      domainReadiness: true,
      providerReadiness: true,
      liveSite: true,
      liveAssets: true,
      liveMediaSources: true,
      liveBrowserFlows: true,
      liveOperatorReport: true,
      releaseReadinessChecked: true
    },
    passedChecks: passed,
    knownPublicLaunchBlockersAllowed: [
      "privacy_review",
      "terms_review"
    ],
    notes: "No-secret receipt for the current live pilot write gate, including the noindex pilot feedback capture path and protected activation-readiness reporting. Full public release still requires Privacy and Terms approval."
  };

  await writeFile("data/lux-pilot-write-evidence.json", `${JSON.stringify(evidence, null, 2)}\n`);
  await refreshPilotEvidenceState(evidence);
  await refreshPilotEvidenceDocs(evidence);
  console.log(`Updated no-secret pilot write evidence for run ${qaRunId}.`);
}

async function runCheck(check) {
  const env = { ...process.env, ...check.env };
  if (check.needsReportToken && reportToken) env.LUX_REPORT_TOKEN = reportToken;
  const attempts = (check.retries || 0) + 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const { stdout, stderr } = await execFileAsync(node, [check.script], {
        env,
        timeout: check.timeoutMs || 180000,
        maxBuffer: 1024 * 1024 * 14
      });
      const output = `${stdout || ""}${stderr || ""}`;
      if (check.allowLegalOnly) {
        const unexpected = releaseBlockers(output).filter((blocker) => !isAllowedReleaseReadinessBlocker(blocker, check));
        if (unexpected.length) {
          failures.push({
            label: check.label,
            output: `Release readiness found non-legal blocker(s):\n${unexpected.map((item) => `- ${item}`).join("\n")}`
          });
          console.log(`FAIL ${check.label}`);
          return;
        }
      }
      passed.push(check.label);
      console.log(`PASS ${check.label}${attempt > 1 ? ` (attempt ${attempt})` : ""}`);
      const summary = compactOutput(output);
      if (summary) console.log(summary);
      return;
    } catch (error) {
      const output = `${error.stdout || ""}${error.stderr || ""}`;
      if (check.allowPreRefreshEvidence && isAllowedPreRefreshEvidenceOutput(output)) {
        passed.push(check.label);
        console.log(`PASS ${check.label} (pre-refresh evidence mismatch allowed during write test)`);
        const summary = compactOutput(output);
        if (summary) console.log(summary);
        return;
      }
      if (attempt < attempts) {
        console.log(`WARN ${check.label} failed on attempt ${attempt}; retrying once.`);
        continue;
      }
      failures.push({ label: check.label, output: compactOutput(output) || error.message });
      console.log(`FAIL ${check.label}`);
    }
  }
}

console.log("Lux Veritas pilot write gate");
console.log(`Live URL: ${baseUrl}`);
console.log(`Write tests: ${writeTests ? "enabled" : dryRun ? "dry-run only" : "disabled"}`);
console.log(`QA run ID: ${qaRunId}`);
console.log(`Operator token source: ${reportTokenSource}`);

for (const check of checks) {
  await runCheck(check);
}

if (!writeTests && !dryRun) {
  failures.push({
    label: "Pilot Write Tests",
    output: "Set LUX_PILOT_WRITE_TESTS=1 to send live QA submissions/events and prove the pilot capture/reporting loop. Use LUX_PILOT_WRITE_DRY_RUN=1 only for a non-writing rehearsal."
  });
  console.log("FAIL Pilot Write Tests");
}

if (dryRun) {
  console.log("");
  console.log("Dry-run note: this did not send live submissions or event writes, so it is not pilot-write acceptance evidence.");
}

if (failures.length) {
  console.log("");
  console.log(`Pilot write gate found ${failures.length} blocking check(s):`);
  for (const failure of failures) {
    console.log(`\n[${failure.label}]`);
    console.log(failure.output);
  }
  process.exit(1);
}

if (writeTests) {
  await writePilotEvidence();
}

console.log("");
console.log(`Pilot write gate checked: ${passed.length} passed, ${failures.length} blocking check(s).`);
console.log("Known public-release blockers still require separate legal approval: Privacy and Terms.");
