import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join, normalize, relative } from "node:path";

const root = "dist";
const issues = [];
const requiredFiles = [
  "index.html",
  "app.js",
  "offline.html",
  "service-worker.js",
  "styles.css",
  "robots.txt",
  "site.webmanifest",
  "sitemap.xml",
  "data/lux-launch-readiness.json",
  "data/lux-launch-closeout-public.json",
  "data/lux-brand-house.json",
  "data/lux-fan-flywheel.json",
  "data/lux-drop-room.json",
  "data/lux-portal-rooms.json",
  "data/lux-phase-status.json",
  "data/lux-media-manifest.json",
  "data/lux-build-manifest.json",
  "data/lux-action-inventory.json",
  "data/lux-legal-review.json",
  "data/lux-public-terms.json",
  "assets/luxveritas-threshold.png",
  "assets/luxveritas-icon.svg",
  "assets/lux-house-records.svg",
  "assets/lux-house-studios.svg",
  "assets/lux-house-publishing.svg",
  "assets/lux-house-live.svg",
  "assets/lux-house-circle.svg",
  "assets/lux-house-atelier.svg",
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
  "private-steward.html",
  "brands/index.html",
  "brands/sample.html",
  "investor.html",
  "legal/privacy.html",
  "legal/terms.html",
  "offline.html"
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

function metaContent(html, name) {
  const nameMatch = html.match(new RegExp(`<meta\\b(?=[^>]*(?:name|property)=["']${name}["'])[^>]*content=["']([^"']+)["'][^>]*>`, "i"));
  if (nameMatch) return nameMatch[1];
  const contentFirst = html.match(new RegExp(`<meta\\b(?=[^>]*content=["']([^"']+)["'])(?=[^>]*(?:name|property)=["']${name}["'])[^>]*>`, "i"));
  return contentFirst?.[1] || "";
}

function canonicalFor(rel) {
  const clean = rel === "index.html"
    ? "/"
    : `/${rel.replace(/\/index\.html$/, "/")}`;
  return `https://luxveritas.media${clean}`;
}

function scriptJsonLd(html) {
  const match = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  return match?.[1]?.trim() || "";
}

function linkHref(html, rel) {
  return html.match(new RegExp(`<link\\b(?=[^>]*rel=["']${rel}["'])[^>]*href=["']([^"']+)["'][^>]*>`, "i"))?.[1] || "";
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

  if (["index.html", "about.html"].includes(rel)) {
    if (!html.includes("data-brand-house")) {
      issues.push(`${rel}: missing public brand-house section`);
    }
    for (const mark of ["LVR", "LVS", "LVP", "LVL", "LVC", "LVA"]) {
      if (!html.includes("class=\"house-mark\"") || !html.includes(`<span>${mark}</span>`)) {
        issues.push(`${rel}: missing house mark ${mark}`);
      }
    }
  }

  if (noindexRoutes.includes(rel) && !html.includes('name="robots" content="noindex, nofollow"')) {
    issues.push(`${rel}: expected noindex metadata`);
  }

  const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] || "";
  if (canonical !== canonicalFor(rel)) {
    issues.push(`${rel}: canonical URL mismatch (${canonical || "missing"})`);
  }
  for (const property of ["og:title", "og:description", "og:type", "og:url", "og:image"]) {
    if (!metaContent(html, property)) issues.push(`${rel}: missing ${property}`);
  }
  for (const name of ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]) {
    if (!metaContent(html, name)) issues.push(`${rel}: missing ${name}`);
  }
  for (const name of ["theme-color", "application-name", "apple-mobile-web-app-title", "apple-mobile-web-app-capable"]) {
    if (!metaContent(html, name)) issues.push(`${rel}: missing ${name}`);
  }
  if (!linkHref(html, "manifest").endsWith("site.webmanifest")) {
    issues.push(`${rel}: missing web app manifest link`);
  }
  if (!linkHref(html, "apple-touch-icon").endsWith("assets/luxveritas-icon.svg")) {
    issues.push(`${rel}: missing apple touch icon link`);
  }
  if (metaContent(html, "og:url") !== canonical) {
    issues.push(`${rel}: og:url does not match canonical`);
  }
  for (const imageField of ["og:image", "twitter:image"]) {
    const image = metaContent(html, imageField);
    if (image && !/^https:\/\/luxveritas\.media\/assets\//.test(image)) {
      issues.push(`${rel}: ${imageField} is not an absolute Lux Veritas asset URL`);
    }
  }
  const jsonLdRaw = scriptJsonLd(html);
  if (!jsonLdRaw) {
    issues.push(`${rel}: missing JSON-LD structured data`);
  } else {
    try {
      const structuredData = JSON.parse(jsonLdRaw);
      const graph = Array.isArray(structuredData["@graph"]) ? structuredData["@graph"] : [];
      const types = new Set(graph.map((item) => item["@type"]));
      for (const type of ["Organization", "WebSite", "WebPage", "SiteNavigationElement"]) {
        if (!types.has(type)) issues.push(`${rel}: JSON-LD missing ${type}`);
      }
      const page = graph.find((item) => item["@type"] === "WebPage");
      if (page?.url !== canonical || page?.["@id"] !== `${canonical}#webpage`) {
        issues.push(`${rel}: JSON-LD WebPage URL does not match canonical`);
      }
      const navData = graph.find((item) => item["@type"] === "SiteNavigationElement");
      if (!Array.isArray(navData?.name) || navData.name.join("|") !== expectedNav.join("|")) {
        issues.push(`${rel}: JSON-LD navigation labels mismatch`);
      }
    } catch (error) {
      issues.push(`${rel}: invalid JSON-LD (${error.message})`);
    }
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
    if (!html.includes('data-interest-paths')) issues.push("index.html: missing interest path fieldset");
    for (const interest of ["music", "film", "events", "drops", "community", "codex", "create"]) {
      if (!html.includes(`name="interest_paths" value="${interest}"`)) {
        issues.push(`index.html: missing interest path ${interest}`);
      }
    }
    for (const intent of ["flywheel_listen", "flywheel_watch", "flywheel_join", "flywheel_attend", "flywheel_collect", "flywheel_create"]) {
      if (!html.includes(`data-track-intent="${intent}"`)) {
        issues.push(`index.html: missing fan-flywheel tracking intent ${intent}`);
      }
    }
    for (const intent of ["house_lvr", "house_lvs", "house_lvp", "house_lvl", "house_lvc", "house_lva"]) {
      if (!html.includes(`data-track-intent="${intent}"`)) {
        issues.push(`index.html: missing brand-house tracking intent ${intent}`);
      }
    }
    for (const surface of ["fan_flywheel", "brand_house"]) {
      if (!html.includes(`data-track-surface="${surface}"`)) {
        issues.push(`index.html: missing tracking surface ${surface}`);
      }
    }
  }
}

