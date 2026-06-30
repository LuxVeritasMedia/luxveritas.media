import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pilotEvidenceFreshness, pilotEvidenceMaxAgeHours } from "./lib/pilot-evidence-freshness.mjs";

const execFileAsync = promisify(execFile);
const format = process.env.LUX_EVIDENCE_FORMAT === "json" ? "json" : "markdown";
const outPath = process.env.LUX_EVIDENCE_OUT || "";
const includeLive = process.env.LUX_EVIDENCE_LIVE === "1";
const node = process.execPath;

function secretShape(value) {
  return /\bre_[A-Za-z0-9_-]{16,}\b|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}/.test(value);
}

async function run(script, env = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(node, [script], {
      env: { ...process.env, ...env },
      timeout: 90000,
      maxBuffer: 1024 * 1024 * 8
    });
    return { ok: true, output: `${stdout || ""}${stderr || ""}`.trim() };
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout || ""}${error.stderr || ""}`.trim() || error.message
    };
  }
}

function legalItem(legalReview, id) {
  const item = Array.isArray(legalReview.items)
    ? legalReview.items.find((entry) => entry.id === id)
    : null;
  return {
    id,
    status: item?.status || "missing",
    reviewedAt: item?.reviewedAt || "",
    reviewedBy: item?.reviewedBy || ""
  };
}

function summarizeOutput(output) {
  return output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => (
      line
      && /^(PASS|WARN|BLOCK|FAIL|- |Lux Veritas|Decision|Repo|Live|Local asset|Media|Legal|Launch gates|Closeout|Deploy status checked|MVP preflight checked|Preview helper QA checked|Release readiness checked)/i.test(line)
    ))
    .slice(-80);
}

function topEntries(source = {}, limit = 8) {
  return Object.entries(source || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

const [
  buildManifestRaw,
  launchRaw,
  closeoutRaw,
  legalRaw,
  mediaRaw,
  pilotWriteRaw,
  pilotBugRegisterRaw,
  actionInventoryRaw,
  phaseStatusRaw,
  termsRaw,
  pilotMatrixRaw,
  todo,
  mvpStatus,
  previewHelper,
  deployStatus,
  preflight,
  openApprovalsResult
] = await Promise.all([
  readFile("data/lux-build-manifest.json", "utf8"),
  readFile("data/lux-launch-readiness.json", "utf8"),
  readFile("data/lux-launch-closeout.json", "utf8"),
  readFile("data/lux-legal-review.json", "utf8"),
  readFile("data/lux-media-manifest.json", "utf8"),
  readFile("data/lux-pilot-write-evidence.json", "utf8"),
  readFile("data/lux-pilot-bug-register.json", "utf8"),
  readFile("data/lux-action-inventory.json", "utf8"),
  readFile("data/lux-phase-status.json", "utf8"),
  readFile("data/lux-public-terms.json", "utf8"),
  readFile("data/lux-pilot-test-matrix.json", "utf8"),
  readFile("TODO.md", "utf8"),
  run("tools/report-mvp-status.mjs", includeLive ? {} : { LUX_LIVE_URL: "https://luxveritas.media" }),
  run("tools/qa-preview-helper.mjs"),
  includeLive ? run("tools/qa-deploy-status.mjs") : Promise.resolve({ ok: false, output: "Skipped. Set LUX_EVIDENCE_LIVE=1 to include live deploy-status output." }),
  includeLive ? run("tools/qa-mvp-preflight.mjs") : Promise.resolve({ ok: false, output: "Skipped. Set LUX_EVIDENCE_LIVE=1 to include preflight output." }),
  run("tools/report-open-approvals.mjs", { LUX_OPEN_APPROVALS_JSON: "1" })
]);

const buildManifest = JSON.parse(buildManifestRaw);
const launch = JSON.parse(launchRaw);
const closeout = JSON.parse(closeoutRaw);
const legalReview = JSON.parse(legalRaw);
const mediaManifest = JSON.parse(mediaRaw);
const pilotWriteEvidence = JSON.parse(pilotWriteRaw);
const pilotBugRegister = JSON.parse(pilotBugRegisterRaw);
const actionInventory = JSON.parse(actionInventoryRaw);
const phaseStatus = JSON.parse(phaseStatusRaw);
const publicTerms = JSON.parse(termsRaw);
const pilotMatrix = JSON.parse(pilotMatrixRaw);
let openApprovals = null;
let openApprovalsOk = openApprovalsResult.ok;
try {
  openApprovals = JSON.parse(openApprovalsResult.output || "{}");
} catch {
  openApprovalsOk = false;
}
const pilotFreshness = pilotEvidenceFreshness(pilotWriteEvidence.updatedAt, {
  maxAgeHours: pilotEvidenceMaxAgeHours()
});
const gates = Array.isArray(launch.gates) ? launch.gates : [];
const closeoutItems = Array.isArray(closeout.items) ? closeout.items : [];
const readyGates = gates.filter((gate) => gate.status === "ready");
const blockedGates = gates.filter((gate) => gate.requiredForPublicLaunch === true && gate.status === "blocked");
const closeoutByStatus = closeoutItems.reduce((counts, item) => {
  const status = item.status || "unknown";
  counts[status] = (counts[status] || 0) + 1;
  return counts;
}, {});
const currentPhase = phaseStatus.currentPhase || {};
const phase = currentPhase.summary
  || (todo.split("\n").find((line) => line.startsWith("Current phase:")) || "").replace(/^Current phase:\s*/, "");
const mediaItems = Array.isArray(mediaManifest.items) ? mediaManifest.items : [];
const sourceTypes = [...new Set(mediaItems.map((item) => item.sourceType || "unknown"))].sort();
const evidence = {
  schemaVersion: "luxveritas.launch_evidence.v1",
  generatedAt: new Date().toISOString(),
  project: "LuxVeritas.media",
  phase,
  phaseStatusVersion: phaseStatus.version || "",
  currentPhase: {
    id: currentPhase.id || "",
    number: currentPhase.number || null,
    label: currentPhase.label || "",
    status: currentPhase.status || ""
  },
  liveUrl: "https://luxveritas.media",
  githubRepo: "LuxVeritasMedia/luxveritas.media",
  firebaseProject: "lux-veritas-media",
  assetVersion: buildManifest.assetVersion || buildManifest.version || "",
  publicTermsVersion: publicTerms.version || "",
  media: {
    version: mediaManifest.version || "",
    itemCount: mediaItems.length,
    sourceTypes
  },
  actionInventory: {
    version: actionInventory.version || "",
    buildAssetVersion: actionInventory.buildAssetVersion || "",
    routeCount: actionInventory.routeCount || 0,
    actionCount: actionInventory.actionCount || 0,
    topActionTypes: topEntries(actionInventory.summary?.byType),
    topReportingEvents: topEntries(actionInventory.summary?.byReportingEvent),
    topReportingChannels: topEntries(actionInventory.summary?.byReportingChannel),
    reportingStatus: actionInventory.summary?.byReportingStatus || {},
    topRouteSurfaces: topEntries(actionInventory.summary?.byRoute)
  },
  pilotTestMatrix: {
    version: pilotMatrix.version || "",
    status: pilotMatrix.status || "",
    scenarioCount: Array.isArray(pilotMatrix.scenarios) ? pilotMatrix.scenarios.length : 0,
    requiredCoverage: Array.isArray(pilotMatrix.requiredCoverage) ? pilotMatrix.requiredCoverage : [],
    scenarios: Array.isArray(pilotMatrix.scenarios)
      ? pilotMatrix.scenarios.map((scenario) => ({
        id: scenario.id,
        label: scenario.label,
        route: scenario.route,
        coverage: scenario.coverage || [],
        qaCommands: scenario.qaCommands || []
      }))
      : []
  },
  pilotWriteEvidence: {
    schemaVersion: pilotWriteEvidence.schemaVersion || "",
    updatedAt: pilotWriteEvidence.updatedAt || "",
    qaRunId: pilotWriteEvidence.qaRunId || "",
    assetVersion: pilotWriteEvidence.assetVersion || "",
    result: pilotWriteEvidence.result || "",
    command: pilotWriteEvidence.command || "",
    freshness: pilotFreshness,
    formCaptureIntents: pilotWriteEvidence.writeEvidence?.formCaptureIntents || 0,
    eventWrites: pilotWriteEvidence.writeEvidence?.eventWrites || 0,
    inboxDeliveryRequired: pilotWriteEvidence.writeEvidence?.inboxDeliveryRequired === true,
    operatorReportVerified: pilotWriteEvidence.writeEvidence?.operatorReportVerified === true,
    postWriteReconciliation: pilotWriteEvidence.writeEvidence?.postWriteReconciliation === true,
    passedChecks: Array.isArray(pilotWriteEvidence.passedChecks) ? pilotWriteEvidence.passedChecks : []
  },
  pilotBugRegister: {
    schemaVersion: pilotBugRegister.schemaVersion || "",
    version: pilotBugRegister.version || "",
    updatedAt: pilotBugRegister.updatedAt || "",
    status: pilotBugRegister.status || "",
    decision: pilotBugRegister.decision || "",
    summary: pilotBugRegister.summary || {},
    evidence: {
      assetVersion: pilotBugRegister.evidence?.assetVersion || "",
      pilotWriteQaRunId: pilotBugRegister.evidence?.pilotWriteQaRunId || "",
      pilotFeedbackRoute: pilotBugRegister.evidence?.pilotFeedbackRoute || "",
      latestDeployWorkflow: pilotBugRegister.evidence?.latestDeployWorkflow || "",
      latestDeployRun: pilotBugRegister.evidence?.latestDeployRun || ""
    },
    coverageEvidence: Array.isArray(pilotBugRegister.coverageEvidence)
      ? pilotBugRegister.coverageEvidence.map((item) => ({
        coverage: item.coverage,
        status: item.status,
        evidence: item.evidence
      }))
      : [],
    checks: Array.isArray(pilotBugRegister.checks)
      ? pilotBugRegister.checks.map((item) => ({
        id: item.id,
        status: item.status,
        evidence: item.evidence
      }))
      : [],
    openItems: Array.isArray(pilotBugRegister.items)
      ? pilotBugRegister.items
        .filter((item) => !["fixed", "closed", "resolved"].includes(item.status || ""))
        .map((item) => ({
          id: item.id,
          severity: item.severity,
          status: item.status,
          route: item.route || ""
        }))
      : []
  },
  legal: {
    privacy: legalItem(legalReview, "privacy"),
    terms: legalItem(legalReview, "terms")
  },
  launchGates: {
    ready: readyGates.map((gate) => ({ id: gate.id, label: gate.label })),
    blocked: blockedGates.map((gate) => ({
      id: gate.id,
      label: gate.label,
      nextAction: gate.nextAction,
      verification: gate.verification
    }))
  },
  openApprovals: {
    ok: openApprovalsOk,
    decision: openApprovals?.decision || "unavailable",
    counts: openApprovals?.counts || {},
    approvals: Array.isArray(openApprovals?.approvals)
      ? openApprovals.approvals.map((item) => ({
        id: item.id,
        label: item.label,
        category: item.category,
        status: item.status,
        blocksPublicLaunch: item.blocksPublicLaunch === true,
        owner: item.owner,
        source: item.source,
        nextAction: item.nextAction,
        verification: item.verification
      }))
      : [],
    error: openApprovalsOk ? "" : openApprovalsResult.output || "open approvals report unavailable"
  },
  closeout: {
    updatedAt: closeout.updatedAt || "",
    byStatus: closeoutByStatus,
    items: closeoutItems.map((item) => ({
      id: item.id,
      gateId: item.gateId,
      label: item.label,
      status: item.status,
      owner: item.owner,
      evidenceReference: item.evidenceReference || "",
      closedAt: item.closedAt || "",
      closedBy: item.closedBy || ""
    }))
  },
  commandSummaries: {
    mvpStatus: { ok: mvpStatus.ok, lines: summarizeOutput(mvpStatus.output) },
    previewHelper: { ok: previewHelper.ok, lines: summarizeOutput(previewHelper.output) },
    deployStatus: { ok: deployStatus.ok, lines: summarizeOutput(deployStatus.output) },
    preflight: { ok: preflight.ok, lines: summarizeOutput(preflight.output) }
  },
  decision: blockedGates.length
    ? "pilot-ready-with-public-launch-blockers"
    : "ready-for-final-release-gate"
};

let rendered = "";
if (format === "json") {
  rendered = `${JSON.stringify(evidence, null, 2)}\n`;
} else {
  rendered = `# Lux Veritas Launch Evidence

