import { copyFile, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
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
const assetFiles = [
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
await cp("data/lux-brand-house.json", join(dist, "data/lux-brand-house.json"));
await cp("data/lux-fan-flywheel.json", join(dist, "data/lux-fan-flywheel.json"));
await cp("data/lux-drop-room.json", join(dist, "data/lux-drop-room.json"));
await cp("data/lux-portal-rooms.json", join(dist, "data/lux-portal-rooms.json"));
await cp("data/lux-apps.json", join(dist, "data/lux-apps.json"));
await cp("data/cr8-store-submission.json", join(dist, "data/cr8-store-submission.json"));
await cp("data/lux-phase-status.json", join(dist, "data/lux-phase-status.json"));
await cp("data/lux-media-manifest.json", join(dist, "data/lux-media-manifest.json"));
await cp("data/lux-release-room.json", join(dist, "data/lux-release-room.json"));
await cp("data/lux-radio-programming.json", join(dist, "data/lux-radio-programming.json"));
await cp("data/lux-pilot-bug-register.json", join(dist, "data/lux-pilot-bug-register.json"));
await cp("data/lux-build-manifest.json", join(dist, "data/lux-build-manifest.json"));
await cp("data/lux-action-inventory.json", join(dist, "data/lux-action-inventory.json"));
await cp("data/lux-open-approvals.json", join(dist, "data/lux-open-approvals.json"));
await cp("data/lux-launch-readiness.json", join(dist, "data/lux-launch-readiness.json"));
await cp("data/lux-pilot-write-evidence.json", join(dist, "data/lux-pilot-write-evidence.json"));
await cp("data/lux-public-terms.json", join(dist, "data/lux-public-terms.json"));
await cp("data/lux-legal-review.json", join(dist, "data/lux-legal-review.json"));
const closeout = JSON.parse(await readFile("data/lux-launch-closeout.json", "utf8"));
const publicCloseout = {
  schemaVersion: "luxveritas.launch_closeout_public.v1",
  updatedAt: closeout.updatedAt || "",
  items: Array.isArray(closeout.items)
    ? closeout.items.map((item) => ({
      id: item.id,
      gateId: item.gateId,
      label: item.label,
      status: item.status,
      owner: item.owner,
      evidenceReference: item.evidenceReference || "",
      closedAt: item.closedAt || "",
      closedBy: item.closedBy || ""
    }))
    : []
};
await writeFile(join(dist, "data/lux-launch-closeout-public.json"), `${JSON.stringify(publicCloseout, null, 2)}\n`);

const requiredNonEmpty = [
  ...files,
  ...assetFiles,
  "data/lux-brand-house.json",
  "data/lux-fan-flywheel.json",
  "data/lux-drop-room.json",
  "data/lux-portal-rooms.json",
  "data/lux-apps.json",
  "data/cr8-store-submission.json",
  "data/lux-phase-status.json",
  "data/lux-build-manifest.json",
  "data/lux-action-inventory.json",
  "data/lux-open-approvals.json",
  "data/lux-media-manifest.json",
  "data/lux-release-room.json",
  "data/lux-radio-programming.json",
  "data/lux-pilot-bug-register.json",
  "data/lux-launch-readiness.json",
  "data/lux-pilot-write-evidence.json",
  "data/lux-launch-closeout-public.json",
  "data/lux-public-terms.json",
  "data/lux-legal-review.json"
];

for (const file of requiredNonEmpty) {
  const info = await stat(join(dist, file));
  if (info.size === 0) {
    throw new Error(`Prepared artifact contains an empty file: ${file}`);
  }
}

console.log(`Prepared Firebase Hosting artifact with ${files.length + assetFiles.length + 19} files.`);
