import { readFile } from "node:fs/promises";

const issues = [];
const manifest = JSON.parse(await readFile("data/lux-media-manifest.json", "utf8"));
const appJs = await readFile("app.js", "utf8");
const allowedSourceStatuses = new Set(["queued", "ready", "external"]);
const allowedSourceTypes = new Set(["audio", "video", "stream", "external"]);
const requiredKinds = new Set(["release", "visual", "radio"]);
const items = Array.isArray(manifest.items) ? manifest.items : [];

if (manifest.schemaVersion !== "luxveritas.media_manifest.v1") {
  issues.push(`manifest schemaVersion expected luxveritas.media_manifest.v1, found ${manifest.schemaVersion || "missing"}`);
}

if (!manifest.version || !manifest.updatedAt) {
  issues.push("manifest missing version or updatedAt");
}

for (const kind of requiredKinds) {
  if (!items.some((item) => item.kind === kind)) issues.push(`manifest missing media kind ${kind}`);
}

for (const item of items) {
  const label = item.id || "unknown item";
  for (const field of ["id", "kind", "title", "summary", "status", "access", "primaryAction", "sourceType", "sourceStatus", "reportingKey", "fallbackFormType", "queuedCta"]) {
    if (!item[field]) issues.push(`${label}: missing ${field}`);
  }
  if (!Array.isArray(item.contexts) || !item.contexts.length) issues.push(`${label}: missing contexts`);
  if (!allowedSourceTypes.has(item.sourceType)) issues.push(`${label}: invalid sourceType ${item.sourceType}`);
  if (!allowedSourceStatuses.has(item.sourceStatus)) issues.push(`${label}: invalid sourceStatus ${item.sourceStatus}`);
  if (item.sourceRequired !== true) issues.push(`${label}: sourceRequired must be true for MVP launch gates`);
  if (item.sourceStatus === "ready" && !/^https:\/\//i.test(item.sourceUrl || "")) {
    issues.push(`${label}: sourceStatus ready requires HTTPS sourceUrl`);
  }
  if (item.sourceUrl && !/^https:\/\//i.test(item.sourceUrl)) {
    issues.push(`${label}: sourceUrl must be HTTPS when present`);
  }
  if (item.posterUrl && !/^https:\/\//i.test(item.posterUrl) && !item.posterUrl.startsWith("/assets/")) {
    issues.push(`${label}: posterUrl must be HTTPS or local /assets path when present`);
  }
  if (!/^[a-z0-9_]+$/.test(item.reportingKey || "")) {
    issues.push(`${label}: reportingKey must be stable snake_case`);
  }
}

for (const marker of [
  "function writeMediaPlaybackEvent(",
  "function instrumentMediaElement(",
  "media_playback",
  "playbackMilestones",
  "progress_percent",
  "milestone"
]) {
  if (!appJs.includes(marker)) issues.push(`app.js missing media playback marker ${marker}`);
}

if (issues.length) {
  console.error(`Media contract QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Media contract QA passed.");