Generated: ${evidence.generatedAt}

Project: ${evidence.project}
Phase: ${evidence.phase || "unknown"}
Decision: ${evidence.decision}
Live URL: ${evidence.liveUrl}
GitHub repo: ${evidence.githubRepo}
Firebase project: ${evidence.firebaseProject}
Asset version: ${evidence.assetVersion}
Public terms version: ${evidence.publicTermsVersion}

## Media

- Manifest version: ${evidence.media.version}
- Items: ${evidence.media.itemCount}
- Source types: ${evidence.media.sourceTypes.join(", ") || "none"}

## Action Coverage

- Inventory version: ${evidence.actionInventory.version}
- Build asset version: ${evidence.actionInventory.buildAssetVersion}
- Actions: ${evidence.actionInventory.actionCount}
- Route surfaces: ${evidence.actionInventory.routeCount}
- Action types: ${evidence.actionInventory.topActionTypes.map((item) => `${item.label} ${item.count}`).join(", ") || "none"}
- Reporting events: ${evidence.actionInventory.topReportingEvents.map((item) => `${item.label} ${item.count}`).join(", ") || "none"}
- Reporting channels: ${evidence.actionInventory.topReportingChannels.map((item) => `${item.label} ${item.count}`).join(", ") || "none"}
- Reporting status: ${Object.entries(evidence.actionInventory.reportingStatus).map(([label, count]) => `${label} ${count}`).join(", ") || "none"}
- Top route surfaces: ${evidence.actionInventory.topRouteSurfaces.map((item) => `${item.label} ${item.count}`).join(", ") || "none"}

