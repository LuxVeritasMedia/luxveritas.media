import { copyFile, cp, mkdir, rm } from "node:fs/promises";
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

console.log(`Prepared Firebase Hosting artifact with ${files.length + 1} files.`);
