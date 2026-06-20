import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const format = process.env.LUX_EVIDENCE_FORMAT === "json" ? "json" : "markdown";
const outPath = process.env.LUX_EVIDENCE_OUT || "";
const includeLive = process.env.LUX_EVIDENCE_LIVE === "1";
const node = process.execPath;

function secretShape(value) {
  return /re_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}/.test(value);
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
      && /^(PASS|WARN|BLOCK|FAIL|- |Lux Veritas|Decision|Repo|Live|Local asset|Media|Legal|Launch gates|Closeout|Deploy status checked|MVP preflight checked|Release readiness checked)/i.test(line)
    ))
    .slice(-80);
}

const [
  buildManifestRaw,
  launchRaw,
  closeoutRaw,
  legalRaw,
  mediaRaw,
  phaseStatusRaw,
  termsRaw,
  pilotMatrixRaw,
  todo,
  mvpStatus,
  deployStatus,
  preflight
] = await Promise.all([
  readFile("data/lux-build-manifest.json", "utf8"),
  readFile("data/lux-launch-readiness.json", "utf8"),
  readFile("data/lux-launch-closeout.json", "utf8"),
  readFile("data/lux-legal-review.json", "utf8"),
  readFile("data/lux-media-manifest.json", "utf8"),
  readFile("data/lux-phase-status.json", "utf8"),
  readFile("data/lux-public-terms.json", "utf8"),
  readFile("data/lux-pilot-test-matrix.json", "utf8"),
  readFile("TODO.md", "utf8"),
  run("tools/report-mvp-status.mjs", includeLive ? {} : { LUX_LIVE_URL: "https://luxveritas.media" }),
  includeLive ? run("tools/qa-deploy-status.mjs") : Promise.resolve({ ok: false, output: "Skipped. Set LUX_EVIDENCE_LIVE=1 to include live deploy-status output." }),
  includeLive ? run("tools/qa-mvp-preflight.mjs") : Promise.resolve({ ok: false, output: "Skipped. Set LUX_EVIDENCE_LIVE=1 to include preflight output." })
]);

const buildManifest = JSON.parse(buildManifestRaw);
const launch = JSON.parse(launchRaw);
const closeout = JSON.parse(closeoutRaw);
const legalReview = JSON.parse(legalRaw);
const mediaManifest = JSON.parse(mediaRaw);
const phaseStatus = JSON.parse(phaseStatusRaw);
const publicTerms = JSON.parse(termsRaw);
const pilotMatrix = JSON.parse(pilotMatrixRaw);
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

## Pilot Test Matrix

- Matrix version: ${evidence.pilotTestMatrix.version}
- Status: ${evidence.pilotTestMatrix.status}
- Scenarios: ${evidence.pilotTestMatrix.scenarioCount}
- Coverage: ${evidence.pilotTestMatrix.requiredCoverage.join(", ") || "none"}

${evidence.pilotTestMatrix.scenarios.map((scenario) => `- ${scenario.label} (${scenario.id}) - ${scenario.route} - ${scenario.coverage.join(", ")}`).join("\n") || "- none"}

## Legal

- Privacy: ${evidence.legal.privacy.status}${evidence.legal.privacy.reviewedBy ? ` by ${evidence.legal.privacy.reviewedBy}` : ""}
- Terms: ${evidence.legal.terms.status}${evidence.legal.terms.reviewedBy ? ` by ${evidence.legal.terms.reviewedBy}` : ""}

## Launch Gates

Ready:
${evidence.launchGates.ready.map((gate) => `- ${gate.label} (${gate.id})`).join("\n") || "- none"}

Blocked:
${evidence.launchGates.blocked.map((gate) => `- ${gate.label} (${gate.id}): ${gate.nextAction}`).join("\n") || "- none"}

## Closeout

Updated: ${evidence.closeout.updatedAt || "unknown"}
Status: ${Object.entries(evidence.closeout.byStatus).map(([status, count]) => `${status} ${count}`).join(", ") || "none"}

${evidence.closeout.items.map((item) => `- ${item.label} (${item.id}): ${item.status}${item.evidenceReference ? ` - ${item.evidenceReference}` : ""}`).join("\n") || "- none"}

## Command Summaries

### MVP Status

${evidence.commandSummaries.mvpStatus.lines.map((line) => `- ${line}`).join("\n") || "- no summary"}

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