const appJs = await readFile(join(root, "app.js"), "utf8");
for (const pattern of bannedTerms) {
  if (pattern.test(appJs)) issues.push(`app.js: banned public term matched ${pattern}`);
}
for (const marker of ['"serviceWorker" in navigator', 'navigator.serviceWorker.register("/service-worker.js")']) {
  if (!appJs.includes(marker)) issues.push(`app.js: missing service worker registration marker ${marker}`);
}
for (const marker of ["trackSurface", "trackIntent", "trackLabel"]) {
  if (!appJs.includes(marker)) issues.push(`app.js: missing path tracking marker ${marker}`);
}

const serviceWorkerRaw = await readFile(join(root, "service-worker.js"), "utf8");
for (const pattern of bannedTerms) {
  if (pattern.test(serviceWorkerRaw)) issues.push(`service-worker.js: banned public term matched ${pattern}`);
}
for (const marker of ["luxveritas-static-", "/offline.html", "/site.webmanifest", "/assets/luxveritas-icon.svg", "request.mode === \"navigate\"", "/api/"]) {
  if (!serviceWorkerRaw.includes(marker)) issues.push(`service-worker.js: missing offline marker ${marker}`);
}

const brandHouseRaw = await readFile(join(root, "data/lux-brand-house.json"), "utf8");
const fanFlywheelRaw = await readFile(join(root, "data/lux-fan-flywheel.json"), "utf8");
const dropRoomRaw = await readFile(join(root, "data/lux-drop-room.json"), "utf8");
const portalRoomsRaw = await readFile(join(root, "data/lux-portal-rooms.json"), "utf8");
const phaseStatusRaw = await readFile(join(root, "data/lux-phase-status.json"), "utf8");
const mediaManifestRaw = await readFile(join(root, "data/lux-media-manifest.json"), "utf8");
const buildManifestRaw = await readFile(join(root, "data/lux-build-manifest.json"), "utf8");
const actionInventoryRaw = await readFile(join(root, "data/lux-action-inventory.json"), "utf8");
const webManifestRaw = await readFile(join(root, "site.webmanifest"), "utf8");
const deploymentDoc = await readFile("docs/deployment.md", "utf8");
const launchReadinessRaw = await readFile(join(root, "data/lux-launch-readiness.json"), "utf8");
const launchCloseoutRaw = await readFile(join(root, "data/lux-launch-closeout-public.json"), "utf8");
const legalReviewRaw = await readFile(join(root, "data/lux-legal-review.json"), "utf8");
const publicTermsRaw = await readFile(join(root, "data/lux-public-terms.json"), "utf8");
for (const pattern of bannedTerms) {
  if (pattern.test(buildManifestRaw)) issues.push(`data/lux-build-manifest.json: banned public term matched ${pattern}`);
  if (pattern.test(actionInventoryRaw)) issues.push(`data/lux-action-inventory.json: banned public term matched ${pattern}`);
  if (pattern.test(webManifestRaw)) issues.push(`site.webmanifest: banned public term matched ${pattern}`);
  if (pattern.test(launchReadinessRaw)) issues.push(`data/lux-launch-readiness.json: banned public term matched ${pattern}`);
  if (pattern.test(launchCloseoutRaw)) issues.push(`data/lux-launch-closeout-public.json: banned public term matched ${pattern}`);
  if (pattern.test(brandHouseRaw)) issues.push(`data/lux-brand-house.json: banned public term matched ${pattern}`);
  if (pattern.test(fanFlywheelRaw)) issues.push(`data/lux-fan-flywheel.json: banned public term matched ${pattern}`);
  if (pattern.test(dropRoomRaw)) issues.push(`data/lux-drop-room.json: banned public term matched ${pattern}`);
  if (pattern.test(portalRoomsRaw)) issues.push(`data/lux-portal-rooms.json: banned public term matched ${pattern}`);
  if (pattern.test(phaseStatusRaw)) issues.push(`data/lux-phase-status.json: banned public term matched ${pattern}`);
  if (pattern.test(mediaManifestRaw)) issues.push(`data/lux-media-manifest.json: banned public term matched ${pattern}`);
  if (pattern.test(legalReviewRaw)) issues.push(`data/lux-legal-review.json: banned public term matched ${pattern}`);
  if (pattern.test(publicTermsRaw)) issues.push(`data/lux-public-terms.json: banned public term matched ${pattern}`);
}