## Pilot Test Matrix

- Matrix version: ${evidence.pilotTestMatrix.version}
- Status: ${evidence.pilotTestMatrix.status}
- Scenarios: ${evidence.pilotTestMatrix.scenarioCount}
- Coverage: ${evidence.pilotTestMatrix.requiredCoverage.join(", ") || "none"}

${evidence.pilotTestMatrix.scenarios.map((scenario) => `- ${scenario.label} (${scenario.id}) - ${scenario.route} - ${scenario.coverage.join(", ")}`).join("\n") || "- none"}

## Pilot Write Evidence

- Updated: ${evidence.pilotWriteEvidence.updatedAt || "unknown"}
- QA run ID: ${evidence.pilotWriteEvidence.qaRunId || "unknown"}
- Asset version: ${evidence.pilotWriteEvidence.assetVersion || "unknown"}
- Result: ${evidence.pilotWriteEvidence.result || "unknown"}
- Freshness: ${evidence.pilotWriteEvidence.freshness.status} (${evidence.pilotWriteEvidence.freshness.message})
- Command: ${evidence.pilotWriteEvidence.command || "unknown"}
- Form capture intents: ${evidence.pilotWriteEvidence.formCaptureIntents}
- Event writes: ${evidence.pilotWriteEvidence.eventWrites}
- Inbox delivery required: ${evidence.pilotWriteEvidence.inboxDeliveryRequired ? "yes" : "no"}
- Operator report verified: ${evidence.pilotWriteEvidence.operatorReportVerified ? "yes" : "no"}
- Post-write reconciliation: ${evidence.pilotWriteEvidence.postWriteReconciliation ? "yes" : "no"}
- Passed checks: ${evidence.pilotWriteEvidence.passedChecks.join(", ") || "none"}

