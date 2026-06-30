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
  trackedDocsRaw
] = await Promise.all([
  readFile("docs/private-upload-manifest.json", "utf8"),
  readFile("docs/upload-checklist.md", "utf8"),
  readFile("docs/PRODUCT_BOUNDARY.md", "utf8"),
  execFileAsync("git", ["ls-files", "docs"], { timeout: 10000 }).then(({ stdout }) => stdout)
]);

if (secretShape(`${manifestRaw}\n${checklist}`)) {
  issue("private upload manifest or checklist appears to contain secret-shaped data");
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
  "docs/private-upload-manifest.json",
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
  "python3 -m http.server 4173"
]) {
  if (manifestRaw.includes(stale) || checklist.includes(stale)) issue(`private upload guidance still references stale item: ${stale}`);
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