try {
  const webManifest = JSON.parse(webManifestRaw);
  if (webManifest.name !== "Lux Veritas" || webManifest.short_name !== "Lux Veritas") {
    issues.push("site.webmanifest: expected Lux Veritas name and short_name");
  }
  if (webManifest.start_url !== "/index.html" || webManifest.scope !== "/" || webManifest.display !== "standalone") {
    issues.push("site.webmanifest: expected start_url /index.html, scope /, and standalone display");
  }
  if (webManifest.theme_color !== "#060807" || webManifest.background_color !== "#060807") {
    issues.push("site.webmanifest: expected Lux Veritas theme/background color");
  }
  const icons = Array.isArray(webManifest.icons) ? webManifest.icons : [];
  const icon = icons.find((item) => item.src === "/assets/luxveritas-icon.svg");
  if (!icon || icon.type !== "image/svg+xml" || !String(icon.purpose || "").includes("maskable")) {
    issues.push("site.webmanifest: expected maskable SVG Lux Veritas icon");
  }
} catch (error) {
  issues.push(`site.webmanifest: invalid JSON (${error.message})`);
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
  if (!buildManifest.publicRouteCount || !buildManifest.mediaManifestVersion || !buildManifest.actionInventoryVersion || !buildManifest.brandHouseVersion || !buildManifest.fanFlywheelVersion || !buildManifest.dropRoomVersion || !buildManifest.portalRoomsVersion || !buildManifest.phaseStatusVersion || !buildManifest.publicTermsVersion) {
    issues.push("data/lux-build-manifest.json: missing publicRouteCount, mediaManifestVersion, actionInventoryVersion, brandHouseVersion, fanFlywheelVersion, dropRoomVersion, portalRoomsVersion, phaseStatusVersion, or publicTermsVersion");
  }
} catch (error) {
  issues.push(`data/lux-build-manifest.json: invalid JSON (${error.message})`);
}