## Pilot Bug Register

- Version: ${evidence.pilotBugRegister.version || "unknown"}
- Updated: ${evidence.pilotBugRegister.updatedAt || "unknown"}
- Status: ${evidence.pilotBugRegister.status || "unknown"}
- Decision: ${evidence.pilotBugRegister.decision || "unknown"}
- Open blocking bugs: ${evidence.pilotBugRegister.summary.openBlockingBugs ?? "unknown"}
- Open high bugs: ${evidence.pilotBugRegister.summary.openHighBugs ?? "unknown"}
- Known issues: ${evidence.pilotBugRegister.summary.knownIssues ?? "unknown"}
- Pilot feedback route: ${evidence.pilotBugRegister.evidence.pilotFeedbackRoute || "unknown"}
- Evidence run: ${evidence.pilotBugRegister.evidence.pilotWriteQaRunId || "unknown"}
- Coverage: ${evidence.pilotBugRegister.coverageEvidence.map((item) => `${item.coverage} ${item.status}`).join(", ") || "none"}
- Checks: ${evidence.pilotBugRegister.checks.map((item) => `${item.id} ${item.status}`).join(", ") || "none"}
- Open items: ${evidence.pilotBugRegister.openItems.length ? evidence.pilotBugRegister.openItems.map((item) => `${item.id} ${item.severity} ${item.status}`).join(", ") : "none"}

