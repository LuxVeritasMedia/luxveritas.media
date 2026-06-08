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
  "data/lux-media-manifest.json",
  "assets/luxveritas-threshold.png"
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

  if (["music.html", "spmvp.html"].includes(rel)) {
    if (!html.includes("data-media-player")) issues.push(`${rel}: missing Lux Player`);
    for (const action of ["play", "watch", "radio"]) {
      if (!html.includes(`data-media-action="${action}"`)) issues.push(`${rel}: missing media action ${action}`);
    }
  }
}

const appJs = await readFile(join(root, "app.js"), "utf8");
for (const pattern of bannedTerms) {
  if (pattern.test(appJs)) issues.push(`app.js: banned public term matched ${pattern}`);
}

const mediaManifestRaw = await readFile(join(root, "data/lux-media-manifest.json"), "utf8");
for (const pattern of bannedTerms) {
  if (pattern.test(mediaManifestRaw)) issues.push(`data/lux-media-manifest.json: banned public term matched ${pattern}`);
}

try {
  const mediaManifest = JSON.parse(mediaManifestRaw);
  const items = Array.isArray(mediaManifest.items) ? mediaManifest.items : [];
  const kinds = new Set(items.map((item) => item.kind));
  for (const kind of ["release", "visual", "radio"]) {
    if (!kinds.has(kind)) issues.push(`data/lux-media-manifest.json: missing media kind ${kind}`);
  }
  for (const item of items) {
    if (!item.id || !item.title || !item.kind || !item.status) {
      issues.push(`data/lux-media-manifest.json: item is missing required public fields`);
    }
    if (!Array.isArray(item.contexts) || !item.contexts.length) {
      issues.push(`data/lux-media-manifest.json: ${item.id || "item"} missing contexts`);
    }
    if (item.sourceUrl && !/^https:\/\//i.test(item.sourceUrl)) {
      issues.push(`data/lux-media-manifest.json: ${item.id || "item"} has non-HTTPS sourceUrl`);
    }
    if (item.posterUrl && !/^https:\/\//i.test(item.posterUrl) && !item.posterUrl.startsWith("/assets/")) {
      issues.push(`data/lux-media-manifest.json: ${item.id || "item"} has invalid posterUrl`);
    }
  }
} catch (error) {
  issues.push(`data/lux-media-manifest.json: invalid JSON (${error.message})`);
}

if (issues.length) {
  console.error(`Public site QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Public site QA passed for ${htmlFiles.length} HTML files and ${allFiles.length} deploy files.`);
