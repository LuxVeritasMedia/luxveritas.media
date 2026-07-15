import { constants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { join, normalize, relative } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const issues = [];
const passed = [];

function pass(message) {
  passed.push(message);
  console.log(`PASS ${message}`);
}

function issue(message) {
  issues.push(message);
  console.log(`BLOCK ${message}`);
}

function secretShape(value) {
  return /\bre_[A-Za-z0-9_-]{16,}\b|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{16,}|https:\/\/hooks\.[^\s]+|service_role[_-]?[A-Za-z0-9_-]{12,}/i.test(value);
}

async function exists(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

function pathLooksInternal(path) {
  return /source_docs|brief_extracts|lux-ecosystem-master-seed|kys-|\.git|node_modules|\.env$|\.zip$/i.test(path);
}

console.log("Lux Veritas private upload manifest QA");

const [
  manifestRaw,
  checklist,
  productBoundary,
  arieQuickstart,
  arieHandoff,
  nodeZHandoff,
  trackedDocsRaw
] = await Promise.all([
  readFile("docs/private-upload-manifest.json", "utf8"),
  readFile("docs/upload-checklist.md", "utf8"),
  readFile("docs/PRODUCT_BOUNDARY.md", "utf8"),
  readFile("docs/arie-quickstart.md", "utf8"),
  readFile("docs/arie-handoff-website-build.md", "utf8"),
  readFile("docs/node-z-arie-release-handoff.md", "utf8"),
  execFileAsync("git", ["ls-files", "docs"], { timeout: 10000 }).then(({ stdout }) => stdout)
]);

if (secretShape(`${manifestRaw}\n${checklist}\n${arieQuickstart}\n${arieHandoff}\n${nodeZHandoff}`)) {
  issue("private upload manifest or handoff docs appear to contain secret-shaped data");
}

const manifest = JSON.parse(manifestRaw);
if (manifest.schemaVersion === "luxveritas.private_upload_manifest.v1") pass("manifest schemaVersion is current.");
else issue("manifest schemaVersion mismatch");

if (manifest.openApprovalId === "seed_binder_private_upload") pass("manifest is tied to seed_binder_private_upload approval.");
else issue("manifest openApprovalId mismatch");

if (manifest.uploadStatus === "operator_review_required") pass("manifest keeps upload as operator-review required.");
else issue("manifest uploadStatus should remain operator_review_required until external upload is confirmed");

if (manifest.shareTarget === "private_drive_or_private_repo") pass("manifest share target stays private.");
else issue("manifest shareTarget must be private_drive_or_private_repo");

const uploadApproval = manifest.recommendedUploadApproval || {};
if (uploadApproval.status === "identified_pending_internal_operations_owner_approval") pass("recommended upload approval remains pending operator approval.");
else issue("recommendedUploadApproval status mismatch");
if (uploadApproval.folderName === manifest.recommendedFolderName) pass("recommended upload approval folder matches manifest folder.");
else issue("recommendedUploadApproval folderName must match recommendedFolderName");
if (uploadApproval.shareTarget === manifest.shareTarget) pass("recommended upload approval shareTarget matches manifest shareTarget.");
else issue("recommendedUploadApproval shareTarget must match manifest shareTarget");
if (/I approve uploading the curated Lux Veritas Website Build package/i.test(uploadApproval.approvalLanguage || "")) pass("recommended upload approval has exact approval language.");
else issue("recommendedUploadApproval missing exact approval language");
if (!/Exclude source zips, local caches, secrets, internal ecosystem seed\/binder materials, and internal LuxFlow OS app folders/i.test(uploadApproval.approvalLanguage || "")) {
  issue("recommendedUploadApproval language missing exclusion scope");
}
for (const scope of [
  "Upload only the curated website build package listed in requiredPaths and selected optionalGeneratedPaths.",
  "Share only through a private Drive folder or private internal repository with controlled collaborator access.",
  "Keep internal ecosystem seed/binder docs separate unless deliberately shared in a separate private context.",
  "Do not publish this private upload folder as a public website or public GitHub repo."
]) {
  if (!uploadApproval.approvalScope?.includes(scope)) issue(`recommendedUploadApproval approvalScope missing: ${scope}`);
}
for (const proof of [
  "Private folder or private repository exists.",
  "Arie/collaborator access is confirmed.",
  "Excluded paths and secret exclusions are absent.",
  "Verification commands pass from a clean local copy after download or clone."
]) {
  if (!uploadApproval.requiredOperatorProof?.includes(proof)) issue(`recommendedUploadApproval required proof missing: ${proof}`);
}
for (const command of [
  "node tools/qa-private-upload-manifest.mjs",
  "node tools/qa-product-boundary.mjs",
  "node tools/qa-preview-helper.mjs",
  "node tools/qa-public-site.mjs"
]) {
  if (!uploadApproval.verificationCommands?.includes(command)) issue(`recommendedUploadApproval verificationCommands missing ${command}`);
}
if (/externally confirmed/i.test(uploadApproval.closeoutRule || "")) pass("recommended upload approval has external closeout rule.");
else issue("recommendedUploadApproval closeoutRule must require external confirmation");

for (const marker of [
  "does not prove the private Drive or private repository upload happened",
  "internal operations owner",
  "secret-free"
]) {
  if (!manifest.approvalBoundary?.includes(marker)) issue(`manifest approvalBoundary missing marker: ${marker}`);
}

for (const path of manifest.requiredPaths || []) {
  if (pathLooksInternal(path)) issue(`required upload path should not include internal/source material: ${path}`);
  const cleanPath = path.endsWith("/") ? path.slice(0, -1) : path;
  if (await exists(cleanPath)) pass(`required path exists: ${path}`);
  else issue(`required upload path missing: ${path}`);
}

for (const path of manifest.firstOpenOrder || []) {
  if (!manifest.requiredPaths?.includes(path)) issue(`firstOpenOrder path is not required for upload: ${path}`);
}

for (const command of [
  "node tools/qa-private-upload-manifest.mjs",
  "node tools/qa-product-boundary.mjs",
  "node tools/qa-preview-helper.mjs",
  "node tools/qa-public-site.mjs"
]) {
  if (!manifest.verificationCommands?.includes(command)) issue(`manifest verificationCommands missing ${command}`);
}

for (const excluded of [
  "source_docs/",
  "source_docs_round2/",
  "brief_extracts/",
  "brief_extracts_round2/",
  "*.zip",
  ".git/",
  "node_modules/",
  ".env",
  "docs/lux-ecosystem-master-seed.md",
  "docs/kys-binder-index.md",
  "docs/kys-*.md",
  "internal LuxFlow OS app folders"
]) {
  if (!manifest.excludedPaths?.includes(excluded)) issue(`manifest excludedPaths missing ${excluded}`);
  if (!checklist.includes(excluded)) issue(`upload checklist missing excluded path ${excluded}`);
}

for (const secret of [
  "real .env files",
  "webhook URLs",
  "API keys",
  "Firebase private credentials",
  "Supabase service-role keys",
  "Stripe secrets",
  "Printify tokens"
]) {
  if (!manifest.secretExclusions?.includes(secret)) issue(`manifest secretExclusions missing ${secret}`);
  if (!checklist.includes(secret)) issue(`upload checklist missing secret exclusion ${secret}`);
}

for (const marker of [
  "Approval Language",
  "I approve uploading the curated Lux Veritas Website Build package",
  "docs/private-upload-manifest.json",
  "docs/node-z-arie-release-handoff.md",
  "docs/private-workflow-matrix.json",
  "docs/external-workflow-targets.json",
  "docs/private-workflow-selection.json",
  "data/",
  "functions/",
  "tools/serve-preview.mjs",
  "tools/qa-private-upload-manifest.mjs",
  "tools/qa-preview-helper.mjs",
  "Use the Local URL printed by `node tools/serve-preview.mjs`"
]) {
  if (!checklist.includes(marker)) issue(`upload checklist missing upload marker: ${marker}`);
}

for (const stale of [
  "firebase.indexes.json",
  "firebase.rules",
  "python3 -m http.server 4173",
  "/Users/frederickparent/Documents/New%20project",
  "/Users/frederickparent/Documents/New project"
]) {
  if (`${manifestRaw}\n${checklist}\n${arieQuickstart}\n${arieHandoff}\n${nodeZHandoff}`.includes(stale)) {
    issue(`private upload guidance still references stale item: ${stale}`);
  }
}

for (const marker of [
  "Role: Node Z website release partner",
  "Public website release readiness: 94%",
  "Public launch blockers: 0",
  "SignalCode does not have an approved public route yet"
]) {
  if (!arieQuickstart.includes(marker)) issue(`Arie quickstart missing current open item: ${marker}`);
}

for (const marker of [
  "Historical iteration record",
  "docs/node-z-arie-release-handoff.md"
]) {
  if (!arieHandoff.includes(marker)) issue(`Arie handoff missing current status marker: ${marker}`);
}

for (const marker of [
  "Audience: Arie, Node Z",
  "Repository visibility: `PUBLIC`",
  "Public website release readiness",
  "ready_for_final_release_gate",
  "SignalCode has no approved record or public route",
  "Recommended Tool And MCP Stack",
  "Do not introduce"
]) {
  if (!nodeZHandoff.includes(marker)) issue(`Node Z handoff missing current status marker: ${marker}`);
}

for (const marker of [
  "LuxVeritas.media",
  "public website",
  "LuxFlow OS` is the internal authenticated production cockpit"
]) {
  if (!productBoundary.includes(marker)) issue(`product boundary missing marker: ${marker}`);
}

const trackedDocs = trackedDocsRaw.split("\n").map((line) => line.trim()).filter(Boolean);
for (const docPath of trackedDocs) {
  if (/lux-ecosystem-master-seed|kys-binder-index|kys-/i.test(docPath)) {
    issue(`internal seed/binder doc is tracked in public docs: ${docPath}`);
  }
}
pass(`tracked docs checked: ${trackedDocs.length}.`);

if (await exists("dist")) {
  const deployFiles = await walk("dist");
  for (const file of deployFiles) {
    const rel = normalize(relative("dist", file));
    if (/lux-ecosystem-master-seed|kys-binder-index|kys-|source_docs|brief_extracts/i.test(rel)) {
      issue(`deploy artifact contains excluded internal/source material: ${rel}`);
    }
  }
  pass(`deploy artifact checked: ${deployFiles.length} files.`);
}

console.log("");
console.log(`Private upload manifest QA checked: ${passed.length} passed, ${issues.length} blocker(s).`);
if (issues.length) process.exit(1);
