import { copyFile, cp, mkdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import "./export-action-inventory.mjs";
import "./export-open-approvals.mjs";

const dist = "dist";
const luxApps = JSON.parse(await readFile("data/lux-apps.json", "utf8"));
const appHtmlFiles = Array.isArray(luxApps.apps)
  ? luxApps.apps.flatMap((app) => {
    const base = `luxflow/${app.slug || app.id}`;
    return [
      `${base}/index.html`,
      `${base}/support.html`,
      `${base}/privacy.html`,
      `${base}/terms.html`,
      `${base}/delete-data.html`,
      `${base}/download.html`
    ];
  })
  : [];
const files = [
  "about.html",
  "apps/index.html",
  "app.js",
  "private-steward.html",
  "codex-inner.html",
  "codex-sanctum.html",
  "codex.html",
  "community.html",
  "contact.html",
  "events.html",
  "film.html",
  "index.html",
  "insights.html",
  "investor.html",
  "join.html",
  "ledger.html",
  "membership.html",
  "music.html",
  "404.html",
  "offline.html",
  "pilot-feedback.html",
  "press.html",
  "robots.txt",
  "service-worker.js",
  "site.webmanifest",
  "sitemap.xml",
  "spmvp.html",
  "store.html",
  "styles.css",
  "submissions.html",
  "auth/signin.html",
  "brands/index.html",
  "brands/sample.html",
  "events/codex-salon.html",
  "events/destination-week.html",
  "events/listening-room.html",
  "legal/privacy.html",
  "legal/terms.html",
  "luxflow/index.html",
  ...appHtmlFiles,
  "portal/admin.html",
  "portal/admin/users.html",
  "portal/index.html",
  "portal/library.html",
  "portal/reporting.html",
  "portal/releases.html",
  "works/index.html",
  "works/sample.html"
];
const baseAssetFiles = [
  "assets/luxveritas-threshold.png",
  "assets/luxveritas-signal-poster.svg",
  "assets/luxveritas-icon.svg",
  "assets/apps/cr8/cr8-icon-1024.png",
  "assets/apps/cr8/cr8-google-play-icon-512.png",
  "assets/apps/cr8/cr8-google-play-feature-1024x500.png",
  "assets/lux-house-records.svg",
  "assets/lux-house-studios.svg",
  "assets/lux-house-publishing.svg",
  "assets/lux-house-live.svg",
  "assets/lux-house-circle.svg",
  "assets/lux-house-atelier.svg",
  "assets/luxveritas-spmvp-preview.wav",
  "assets/luxveritas-radio-preview.wav",
  "assets/luxveritas-visual-preview.webm"
];
const mediaManifest = JSON.parse(await readFile("data/lux-media-manifest.json", "utf8"));

function localAssetPathFromUrl(value) {
  if (!value) return null;
  let pathname = "";
  if (value.startsWith("/assets/")) pathname = value;
  else {
    try {
      const url = new URL(value);
      if (url.hostname === "luxveritas.media" && url.pathname.startsWith("/assets/")) pathname = url.pathname;
    } catch {
      return null;
    }
  }
  const clean = pathname.replace(/^\/+/, "");
  if (!clean.startsWith("assets/") || clean.includes("..")) return null;
  return clean;
}

const manifestAssetFiles = (mediaManifest.items || [])
  .flatMap((item) => [localAssetPathFromUrl(item.sourceUrl), localAssetPathFromUrl(item.posterUrl)])
  .filter(Boolean);
const assetFiles = [...new Set([...baseAssetFiles, ...manifestAssetFiles])];

await rm(dist, { recursive: true, force: true });

for (const file of files) {
  const target = join(dist, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(file, target);
}

await mkdir(join(dist, "assets"), { recursive: true });
for (const file of assetFiles) {
  await cp(file, join(dist, file));
}
await mkdir(join(dist, "data"), { recursive: true });
const publicDataFiles = [
  "data/lux-brand-house.json",
  "data/lux-fan-flywheel.json",
  "data/lux-drop-room.json",
  "data/lux-portal-rooms.json",
  "data/lux-apps.json",
  "data/lux-media-manifest.json",
  "data/lux-build-manifest.json",
  "data/lux-public-terms.json"
];
for (const file of publicDataFiles) {
  await cp(file, join(dist, file));
}

const requiredNonEmpty = [
  ...files,
  ...assetFiles,
  ...publicDataFiles
];

for (const file of requiredNonEmpty) {
  const info = await stat(join(dist, file));
  if (info.size === 0) {
    throw new Error(`Prepared artifact contains an empty file: ${file}`);
  }
}

console.log(`Prepared Firebase Hosting artifact with ${files.length + assetFiles.length + publicDataFiles.length} files.`);
