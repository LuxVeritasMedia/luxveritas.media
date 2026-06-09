import { copyFile, cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

const dist = "dist";
const files = [
  "about.html",
  "app.js",
  "blackgpt-damon.html",
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
  "press.html",
  "robots.txt",
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

await rm(dist, { recursive: true, force: true });

for (const file of files) {
  const target = join(dist, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(file, target);
}

await mkdir(join(dist, "assets"), { recursive: true });
await cp("assets/luxveritas-threshold.png", join(dist, "assets/luxveritas-threshold.png"));
await mkdir(join(dist, "data"), { recursive: true });
await cp("data/lux-media-manifest.json", join(dist, "data/lux-media-manifest.json"));
await cp("data/lux-launch-readiness.json", join(dist, "data/lux-launch-readiness.json"));
await cp("data/lux-public-terms.json", join(dist, "data/lux-public-terms.json"));
await cp("data/lux-legal-review.json", join(dist, "data/lux-legal-review.json"));

const requiredNonEmpty = [
  ...files,
  "assets/luxveritas-threshold.png",
  "data/lux-media-manifest.json",
  "data/lux-launch-readiness.json",
  "data/lux-public-terms.json",
  "data/lux-legal-review.json"
];

for (const file of requiredNonEmpty) {
  const info = await stat(join(dist, file));
  if (info.size === 0) {
    throw new Error(`Prepared artifact contains an empty file: ${file}`);
  }
}

console.log(`Prepared Firebase Hosting artifact with ${files.length + 5} files.`);
