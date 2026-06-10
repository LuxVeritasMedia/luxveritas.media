import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join, normalize, relative } from "node:path";

const root = "dist";
const issues = [];
const requiredFiles = [
  "index.html",
  "app.js",
  "styles.css",
  "robots.txt",
  "sitemap.xml",
  "data/lux-launch-readiness.json",
  "data/lux-media-manifest.json",
  "data/lux-build-manifest.json",
  "data/lux-legal-review.json",
  "data/lux-public-terms.json",
  "assets/luxveritas-threshold.png",
  "assets/luxveritas-signal-poster.svg",
  "assets/luxveritas-spmvp-preview.wav",
  "assets/luxveritas-radio-preview.wav",
  "assets/luxveritas-visual-preview.webm"
];
const expectedNav = ["Home", "Music", "Film", "Events", "Codex", "About", "Join"];
const expectedFooter = ["Works", "Store", "Membership", "Submissions", "Press", "Contact", "Privacy", "Terms"];
const noindexRoutes = [
  "auth/signin.html",
  "portal/index.html",
  "portal/library.html",
  "portal/reporting.html",
  "portal/releases.html",
  "portal/admin.html",
  "portal/admin/users.html",
  "codex-inner.html",
  "codex-sanctum.html",
  "blackgpt-damon.html",
  "brands/index.html",
  "brands/sample.html",
  "investor.html",
  "legal/privacy.html",
  "legal/terms.html"
];
const bannedTerms = [
  /route-ready/i,
  /future implementation/i,
  /\bbackend\b/i,
  /Supabase/i,
  /Firestore/i,
  /Auth\.js/i,
  /\bGHL\b/i,
  /GoHighLevel/i,
  /\bUTM\b/i,
  /pixel QA/i,
  /\bKPI\b/i,
  /migration tracker/i,
  /admin verification/i,
  /magic-link/i,
  /release ops/i,
  /rights and royalties/i,
  /campaign manager/i,
  /LUX OS/i,
  /operational memory/i,
  /DSP setup/i,
  /PRO\/MLC/i,
  /SoundExchange/i,
  /Content ID/i,
  /paid media pacing/i,
  /\bsplits\b/i,
  /quarterly audits/i,
  /form_relay/i,
  /\brelay\b/i,
  /server reporting/i
];

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

function attrValue(attrs, name) {
  const match = attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] || "";
}

function textFromAnchors(html, navId) {
  const nav = html.match(new RegExp(`<nav[^>]*(?:id=["']${navId}["'][^>]*|aria-label=["']${navId}["'][^>]*)>([\\s\\S]*?)<\\/nav>`, "i"));
  if (!nav) return [];
  return [...nav[1].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => match[1].replace(/<[^>]*>/g, "").trim())
    .filter(Boolean);
}

function isExternal(href) {
  return /^(https?:|mailto:|tel:|data:|#)/i.test(href);
}

function htmlTarget(fromFile, href) {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean || isExternal(clean)) return null;
  if (clean.startsWith("/")) {
    return clean === "/" ? "index.html" : clean.slice(1);
  }
  return normalize(join(dirname(relative(root, fromFile)), clean));
}

for (const file of requiredFiles) {
  try {
    await access(join(root, file));
  } catch {
    issues.push(`Missing required deploy file: ${file}`);
  }
}

const allFiles = await walk(root);
const htmlFiles = allFiles.filter((file) => file.endsWith(".html"));
const relFiles = new Set(allFiles.map((file) => normalize(relative(root, file))));
const buildScript = await readFile("tools/build-static.mjs", "utf8");
const expectedAssetVersion = buildScript.match(/const assetVersion = "([^"]+)"/)?.[1] || "";
if (!expectedAssetVersion) issues.push("tools/build-static.mjs: missing assetVersion");

