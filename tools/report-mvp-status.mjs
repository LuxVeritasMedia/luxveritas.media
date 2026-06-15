import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const jsonMode = process.env.LUX_MVP_STATUS_JSON === "1";
const strict = process.env.LUX_MVP_STATUS_STRICT === "1";

async function run(command, args = []) {
  try {
    const { stdout } = await execFileAsync(command, args, {
      timeout: 12000,
      maxBuffer: 1024 * 1024 * 2
    });
    return { ok: true, value: stdout.trim() };
  } catch (error) {
    return {
      ok: false,
      value: String(error.stdout || "").trim(),
      error: String(error.stderr || error.message || "").trim()
    };
  }
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "luxveritas-mvp-status" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { ok: true, value: await response.json() };
  } catch (error) {
    const curl = await run("curl", ["-fsS", "-H", "Accept: application/json", url]);
    if (!curl.ok) return { ok: false, error: error?.message || curl.error || "unavailable" };
    try {
      return { ok: true, value: JSON.parse(curl.value) };
    } catch (parseError) {
      return { ok: false, error: parseError?.message || "invalid JSON" };
    }
  }
}

function legalStatus(legalReview, id) {
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

function summarizeMedia(mediaManifest) {
  const items = Array.isArray(mediaManifest.items) ? mediaManifest.items : [];
  const byType = {};
  for (const item of items) {
    const type = item.sourceType || "unknown";
    byType[type] = (byType[type] || 0) + 1;
  }
  const sourceRequiredTypes = new Set(["audio", "video", "stream"]);
  const missingRequiredSources = items
    .filter((item) => sourceRequiredTypes.has(item.sourceType) && !/^https:\/\//i.test(item.sourceUrl || ""))
    .map((item) => item.id || item.title || "unknown");
  return {
    version: mediaManifest.version || "",
    itemCount: items.length,
    byType,
    missingRequiredSources
  };
}

function line(label, value) {
  console.log(`${label}: ${value}`);
}

const [
  buildManifestRaw,
  launchRaw,
  legalRaw,
  mediaRaw,
  publicTermsRaw,
  todo,
  branch,
  localSha,
  remoteSha,
  statusShort,
  liveManifest
] = await Promise.all([
  readFile("data/lux-build-manifest.json", "utf8"),
  readFile("data/lux-launch-readiness.json", "utf8"),
  readFile("data/lux-legal-review.json", "utf8"),
  readFile("data/lux-media-manifest.json", "utf8"),
  readFile("data/lux-public-terms.json", "utf8"),
  readFile("TODO.md", "utf8"),
  run("git", ["branch", "--show-current"]),
  run("git", ["rev-parse", "HEAD"]),
  run("git", ["rev-parse", "origin/main"]),
  run("git", ["status", "--short"]),
  fetchJson(`${baseUrl}/data/lux-build-manifest.json`)
]);

const buildManifest = JSON.parse(buildManifestRaw);
const launch = JSON.parse(launchRaw);
const legalReview = JSON.parse(legalRaw);
const mediaManifest = JSON.parse(mediaRaw);
const publicTerms = JSON.parse(publicTermsRaw);
const gates = Array.isArray(launch.gates) ? launch.gates : [];
const readyGates = gates.filter((gate) => gate.status === "ready");
const blockedGates = gates.filter((gate) => gate.requiredForPublicLaunch === true && gate.status === "blocked");
const phaseLine = todo.split("\n").find((item) => item.startsWith("Current phase:")) || "";
const media = summarizeMedia(mediaManifest);
const liveVersion = liveManifest.ok
  ? liveManifest.value.assetVersion || liveManifest.value.version || ""
  : "";
const localVersion = buildManifest.assetVersion || buildManifest.version || "";
const repoClean = statusShort.ok && !statusShort.value;
const repoAligned = localSha.ok && remoteSha.ok && localSha.value === remoteSha.value;
const operatorIssues = [
  repoClean ? null : "Working tree has local changes.",
  repoAligned ? null : "Local HEAD does not match origin/main.",
  liveManifest.ok ? null : `Live build manifest is unreadable: ${liveManifest.error || "unavailable"}.`,
  liveManifest.ok && liveVersion !== localVersion ? `Live asset version ${liveVersion || "missing"} does not match local ${localVersion || "missing"}.` : null,
  media.missingRequiredSources.length ? `Missing required media sources: ${media.missingRequiredSources.join(", ")}.` : null
].filter(Boolean);

const report = {
  generatedAt: new Date().toISOString(),
  project: "LuxVeritas.media",
  liveUrl: baseUrl,
  phase: phaseLine.replace(/^Current phase:\s*/, ""),
  repo: {
    branch: branch.ok ? branch.value : "unknown",
    localSha: localSha.ok ? localSha.value : "",
    originSha: remoteSha.ok ? remoteSha.value : "",
    clean: repoClean,
    alignedWithOrigin: repoAligned
  },
  build: {
    localAssetVersion: localVersion,
    liveAssetVersion: liveVersion,
    liveManifestReadable: liveManifest.ok,
    liveManifestError: liveManifest.ok ? "" : liveManifest.error || "unavailable"
  },
  legal: {
    publicTermsVersion: publicTerms.version || "",
    privacy: legalStatus(legalReview, "privacy"),
    terms: legalStatus(legalReview, "terms")
  },
  media,
  launchGates: {
    ready: readyGates.map((gate) => gate.id),
    blocked: blockedGates.map((gate) => ({
      id: gate.id,
      label: gate.label,
      nextAction: gate.nextAction,
      verification: gate.verification
    }))
  },
  operatorIssues,
  decision: blockedGates.length
    ? "pilot-ready-with-public-launch-blockers"
    : operatorIssues.length
      ? "operator-attention-needed-before-final-gate"
    : "ready-for-final-release-gate"
};

if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("Lux Veritas MVP status report");
  line("Generated", report.generatedAt);
  line("Phase", report.phase || "unknown");
  line("Decision", report.decision);
  line("Repo", `${report.repo.branch}@${report.repo.localSha.slice(0, 7) || "unknown"} ${report.repo.clean ? "clean" : "dirty"} ${report.repo.alignedWithOrigin ? "aligned" : "not aligned"}`);
  line("Live", `${report.liveUrl} asset=${report.build.liveAssetVersion || "unreadable"}`);
  line("Local asset", report.build.localAssetVersion || "missing");
  line("Media", `${media.itemCount} item(s), missing required sources: ${media.missingRequiredSources.length ? media.missingRequiredSources.join(", ") : "none"}`);
  line("Legal", `privacy=${report.legal.privacy.status}, terms=${report.legal.terms.status}`);
  line("Launch gates", `${readyGates.length} ready, ${blockedGates.length} blocked`);
  if (operatorIssues.length) {
    console.log("");
    console.log("Operator attention:");
    for (const item of operatorIssues) console.log(`- ${item}`);
  }
  if (blockedGates.length) {
    console.log("");
    console.log("Blocked public-launch gates:");
    for (const gate of report.launchGates.blocked) {
      console.log(`- ${gate.label}: ${gate.nextAction}`);
    }
  }
  console.log("");
  console.log("Next commands:");
  console.log("- node tools/qa-operator-environment.mjs");
  console.log("- node tools/qa-deploy-status.mjs");
  console.log("- node tools/qa-release-readiness.mjs");
  console.log("- LUX_FINAL_WRITE_TESTS=1 node tools/qa-final-release-gate.mjs");
}

if (strict && (blockedGates.length || operatorIssues.length)) process.exit(1);