try {
  const brandHouse = JSON.parse(brandHouseRaw);
  const marks = Array.isArray(brandHouse.houseMarks) ? brandHouse.houseMarks : [];
  if (brandHouse.schemaVersion !== "luxveritas.brand_house.v1") {
    issues.push("data/lux-brand-house.json: missing schemaVersion luxveritas.brand_house.v1");
  }
  if (!brandHouse.version || !brandHouse.headline || !brandHouse.summary) {
    issues.push("data/lux-brand-house.json: missing version, headline, or summary");
  }
  if (marks.length !== 6) {
    issues.push(`data/lux-brand-house.json: expected 6 house marks, found ${marks.length}`);
  }
  const expectedMarks = new Set(["LVR", "LVS", "LVP", "LVL", "LVC", "LVA"]);
  for (const item of marks) {
    if (!expectedMarks.has(item.mark)) issues.push(`data/lux-brand-house.json: unexpected house mark ${item.mark || "missing"}`);
    for (const field of ["title", "body", "path", "action", "logo"]) {
      if (!item[field]) issues.push(`data/lux-brand-house.json: ${item.mark || "item"} missing ${field}`);
    }
    if (item.path && (!item.path.startsWith("/") || !item.path.endsWith(".html"))) {
      issues.push(`data/lux-brand-house.json: ${item.mark || "item"} has invalid public path`);
    }
    if (item.logo && (!item.logo.startsWith("/assets/") || !item.logo.endsWith(".svg"))) {
      issues.push(`data/lux-brand-house.json: ${item.mark || "item"} has invalid logo path`);
    }
    if (item.logo) {
      try {
        await access(join(root, item.logo.replace(/^\//, "")));
      } catch {
        issues.push(`data/lux-brand-house.json: ${item.mark || "item"} logo missing from deploy artifact`);
      }
    }
  }
  for (const rel of ["index.html", "about.html"]) {
    const html = await readFile(join(root, rel), "utf8");
    if (!html.includes(`data-brand-house-version="${brandHouse.version}"`)) {
      issues.push(`${rel}: missing brand house version ${brandHouse.version}`);
    }
    for (const item of marks) {
      if (!html.includes("class=\"house-mark\"") || !html.includes(`<span>${item.mark}</span>`)) {
        issues.push(`${rel}: missing brand manifest mark ${item.mark}`);
      }
      if (item.logo && !html.includes(`src="${item.logo}"`)) {
        issues.push(`${rel}: missing brand logo ${item.logo}`);
      }
      if (!html.includes(`<small>${item.action}</small>`)) {
        issues.push(`${rel}: missing brand manifest action ${item.action}`);
      }
    }
  }
} catch (error) {
  issues.push(`data/lux-brand-house.json: invalid JSON (${error.message})`);
}

try {
  const fanFlywheel = JSON.parse(fanFlywheelRaw);
  const stages = Array.isArray(fanFlywheel.stages) ? fanFlywheel.stages : [];
  if (fanFlywheel.schemaVersion !== "luxveritas.fan_flywheel.v1") {
    issues.push("data/lux-fan-flywheel.json: missing schemaVersion luxveritas.fan_flywheel.v1");
  }
  if (!fanFlywheel.version || !fanFlywheel.headline || !fanFlywheel.summary) {
    issues.push("data/lux-fan-flywheel.json: missing version, headline, or summary");
  }
  const expectedStages = ["listen", "watch", "join", "attend", "collect", "create"];
  const stageIds = stages.map((stage) => stage.id);
  if (stageIds.join("|") !== expectedStages.join("|")) {
    issues.push(`data/lux-fan-flywheel.json: expected stages ${expectedStages.join(", ")}, found ${stageIds.join(", ")}`);
  }
  for (const stage of stages) {
    for (const field of ["id", "label", "title", "body", "path", "action"]) {
      if (!stage[field]) issues.push(`data/lux-fan-flywheel.json: ${stage.id || "stage"} missing ${field}`);
    }
    if (stage.path && (!stage.path.startsWith("/") || !stage.path.endsWith(".html"))) {
      issues.push(`data/lux-fan-flywheel.json: ${stage.id || "stage"} has invalid public path`);
    }
  }
  for (const rel of ["index.html", "join.html", "membership.html", "store.html", "community.html"]) {
    const html = await readFile(join(root, rel), "utf8");
    if (!html.includes(`data-fan-flywheel-version="${fanFlywheel.version}"`)) {
      issues.push(`${rel}: missing fan flywheel version ${fanFlywheel.version}`);
    }
    for (const stage of stages) {
      if (!html.includes(`data-fan-flywheel-stage="${stage.id}"`)) {
        issues.push(`${rel}: missing fan flywheel stage ${stage.id}`);
      }
      if (!html.includes(`<small>${stage.action}</small>`)) {
        issues.push(`${rel}: missing fan flywheel action ${stage.action}`);
      }
    }
  }
} catch (error) {
  issues.push(`data/lux-fan-flywheel.json: invalid JSON (${error.message})`);
}

try {
  const dropRoom = JSON.parse(dropRoomRaw);
  const drops = Array.isArray(dropRoom.drops) ? dropRoom.drops : [];
  if (dropRoom.schemaVersion !== "luxveritas.drop_room.v1") {
    issues.push("data/lux-drop-room.json: missing schemaVersion luxveritas.drop_room.v1");
  }
  if (dropRoom.commerceMode !== "waitlist_only") {
    issues.push("data/lux-drop-room.json: commerceMode must remain waitlist_only before commerce terms are approved");
  }
  if (!dropRoom.version || !dropRoom.headline || !dropRoom.summary || !dropRoom.notice) {
    issues.push("data/lux-drop-room.json: missing version, headline, summary, or notice");
  }
  if (!/No purchase is accepted/i.test(dropRoom.notice || "")) {
    issues.push("data/lux-drop-room.json: notice must state no purchase is accepted");
  }
  const expectedDrops = ["release-object", "visual-edition", "live-room-access", "atelier-piece"];
  const dropIds = drops.map((drop) => drop.id);
  if (dropIds.join("|") !== expectedDrops.join("|")) {
    issues.push(`data/lux-drop-room.json: expected drops ${expectedDrops.join(", ")}, found ${dropIds.join(", ")}`);
  }
  for (const drop of drops) {
    for (const field of ["id", "label", "title", "body", "status", "path", "action"]) {
      if (!drop[field]) issues.push(`data/lux-drop-room.json: ${drop.id || "drop"} missing ${field}`);
    }
    if (!["waitlist", "request_access"].includes(drop.status)) {
      issues.push(`data/lux-drop-room.json: ${drop.id || "drop"} has invalid status`);
    }
    if (drop.path && (!drop.path.startsWith("/") || !drop.path.endsWith(".html"))) {
      issues.push(`data/lux-drop-room.json: ${drop.id || "drop"} has invalid public path`);
    }
  }
  for (const rel of ["store.html", "membership.html"]) {
    const html = await readFile(join(root, rel), "utf8");
    if (!html.includes(`data-drop-room-version="${dropRoom.version}"`)) {
      issues.push(`${rel}: missing drop room version ${dropRoom.version}`);
    }
    if (!html.includes('data-commerce-mode="waitlist_only"')) {
      issues.push(`${rel}: missing waitlist-only commerce mode`);
    }
    if (!html.includes(dropRoom.notice)) {
      issues.push(`${rel}: missing drop room no-purchase notice`);
    }
    for (const drop of drops) {
      if (!html.includes(`data-drop-id="${drop.id}"`)) {
        issues.push(`${rel}: missing drop room item ${drop.id}`);
      }
      if (!html.includes(`data-drop-status="${drop.status}"`)) {
        issues.push(`${rel}: missing drop room status ${drop.status}`);
      }
    }
  }
} catch (error) {
  issues.push(`data/lux-drop-room.json: invalid JSON (${error.message})`);
}

try {
  const portalRooms = JSON.parse(portalRoomsRaw);
  const rooms = Array.isArray(portalRooms.rooms) ? portalRooms.rooms : [];
  if (portalRooms.schemaVersion !== "luxveritas.portal_rooms.v1") {
    issues.push("data/lux-portal-rooms.json: missing schemaVersion luxveritas.portal_rooms.v1");
  }
  if (portalRooms.accessMode !== "request_access_only") {
    issues.push("data/lux-portal-rooms.json: accessMode must remain request_access_only before auth is approved");
  }
  if (!portalRooms.version || !portalRooms.headline || !portalRooms.summary || !portalRooms.notice) {
    issues.push("data/lux-portal-rooms.json: missing version, headline, summary, or notice");
  }
  if (!/No account, payment, entitlement, or private room is activated/i.test(portalRooms.notice || "")) {
    issues.push("data/lux-portal-rooms.json: notice must state no account, payment, entitlement, or private room is activated");
  }
  const expectedRooms = ["member", "artist", "creator", "press", "partner", "investor", "operator"];
  const roomIds = rooms.map((room) => room.id);
  if (roomIds.join("|") !== expectedRooms.join("|")) {
    issues.push(`data/lux-portal-rooms.json: expected rooms ${expectedRooms.join(", ")}, found ${roomIds.join(", ")}`);
  }
  for (const room of rooms) {
    for (const field of ["id", "label", "title", "body", "status", "roleTarget", "path", "action"]) {
      if (!room[field]) issues.push(`data/lux-portal-rooms.json: ${room.id || "room"} missing ${field}`);
    }
    if (!["request_access", "approved_operator_only"].includes(room.status)) {
      issues.push(`data/lux-portal-rooms.json: ${room.id || "room"} has invalid status`);
    }
    if (room.path && (!room.path.startsWith("/") || !room.path.endsWith(".html"))) {
      issues.push(`data/lux-portal-rooms.json: ${room.id || "room"} has invalid public path`);
    }
    if (room.id !== "operator" && !room.formType) {
      issues.push(`data/lux-portal-rooms.json: ${room.id || "room"} missing formType`);
    }
  }
  const portalHtml = await readFile(join(root, "portal/index.html"), "utf8");
  if (!portalHtml.includes(`data-portal-rooms-version="${portalRooms.version}"`)) {
    issues.push(`portal/index.html: missing portal rooms version ${portalRooms.version}`);
  }
  if (!portalHtml.includes('data-access-mode="request_access_only"')) {
    issues.push("portal/index.html: missing request-access-only portal access mode");
  }
  for (const room of rooms) {
    if (!portalHtml.includes(`data-portal-room="${room.id}"`)) {
      issues.push(`portal/index.html: missing portal room ${room.id}`);
    }
    if (!portalHtml.includes(`data-portal-role="${room.roleTarget}"`)) {
      issues.push(`portal/index.html: missing portal role ${room.roleTarget}`);
    }
    if (!portalHtml.includes(`data-portal-room-status="${room.status}"`)) {
      issues.push(`portal/index.html: missing portal room status ${room.status}`);
    }
    if (room.formType && !portalHtml.includes(`data-open-form="${room.formType}"`)) {
      issues.push(`portal/index.html: missing portal form trigger ${room.formType}`);
    }
  }
} catch (error) {
  issues.push(`data/lux-portal-rooms.json: invalid JSON (${error.message})`);
}

try {
  const phaseStatus = JSON.parse(phaseStatusRaw);
  const currentPhase = phaseStatus.currentPhase || {};
  const activeWorkstreams = Array.isArray(phaseStatus.activeWorkstreams) ? phaseStatus.activeWorkstreams : [];
  const deferredBoundaries = Array.isArray(phaseStatus.deferredBoundaries) ? phaseStatus.deferredBoundaries : [];
  if (phaseStatus.schemaVersion !== "luxveritas.phase_status.v1") {
    issues.push("data/lux-phase-status.json: missing schemaVersion luxveritas.phase_status.v1");
  }
  if (phaseStatus.version !== "2026-06-20-phase-status") {
    issues.push("data/lux-phase-status.json: version mismatch");
  }
  if (currentPhase.id !== "phase-5" || currentPhase.status !== "active_pilot") {
    issues.push("data/lux-phase-status.json: currentPhase must be phase-5 active_pilot");
  }
  if (!/Full public release is still blocked by Privacy and Terms approval/i.test(currentPhase.summary || "")) {
    issues.push("data/lux-phase-status.json: current phase summary must name Privacy and Terms approval as launch blockers");
  }
  for (const blocker of ["privacy_review", "terms_review"]) {
    if (!phaseStatus.publicLaunchBlockers?.includes(blocker)) {
      issues.push(`data/lux-phase-status.json: missing public launch blocker ${blocker}`);
    }
  }
  if (!Array.isArray(phaseStatus.codeConfigBlockers) || phaseStatus.codeConfigBlockers.length !== 0) {
    issues.push("data/lux-phase-status.json: codeConfigBlockers must be empty for current pilot status");
  }
  for (const workstreamId of ["phase-4-closeout", "phase-5-portal-shell", "phase-6-intake-routing", "media-mvp"]) {
    if (!activeWorkstreams.some((item) => item.id === workstreamId)) {
      issues.push(`data/lux-phase-status.json: missing active workstream ${workstreamId}`);
    }
  }
  if (!deferredBoundaries.some((item) => item.id === "internal-bridge" && item.status === "deferred")) {
    issues.push("data/lux-phase-status.json: internal bridge must remain deferred");
  }
} catch (error) {
  issues.push(`data/lux-phase-status.json: invalid JSON (${error.message})`);
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
  const launchCloseout = JSON.parse(launchCloseoutRaw);
  const items = Array.isArray(launchCloseout.items) ? launchCloseout.items : [];
  if (launchCloseout.schemaVersion !== "luxveritas.launch_closeout_public.v1") {
    issues.push("data/lux-launch-closeout-public.json: schemaVersion mismatch");
  }
  if (!launchCloseout.updatedAt) {
    issues.push("data/lux-launch-closeout-public.json: missing updatedAt");
  }
  for (const id of ["www_redirect", "inbox_notifications", "privacy_review", "terms_review"]) {
    if (!items.some((item) => item.id === id)) {
      issues.push(`data/lux-launch-closeout-public.json: missing ${id}`);
    }
  }
  for (const item of items) {
    for (const field of ["id", "gateId", "label", "status", "owner"]) {
      if (!item[field]) issues.push(`data/lux-launch-closeout-public.json: ${item.id || "item"} missing ${field}`);
    }
    if (!["open", "closed", "blocked"].includes(item.status)) {
      issues.push(`data/lux-launch-closeout-public.json: ${item.id || "item"} has invalid status`);
    }
  }
  if (/commands|requiredEvidence|RESEND_API_KEY|firebase login|Secret Manager/i.test(launchCloseoutRaw)) {
    issues.push("data/lux-launch-closeout-public.json: contains operator-only closeout fields");
  }
} catch (error) {
  issues.push(`data/lux-launch-closeout-public.json: invalid JSON (${error.message})`);
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