for (const file of htmlFiles) {
  const rel = normalize(relative(root, file));
  const html = await readFile(file, "utf8");

  for (const pattern of bannedTerms) {
    if (pattern.test(html)) issues.push(`${rel}: banned public term matched ${pattern}`);
  }

  for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
    const href = attrValue(match[1], "href");
    const target = htmlTarget(file, href);
    if (target && !relFiles.has(target)) {
      issues.push(`${rel}: broken internal link ${href}`);
    }
  }

  if (rel === "index.html") {
    const nav = textFromAnchors(html, "primary-nav");
    const footer = textFromAnchors(html, "Footer");
    if (nav.join("|") !== expectedNav.join("|")) issues.push(`index.html: nav mismatch: ${nav.join(" / ")}`);
    if (footer.join("|") !== expectedFooter.join("|")) issues.push(`index.html: footer mismatch: ${footer.join(" / ")}`);
  }

  if (noindexRoutes.includes(rel) && !html.includes('name="robots" content="noindex, nofollow"')) {
    issues.push(`${rel}: expected noindex metadata`);
  }

  if (expectedAssetVersion) {
    if (!html.includes(`styles.css?v=${expectedAssetVersion}`)) {
      issues.push(`${rel}: missing current CSS asset version ${expectedAssetVersion}`);
    }
    if (!html.includes(`app.js?v=${expectedAssetVersion}`)) {
      issues.push(`${rel}: missing current app asset version ${expectedAssetVersion}`);
    }
  }

  if (["music.html", "spmvp.html"].includes(rel)) {
    if (!html.includes("data-media-player")) issues.push(`${rel}: missing Lux Player`);
    if (!html.includes("data-media-source-shell")) issues.push(`${rel}: missing source-ready playback shell`);
    for (const action of ["play", "watch", "radio"]) {
      if (!html.includes(`data-media-action="${action}"`)) issues.push(`${rel}: missing media action ${action}`);
    }
  }

  if (rel === "index.html") {
    for (const field of ["public_terms_version", "privacy_version", "terms_version", "submission_terms_version"]) {
      if (!html.includes(`name="${field}"`)) issues.push(`index.html: missing hidden legal field ${field}`);
    }
  }
}

const appJs = await readFile(join(root, "app.js"), "utf8");
for (const pattern of bannedTerms) {
  if (pattern.test(appJs)) issues.push(`app.js: banned public term matched ${pattern}`);
}

const mediaManifestRaw = await readFile(join(root, "data/lux-media-manifest.json"), "utf8");
const buildManifestRaw = await readFile(join(root, "data/lux-build-manifest.json"), "utf8");
const deploymentDoc = await readFile("docs/deployment.md", "utf8");
const launchReadinessRaw = await readFile(join(root, "data/lux-launch-readiness.json"), "utf8");
const legalReviewRaw = await readFile(join(root, "data/lux-legal-review.json"), "utf8");
const publicTermsRaw = await readFile(join(root, "data/lux-public-terms.json"), "utf8");
for (const pattern of bannedTerms) {
  if (pattern.test(buildManifestRaw)) issues.push(`data/lux-build-manifest.json: banned public term matched ${pattern}`);
  if (pattern.test(launchReadinessRaw)) issues.push(`data/lux-launch-readiness.json: banned public term matched ${pattern}`);
  if (pattern.test(mediaManifestRaw)) issues.push(`data/lux-media-manifest.json: banned public term matched ${pattern}`);
  if (pattern.test(legalReviewRaw)) issues.push(`data/lux-legal-review.json: banned public term matched ${pattern}`);
  if (pattern.test(publicTermsRaw)) issues.push(`data/lux-public-terms.json: banned public term matched ${pattern}`);
}

try {
  const buildManifest = JSON.parse(buildManifestRaw);
  if (buildManifest.schemaVersion !== "luxveritas.build_manifest.v1") {
    issues.push("data/lux-build-manifest.json: missing schemaVersion luxveritas.build_manifest.v1");
  }
  if (buildManifest.version !== expectedAssetVersion) {
    issues.push(`data/lux-build-manifest.json: version ${buildManifest.version || "missing"} does not match ${expectedAssetVersion}`);
  }
  if (buildManifest.assetVersion !== expectedAssetVersion) {
    issues.push(`data/lux-build-manifest.json: assetVersion ${buildManifest.assetVersion || "missing"} does not match ${expectedAssetVersion}`);
  }
  if (buildManifest.appScript !== `app.js?v=${expectedAssetVersion}`) {
    issues.push("data/lux-build-manifest.json: appScript does not match current asset version");
  }
  if (buildManifest.stylesheet !== `styles.css?v=${expectedAssetVersion}`) {
    issues.push("data/lux-build-manifest.json: stylesheet does not match current asset version");
  }
  if (buildManifest.routeCount !== htmlFiles.length) {
    issues.push(`data/lux-build-manifest.json: routeCount ${buildManifest.routeCount} does not match ${htmlFiles.length} generated HTML files`);
  }
  if (!buildManifest.publicRouteCount || !buildManifest.mediaManifestVersion || !buildManifest.publicTermsVersion) {
    issues.push("data/lux-build-manifest.json: missing publicRouteCount, mediaManifestVersion, or publicTermsVersion");
  }
} catch (error) {
  issues.push(`data/lux-build-manifest.json: invalid JSON (${error.message})`);
}

