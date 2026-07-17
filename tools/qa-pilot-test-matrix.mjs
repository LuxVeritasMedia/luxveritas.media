import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const issues = [];
const root = "dist";
const requiredCoverage = new Set([
  "public_capture",
  "media_player",
  "fan_reaction",
  "pilot_feedback_triage",
  "portal_capture",
  "operator_reporting",
  "launch_gates",
  "private_workflow_readiness"
]);
const allowedFormTypes = new Set([
  "request",
  "submission",
  "press",
  "event",
  "codex",
  "fan",
  "investor",
  "licensing",
  "creator",
  "feedback",
  "portal_signin"
]);
const allowedMediaActions = new Set(["play", "watch", "radio"]);
const requiredScenarioIds = new Set([
  "home_access_request",
  "membership_waitlist",
  "creator_submission",
  "music_player",
  "spmvp_release_hub",
  "fan_reactions",
  "pilot_feedback_triage",
  "event_access",
  "portal_signin_capture",
  "operator_reporting",
  "legal_launch_gate"
]);
const secretPatterns = [
  /\bre_[A-Za-z0-9_-]{8,}\b/,
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\bAIza[A-Za-z0-9_-]{16,}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /\bBearer\s+[A-Za-z0-9._-]{16,}\b/i
];

function issue(message) {
  issues.push(message);
}

function routeFile(route) {
  const clean = String(route || "").split("#")[0].split("?")[0];
  if (!clean.startsWith("/")) return "";
  return clean === "/" ? "index.html" : clean.slice(1);
}

