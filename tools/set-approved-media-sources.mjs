import { readFile, writeFile } from "node:fs/promises";

const manifestPath = "data/lux-media-manifest.json";
const dryRun = process.env.LUX_MEDIA_DRY_RUN === "1";
const allowPartial = process.env.LUX_MEDIA_ALLOW_PARTIAL === "1";

const sourceMap = {
  "spmvp-release": {
    sourceEnv: "LUX_MEDIA_SPMVP_RELEASE_URL",
    posterEnv: "LUX_MEDIA_SPMVP_POSTER_URL"
  },
  "visual-world": {
    sourceEnv: "LUX_MEDIA_VISUAL_WORLD_URL",
    posterEnv: "LUX_MEDIA_VISUAL_WORLD_POSTER_URL"
  },
  "lux-radio": {
    sourceEnv: "LUX_MEDIA_LUX_RADIO_URL",
    posterEnv: "LUX_MEDIA_LUX_RADIO_POSTER_URL"
  }
};

function validSourceUrl(value) {
  return /^https:\/\//i.test(value || "");
}

function validPosterUrl(value) {
  return !value || /^https:\/\//i.test(value) || value.startsWith("/assets/");
}

function usage() {
  console.error("Set approved media URLs, then run:");
  console.error("  LUX_MEDIA_SPMVP_RELEASE_URL='https://...' \\");
  console.error("  LUX_MEDIA_VISUAL_WORLD_URL='https://...' \\");
  console.error("  LUX_MEDIA_LUX_RADIO_URL='https://...' \\");
  console.error("  node tools/set-approved-media-sources.mjs");
  console.error("");
  console.error("Optional posters:");
  console.error("  LUX_MEDIA_SPMVP_POSTER_URL='https://...' or '/assets/file.png'");
  console.error("  LUX_MEDIA_VISUAL_WORLD_POSTER_URL='https://...' or '/assets/file.png'");
  console.error("  LUX_MEDIA_LUX_RADIO_POSTER_URL='https://...' or '/assets/file.png'");
  console.error("");
  console.error("Use LUX_MEDIA_DRY_RUN=1 to validate without writing.");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const items = Array.isArray(manifest.items) ? manifest.items : [];
const issues = [];
const changes = [];

for (const item of items) {
  const config = sourceMap[item.id];
  if (!config) continue;

  const sourceUrl = process.env[config.sourceEnv] || "";
  const posterUrl = process.env[config.posterEnv] || "";

  if (!sourceUrl) {
    if (!allowPartial) issues.push(`${item.id}: missing ${config.sourceEnv}`);
    continue;
  }
  if (!validSourceUrl(sourceUrl)) issues.push(`${item.id}: ${config.sourceEnv} must be HTTPS`);
  if (!validPosterUrl(posterUrl)) issues.push(`${item.id}: ${config.posterEnv} must be HTTPS or /assets/`);

  changes.push({
    item,
    sourceUrl,
    posterUrl
  });
}

if (!changes.length) {
  usage();
  process.exit(1);
}

if (issues.length) {
  console.error("Approved media source setup failed:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

for (const change of changes) {
  change.item.sourceUrl = change.sourceUrl;
  change.item.sourceStatus = "ready";
  if (change.posterUrl) change.item.posterUrl = change.posterUrl;
}

manifest.updatedAt = new Date().toISOString();

if (dryRun) {
  console.log(`Dry run passed for ${changes.length} approved media source${changes.length === 1 ? "" : "s"}.`);
  for (const change of changes) console.log(`- ${change.item.id}: ${change.sourceUrl}`);
  process.exit(0);
}

await writeFile(`${manifestPath}`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Updated ${manifestPath} with ${changes.length} approved media source${changes.length === 1 ? "" : "s"}.`);