try {
  const mediaManifest = JSON.parse(mediaManifestRaw);
  const items = Array.isArray(mediaManifest.items) ? mediaManifest.items : [];
  const kinds = new Set(items.map((item) => item.kind));
  if (mediaManifest.schemaVersion !== "luxveritas.media_manifest.v1") {
    issues.push("data/lux-media-manifest.json: missing schemaVersion luxveritas.media_manifest.v1");
  }
  for (const kind of ["release", "visual", "radio"]) {
    if (!kinds.has(kind)) issues.push(`data/lux-media-manifest.json: missing media kind ${kind}`);
  }
  for (const item of items) {
    if (!item.id || !item.title || !item.kind || !item.status || !item.sourceStatus || !item.reportingKey) {
      issues.push(`data/lux-media-manifest.json: item is missing required public fields`);
    }
    if (!["audio", "video", "stream", "external"].includes(item.sourceType)) {
      issues.push(`data/lux-media-manifest.json: ${item.id || "item"} has invalid sourceType`);
    }
    if (!Array.isArray(item.contexts) || !item.contexts.length) {
      issues.push(`data/lux-media-manifest.json: ${item.id || "item"} missing contexts`);
    }
    if (item.sourceUrl && !/^https:\/\//i.test(item.sourceUrl)) {
      issues.push(`data/lux-media-manifest.json: ${item.id || "item"} has non-HTTPS sourceUrl`);
    }
    if (!["queued", "ready", "external"].includes(item.sourceStatus)) {
      issues.push(`data/lux-media-manifest.json: ${item.id || "item"} has invalid sourceStatus`);
    }
    if (item.posterUrl && !/^https:\/\//i.test(item.posterUrl) && !item.posterUrl.startsWith("/assets/")) {
      issues.push(`data/lux-media-manifest.json: ${item.id || "item"} has invalid posterUrl`);
    }
  }
} catch (error) {
  issues.push(`data/lux-media-manifest.json: invalid JSON (${error.message})`);
}

try {
  const launchReadiness = JSON.parse(launchReadinessRaw);
  const gates = Array.isArray(launchReadiness.gates) ? launchReadiness.gates : [];
  if (!launchReadiness.version || !launchReadiness.updatedAt) {
    issues.push("data/lux-launch-readiness.json: missing version or updatedAt");
  }
  if (gates.length < 7) {
    issues.push("data/lux-launch-readiness.json: missing required launch gates");
  }
  for (const gate of gates) {
    for (const field of ["id", "label", "category", "status", "nextAction", "owner", "blockerType", "verification"]) {
      if (!gate[field]) issues.push(`data/lux-launch-readiness.json: ${gate.id || "gate"} missing ${field}`);
    }
    if (typeof gate.requiredForPublicLaunch !== "boolean") {
      issues.push(`data/lux-launch-readiness.json: ${gate.id || "gate"} missing requiredForPublicLaunch boolean`);
    }
  }
} catch (error) {
  issues.push(`data/lux-launch-readiness.json: invalid JSON (${error.message})`);
}

try {
  const legalReview = JSON.parse(legalReviewRaw);
  const items = Array.isArray(legalReview.items) ? legalReview.items : [];
  const byId = new Map(items.map((item) => [item.id, item]));
  if (legalReview.schemaVersion !== "luxveritas.legal_review.v1") {
    issues.push("data/lux-legal-review.json: schemaVersion mismatch");
  }
  if (!legalReview.updatedAt) {
    issues.push("data/lux-legal-review.json: missing updatedAt");
  }
  for (const id of ["privacy", "terms"]) {
    const item = byId.get(id);
    if (!item) {
      issues.push(`data/lux-legal-review.json: missing ${id}`);
      continue;
    }
    if (!["needs_review", "approved"].includes(item.status)) {
      issues.push(`data/lux-legal-review.json: ${id} has invalid status`);
    }
    if (!item.route || !item.version) {
      issues.push(`data/lux-legal-review.json: ${id} missing route or version`);
    }
    if (item.status === "approved" && (!item.reviewedAt || !item.reviewedBy)) {
      issues.push(`data/lux-legal-review.json: ${id} approval missing reviewer metadata`);
    }
  }
} catch (error) {
  issues.push(`data/lux-legal-review.json: invalid JSON (${error.message})`);
}

for (const marker of [
  "tools/set-approved-media-sources.mjs",
  "LUX_MEDIA_SPMVP_RELEASE_URL",
  "LUX_MEDIA_VISUAL_WORLD_URL",
  "LUX_MEDIA_LUX_RADIO_URL"
]) {
  if (!deploymentDoc.includes(marker)) issues.push(`docs/deployment.md: missing approved media setup marker ${marker}`);
}

try {
  const publicTerms = JSON.parse(publicTermsRaw);
  for (const field of ["schemaVersion", "version", "privacyVersion", "termsVersion", "submissionTermsVersion", "notice"]) {
    if (!publicTerms[field]) issues.push(`data/lux-public-terms.json: missing ${field}`);
  }
  if (publicTerms.schemaVersion !== "luxveritas.public_terms.v1") {
    issues.push("data/lux-public-terms.json: schemaVersion mismatch");
  }
} catch (error) {
  issues.push(`data/lux-public-terms.json: invalid JSON (${error.message})`);
}

if (issues.length) {
  console.error(`Public site QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Public site QA passed for ${htmlFiles.length} HTML files and ${allFiles.length} deploy files.`);