## Legal

- Privacy: ${evidence.legal.privacy.status}${evidence.legal.privacy.reviewedBy ? ` by ${evidence.legal.privacy.reviewedBy}` : ""}
- Terms: ${evidence.legal.terms.status}${evidence.legal.terms.reviewedBy ? ` by ${evidence.legal.terms.reviewedBy}` : ""}

## Launch Gates

Ready:
${evidence.launchGates.ready.map((gate) => `- ${gate.label} (${gate.id})`).join("\n") || "- none"}

Blocked:
${evidence.launchGates.blocked.map((gate) => `- ${gate.label} (${gate.id}): ${gate.nextAction}`).join("\n") || "- none"}

## Open Approvals

- Decision: ${evidence.openApprovals.decision}
- Open/conditional approvals: ${evidence.openApprovals.counts.totalOpenOrConditional ?? "unknown"}
- Public launch blockers: ${evidence.openApprovals.counts.publicLaunchBlockers ?? "unknown"}

${evidence.openApprovals.approvals.map((item) => `- ${item.label} (${item.id}) [${item.category}]: ${item.status}${item.blocksPublicLaunch ? " - blocks public launch" : ""}`).join("\n") || "- none"}

## Closeout

Updated: ${evidence.closeout.updatedAt || "unknown"}
Status: ${Object.entries(evidence.closeout.byStatus).map(([status, count]) => `${status} ${count}`).join(", ") || "none"}

${evidence.closeout.items.map((item) => `- ${item.label} (${item.id}): ${item.status}${item.evidenceReference ? ` - ${item.evidenceReference}` : ""}`).join("\n") || "- none"}

## Command Summaries

### MVP Status

${evidence.commandSummaries.mvpStatus.lines.map((line) => `- ${line}`).join("\n") || "- no summary"}

### Preview Helper

${evidence.commandSummaries.previewHelper.lines.map((line) => `- ${line}`).join("\n") || "- no summary"}

### Deploy Status

${evidence.commandSummaries.deployStatus.lines.map((line) => `- ${line}`).join("\n") || "- no summary"}

### MVP Preflight

${evidence.commandSummaries.preflight.lines.map((line) => `- ${line}`).join("\n") || "- no summary"}
`;
}

if (secretShape(rendered)) {
  console.error("Launch evidence export refused: output appears to contain secret-shaped data.");
  process.exit(1);
}

if (outPath) {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, rendered, "utf8");
  console.log(`Launch evidence written to ${outPath}`);
} else {
  process.stdout.write(rendered);
}
