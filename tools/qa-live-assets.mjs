import { readdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";

const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const dist = "dist";
const issues = [];
const warnings = [];
const checkedExtensions = new Set([
  ".css",
  ".js",
  ".json",
  ".png",
  ".svg",
  ".txt",
  ".wav",
  ".webm",
  ".webmanifest",
  ".xml"
]);
const typePatterns = {
  ".css": /text\/css/i,
  ".js": /(text|application)\/javascript/i,
  ".json": /application\/json/i,
  ".png": /image\/png/i,
  ".svg": /image\/svg\+xml/i,
  ".txt": /text\/plain/i,
  ".wav": /audio\/(wav|wave|x-wav)/i,
  ".webm": /video\/webm/i,
  ".webmanifest": /(application\/manifest\+json|application\/json)/i,
  ".xml": /(application|text)\/xml/i
};

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

function publicPath(path) {
  return `/${path.replace(/^dist\//, "").replaceAll("\\", "/")}`;
}

async function fetchHead(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "HEAD",
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function issue(message) {
  issues.push(message);
}

function warn(message) {
  warnings.push(message);
}

let files = [];
try {
  files = await listFiles(dist);
} catch (error) {
  issue(`dist artifact is missing or unreadable: ${error.message}`);
}

const assetFiles = [];
for (const file of files) {
  const ext = extname(file);
  if (!checkedExtensions.has(ext)) continue;
  const info = await stat(file);
  if (info.size === 0) issue(`${file}: local deploy artifact is empty`);
  assetFiles.push({
    file,
    ext,
    size: info.size,
    path: publicPath(file)
  });
}

for (const asset of assetFiles) {
  try {
    const response = await fetchHead(asset.path);
    if (!response.ok) {
      issue(`${asset.path}: expected HTTP 200, received ${response.status}`);
      continue;
    }
    const contentType = response.headers.get("content-type") || "";
    const pattern = typePatterns[asset.ext];
    if (pattern && !pattern.test(contentType)) {
      issue(`${asset.path}: expected ${asset.ext} content type, received ${contentType || "missing"}`);
    }
    const length = Number(response.headers.get("content-length") || "0");
    if (length === 0 && asset.size > 1024 && !response.headers.get("transfer-encoding")) {
      warn(`${asset.path}: live response did not expose a content-length header`);
    }
  } catch (error) {
    issue(`${asset.path}: request failed (${error.message})`);
  }
}

if (!assetFiles.some((asset) => asset.path === "/data/lux-build-manifest.json")) {
  issue("dist artifact missing /data/lux-build-manifest.json");
}
if (!assetFiles.some((asset) => asset.path === "/data/lux-fan-flywheel.json")) {
  issue("dist artifact missing /data/lux-fan-flywheel.json");
}
if (!assetFiles.some((asset) => asset.path === "/data/lux-drop-room.json")) {
  issue("dist artifact missing /data/lux-drop-room.json");
}
if (!assetFiles.some((asset) => asset.path === "/data/lux-portal-rooms.json")) {
  issue("dist artifact missing /data/lux-portal-rooms.json");
}
if (!assetFiles.some((asset) => asset.path === "/data/lux-phase-status.json")) {
  issue("dist artifact missing /data/lux-phase-status.json");
}
if (!assetFiles.some((asset) => asset.path === "/data/lux-pilot-write-evidence.json")) {
  issue("dist artifact missing /data/lux-pilot-write-evidence.json");
}
if (!assetFiles.some((asset) => asset.path === "/assets/luxveritas-icon.svg")) {
  issue("dist artifact missing /assets/luxveritas-icon.svg");
}
if (assetFiles.filter((asset) => asset.path.startsWith("/assets/lux-house-")).length !== 6) {
  issue("dist artifact must include six Lux house mark SVG assets");
}
if (!assetFiles.some((asset) => asset.path.endsWith(".webm"))) {
  issue("dist artifact missing video preview asset");
}
if (assetFiles.filter((asset) => asset.path.endsWith(".wav")).length < 2) {
  issue("dist artifact missing audio/radio preview assets");
}

if (warnings.length) {
  console.warn("Live asset QA warnings:");
  for (const item of warnings) console.warn(`- ${item}`);
}

if (issues.length) {
  console.error(`Live asset QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Live asset QA passed for ${assetFiles.length} deployed asset(s) at ${baseUrl}.`);
