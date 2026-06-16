import { copyFile, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const dist = "dist";
const files = [
  "about.html",
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
await cp("data/lux-media-manifest.json", join(dist, "data/lux-media-manifest.json"));
await cp("data/lux-build-manifest.json", join(dist, "data/lux-build-manifest.json"));
await cp("data/lux-launch-readiness.json", join(dist, "data/lux-launch-readiness.json"));
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
  "data/lux-build-manifest.json",
  "data/lux-media-manifest.json",
  "data/lux-launch-readiness.json",
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

console.log(`Prepared Firebase Hosting artifact with ${files.length + assetFiles.length + 6} files.`);
