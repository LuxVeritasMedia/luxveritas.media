import { access, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const issues = [];
const warnings = [];
const packetPath = "data/cr8-store-submission.json";
const packet = JSON.parse(await readFile(packetPath, "utf8"));

function issue(message) {
  issues.push(message);
}

function warning(message) {
  warnings.push(message);
}

async function exists(rel) {
  try {
    await access(rel);
    const info = await stat(rel);
    return info.size > 0;
  } catch {
    return false;
  }
}

if (packet.schemaVersion !== "luxveritas.cr8_store_submission.v1") {
  issue(`${packetPath}: missing schemaVersion luxveritas.cr8_store_submission.v1`);
}
if (packet.status !== "prepared_pending_final_assets") {
  issue(`${packetPath}: status must remain prepared_pending_final_assets until final assets are approved`);
}
if (packet.app?.id !== "cr8") {
  issue(`${packetPath}: expected app.id cr8`);
}

const apple = packet.listingMetadata?.apple || {};
const google = packet.listingMetadata?.googlePlay || {};
if (apple.appName !== "CR8" || google.appName !== "CR8") {
  issue(`${packetPath}: Apple and Google app names must be CR8`);
}
if ((apple.subtitle || "").length > 30) {
  issue(`${packetPath}: Apple subtitle should stay within 30 characters`);
}
if ((google.shortDescription || "").length > 80) {
  issue(`${packetPath}: Google Play short description should stay within 80 characters`);
}
if (apple.ageRatingStatus !== "questionnaire_required") {
  issue(`${packetPath}: Apple age rating must require questionnaire before final submission`);
}
if (google.contentRatingStatus !== "iarc_questionnaire_required") {
  issue(`${packetPath}: Google Play content rating must require IARC questionnaire`);
}
if (google.dataSafetyStatus !== "final_data_safety_review_required") {
  issue(`${packetPath}: Google Play data safety must require final behavior review`);
}

const assetGroups = [
  ...(packet.assetReadiness?.iconCandidates || []),
  ...(packet.assetReadiness?.featureGraphicCandidates || [])
];
for (const asset of assetGroups) {
  if (asset.status !== "candidate_pending_approval") {
    issue(`${packetPath}: ${asset.label || asset.path} must not be marked approved before owner approval`);
  }
  const rel = String(asset.path || "").replace(/^\//, "");
  if (!await exists(rel)) {
    issue(`${packetPath}: missing non-empty asset ${asset.path}`);
  }
}

const screenshotPlan = packet.assetReadiness?.screenshotPlan || [];
if (screenshotPlan.length < 3) {
  issue(`${packetPath}: expected at least three screenshot plan entries`);
}
for (const item of screenshotPlan) {
  if (item.status !== "requires_captured_app_screenshots") {
    issue(`${packetPath}: ${item.platform || "screenshot"} must require captured app screenshots`);
  }
}

const rules = packet.acceptanceRules || [];
if (!rules.some((rule) => /Do not submit public preview cards/i.test(rule))) {
  issue(`${packetPath}: missing rule forbidding preview cards as screenshots`);
}
if (!rules.some((rule) => /captured CR8 app build screenshots/i.test(rule))) {
  issue(`${packetPath}: missing rule requiring captured app build screenshots`);
}

const officialUrls = new Set((packet.officialSources || []).map((source) => source.url));
for (const url of [
  "https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications",
  "https://developer.apple.com/help/app-store-connect/manage-app-information/add-an-app-icon/",
  "https://support.google.com/googleplay/android-developer/answer/9866151"
]) {
  if (!officialUrls.has(url)) issue(`${packetPath}: missing official source ${url}`);
}

const doc = await readFile("docs/cr8-store-submission.md", "utf8");
if (!doc.includes("Source of truth: `data/cr8-store-submission.json`")) {
  issue("docs/cr8-store-submission.md: missing source-of-truth link");
}
if (/approved final art/i.test(doc) && !doc.includes("not approved final art")) {
  warning("docs/cr8-store-submission.md: review approved/final wording");
}

if (issues.length) {
  console.error("CR8 store submission QA failed:");
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`CR8 store submission QA passed with ${warnings.length} warnings.`);
for (const item of warnings) console.warn(`Warning: ${item}`);
