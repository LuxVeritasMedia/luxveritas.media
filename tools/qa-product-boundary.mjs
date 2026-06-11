import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join, normalize, relative } from "node:path";
import { promisify } from "node:util";

const root = "dist";
const issues = [];
const execFileAsync = promisify(execFile);

const forbiddenPublicPatterns = [
  /LuxFlow/i,
  /LuxOS/i,
  /DAMON/i,
  /BlackGPT/i,
  /CanonCraft/i,
  /SignalCraft/i,
  /PromptOps/i,
  /AgentForge/i,
  /private prompts/i,
  /audit logs/i,
  /finance/i,
  /rights ops/i,
  /release ops/i,
  /canon bible/i
];

const forbiddenTrackedDocs = [
  /source_docs/i,
  /brief_extracts/i,
  /lux-ecosystem-master-seed/i,
  /kys-binder-index/i,
  /kys-/i
];

function issue(message) {
  issues.push(message);
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

const [boundaryDoc, uploadChecklist, trackedDocsRaw] = await Promise.all([
  readFile("docs/PRODUCT_BOUNDARY.md", "utf8"),
  readFile("docs/upload-checklist.md", "utf8"),
  execFileAsync("git", ["ls-files", "docs"], { timeout: 10000 }).then(({ stdout }) => stdout)
]);

for (const marker of [
  "LuxVeritas.media",
  "LuxFlow OS",
  "Phase 7 Bridge Rule",
  "controlled bridge, not a repo merge",
  "Never expose private prompts"
]) {
  if (!boundaryDoc.includes(marker)) issue(`docs/PRODUCT_BOUNDARY.md missing marker: ${marker}`);
}

for (const marker of [
  "Files And Folders To Exclude",
  "source_docs/",
  ".git/",
  "real .env files",
  "API keys",
  "Firebase private credentials",
  "internal-only"
]) {
  if (!uploadChecklist.includes(marker)) issue(`docs/upload-checklist.md missing safe-upload marker: ${marker}`);
}

const trackedDocs = trackedDocsRaw.split("\n").map((line) => line.trim()).filter(Boolean);
for (const docPath of trackedDocs) {
  for (const pattern of forbiddenTrackedDocs) {
    if (pattern.test(docPath)) issue(`Tracked docs include internal-only path ${docPath}`);
  }
}

const deployFiles = await walk(root);
for (const file of deployFiles) {
  if (!/\.(html|js|css|json|txt|xml|webmanifest)$/i.test(file)) continue;
  const rel = normalize(relative(root, file));
  const text = await readFile(file, "utf8");
  for (const pattern of forbiddenPublicPatterns) {
    if (pattern.test(text)) issue(`${rel}: public artifact exposes internal boundary term ${pattern}`);
  }
}

const privateRouteHtml = await readFile(join(root, "private-steward.html"), "utf8");
if (!privateRouteHtml.includes('name="robots" content="noindex, nofollow"')) {
  issue("private-steward.html: private steward shell must be noindex");
}
if (!privateRouteHtml.includes("Internal materials are not public.")) {
  issue("private-steward.html: private steward shell must withhold internal material");
}

if (issues.length) {
  console.error(`Product boundary QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Product boundary QA passed for ${deployFiles.length} deploy files and ${trackedDocs.length} tracked docs.`);