function selectorPresent(html, selector) {
  if (!selector) return false;
  if (selector === "main") return /<main\b/i.test(html);
  const attrOnly = selector.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
  if (attrOnly) {
    const [, attr, value] = attrOnly;
    const pattern = value
      ? new RegExp(`${attr}\\s*=\\s*["']${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i")
      : new RegExp(`${attr}(\\s|=|>)`, "i");
    return pattern.test(html);
  }
  const tagAttr = selector.match(/^([a-z0-9-]+)\[([^=\]]+)=["']([^"']+)["']\]$/i);
  if (tagAttr) {
    const [, tag, attr, value] = tagAttr;
    const tagPattern = new RegExp(`<${tag}\\b[^>]*${attr}\\s*=\\s*["']${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i");
    return tagPattern.test(html);
  }
  return html.includes(selector.replace(/\\/g, ""));
}

function secretShape(value) {
  return secretPatterns.some((pattern) => pattern.test(value));
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const raw = await readFile("data/lux-pilot-test-matrix.json", "utf8");
if (secretShape(raw)) issue("pilot test matrix appears to contain secret-shaped data");

let matrix = null;
try {
  matrix = JSON.parse(raw);
} catch (error) {
  issue(`pilot test matrix JSON is invalid: ${error?.message || String(error)}`);
}

if (matrix) {
  if (matrix.schemaVersion !== "luxveritas.pilot_test_matrix.v1") issue("pilot test matrix schemaVersion mismatch");
  if (!matrix.version) issue("pilot test matrix version missing");
  if (matrix.status !== "active") issue("pilot test matrix status must be active");
  if (!String(matrix.acceptanceRule || "").includes("Privacy and Terms")) {
    issue("pilot test matrix acceptance rule must preserve legal approval blockers");
  }

  const declaredCoverage = new Set(Array.isArray(matrix.requiredCoverage) ? matrix.requiredCoverage : []);
  for (const item of requiredCoverage) {
    if (!declaredCoverage.has(item)) issue(`pilot test matrix missing required coverage ${item}`);
  }

  const scenarios = Array.isArray(matrix.scenarios) ? matrix.scenarios : [];
  if (scenarios.length < requiredScenarioIds.size) issue("pilot test matrix has too few scenarios");
  const ids = new Set();
  const covered = new Set();
  const appJs = await readFile("app.js", "utf8");
  const reportingHtml = await readFile("portal/reporting.html", "utf8");

  for (const scenario of scenarios) {
    if (!scenario || typeof scenario !== "object") {
      issue("pilot test matrix scenario is not an object");
      continue;
    }
    if (!scenario.id || ids.has(scenario.id)) issue(`pilot test matrix scenario has missing or duplicate id ${scenario.id || "missing"}`);
    ids.add(scenario.id);
    if (!scenario.label) issue(`${scenario.id}: label missing`);
    if (!scenario.route) issue(`${scenario.id}: route missing`);
    if (!scenario.selector) issue(`${scenario.id}: selector missing`);
    if (!Array.isArray(scenario.coverage) || !scenario.coverage.length) issue(`${scenario.id}: coverage missing`);
    for (const coverage of scenario.coverage || []) covered.add(coverage);
    if (!Array.isArray(scenario.evidence) || scenario.evidence.length < 2) issue(`${scenario.id}: evidence must include at least two proof points`);
    if (!Array.isArray(scenario.qaCommands) || !scenario.qaCommands.length) issue(`${scenario.id}: qaCommands missing`);

    const file = routeFile(scenario.route);
    const sourcePath = join(file);
    const distPath = join(root, file);
    const htmlPath = await fileExists(distPath) ? distPath : sourcePath;
    if (!file || !await fileExists(htmlPath)) {
      issue(`${scenario.id}: route file missing for ${scenario.route}`);
    } else {
      const html = await readFile(htmlPath, "utf8");
      if (!selectorPresent(html, scenario.selector)) {
        issue(`${scenario.id}: selector ${scenario.selector} not found in ${htmlPath}`);
      }
    }

    if (scenario.formType) {
      if (!allowedFormTypes.has(scenario.formType)) issue(`${scenario.id}: unknown formType ${scenario.formType}`);
      if (!appJs.includes(`${scenario.formType}:`) && !appJs.includes(`formType: "${scenario.formType}"`)) {
        issue(`${scenario.id}: app.js does not expose form type ${scenario.formType}`);
      }
    }
    if (scenario.expectedRolePath && !appJs.includes(`rolePath: "${scenario.expectedRolePath}"`)) {
      issue(`${scenario.id}: app.js missing expected role path ${scenario.expectedRolePath}`);
    }
    if (scenario.expectedInquiryType && !appJs.includes(`inquiryType: "${scenario.expectedInquiryType}"`)) {
      issue(`${scenario.id}: app.js missing expected inquiry type ${scenario.expectedInquiryType}`);
    }
    if (Array.isArray(scenario.mediaActions)) {
      for (const action of scenario.mediaActions) {
        if (!allowedMediaActions.has(action)) issue(`${scenario.id}: unknown media action ${action}`);
        const file = routeFile(scenario.route);
        const html = await readFile(await fileExists(join(root, file)) ? join(root, file) : file, "utf8");
        if (!html.includes(`data-media-action="${action}"`)) {
          issue(`${scenario.id}: route missing media action ${action}`);
        }
      }
    }
    if (Array.isArray(scenario.publicBoundaryMarkers)) {
      for (const marker of scenario.publicBoundaryMarkers) {
        if (!reportingHtml.includes(marker)) issue(`${scenario.id}: public reporting boundary missing ${marker}`);
      }
    }
    if (Array.isArray(scenario.forbiddenPublicMarkers)) {
      for (const marker of scenario.forbiddenPublicMarkers) {
        if (reportingHtml.includes(marker)) issue(`${scenario.id}: public reporting route exposes ${marker}`);
      }
    }
    if (Array.isArray(scenario.protectedReportContractMarkers)) {
      for (const marker of scenario.protectedReportContractMarkers) {
        if (!appJs.includes(marker)) issue(`${scenario.id}: protected report client contract missing ${marker}`);
      }
    }
    for (const command of scenario.qaCommands || []) {
      const script = String(command).match(/node\s+(tools\/[^\s]+)/)?.[1] || "";
      if (!script) {
        issue(`${scenario.id}: QA command is not a node tools command: ${command}`);
      } else if (!await fileExists(script)) {
        issue(`${scenario.id}: QA command script missing: ${script}`);
      }
    }
  }

  for (const id of requiredScenarioIds) {
    if (!ids.has(id)) issue(`pilot test matrix missing required scenario ${id}`);
  }
  for (const coverage of requiredCoverage) {
    if (!covered.has(coverage)) issue(`pilot test matrix scenarios do not cover ${coverage}`);
  }
}

if (issues.length) {
  console.error(`Pilot test matrix QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Pilot test matrix QA passed.");
