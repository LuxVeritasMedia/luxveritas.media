import { readdir, readFile } from "node:fs/promises";
import { join, normalize, relative } from "node:path";

const root = "dist";
const issues = [];
const requiredMobileSelectors = [
  ".nav-toggle",
  ".primary-nav",
  ".primary-nav.open",
  ".section-grid",
  ".card-grid",
  ".house-grid",
  ".footer-house-rail",
  ".release-rail",
  ".slate",
  ".ops-grid",
  ".portal-grid",
  ".event-grid",
  ".codex-list",
  ".split-band",
  ".cta-band",
  ".site-footer",
  ".consent-banner",
  ".media-player-section",
  ".media-player",
  ".report-grid",
  ".report-detail",
  ".report-list li"
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

function mediaBlock(css, maxWidth) {
  const marker = `@media (max-width: ${maxWidth}px)`;
  const start = css.indexOf(marker);
  if (start === -1) return "";
  const next = css.indexOf("@media", start + marker.length);
  return css.slice(start, next === -1 ? css.length : next);
}

const files = await walk(root);
const htmlFiles = files.filter((file) => file.endsWith(".html"));
const css = await readFile(join(root, "styles.css"), "utf8");
const mobileBlock = mediaBlock(css, 850);
const narrowBlock = mediaBlock(css, 430);

for (const file of htmlFiles) {
  const rel = normalize(relative(root, file));
  const html = await readFile(file, "utf8");
  if (!html.includes('name="viewport" content="width=device-width, initial-scale=1.0"')) {
    issues.push(`${rel}: missing mobile viewport metadata`);
  }
}

if (!mobileBlock) {
  issues.push("styles.css: missing max-width 850px mobile breakpoint");
} else {
  for (const selector of requiredMobileSelectors) {
    if (!mobileBlock.includes(selector)) {
      issues.push(`styles.css: mobile breakpoint does not include ${selector}`);
    }
  }
  if (!/grid-template-columns:\s*1fr/.test(mobileBlock)) {
    issues.push("styles.css: mobile breakpoint does not collapse grids to one column");
  }
  if (!mobileBlock.includes(".primary-nav.open { display: flex; }")) {
    issues.push("styles.css: mobile nav open state is missing");
  }
  if (!mobileBlock.includes(".nav-toggle { display: block; }")) {
    issues.push("styles.css: mobile nav toggle is not displayed");
  }
}

if (!narrowBlock) {
  issues.push("styles.css: missing max-width 430px narrow-phone breakpoint");
} else {
  if (!narrowBlock.includes(".hero-actions .button, .cta-actions .button { width: 100%; }")) {
    issues.push("styles.css: narrow-phone breakpoint does not stack hero/CTA buttons");
  }
}

const fragilePatterns = [
  { pattern: /width:\s*100vw/i, message: "uses width:100vw, which can cause horizontal overflow" },
  { pattern: /min-width:\s*(3[3-9]\d|[4-9]\d{2,})px/i, message: "sets a min-width wider than the smallest supported viewport" },
  { pattern: /white-space:\s*nowrap/i, message: "uses nowrap; verify mobile-safe containment" }
];

for (const { pattern, message } of fragilePatterns) {
  const matches = css.match(pattern);
  if (matches && message.includes("nowrap") && matches[0] === "white-space: nowrap") {
    if (!css.includes(".brand")) issues.push(`styles.css: ${message}`);
    continue;
  }
  if (matches && !message.includes("nowrap")) issues.push(`styles.css: ${message}`);
}

for (const selector of [".form-dialog", ".consent-banner", ".media-source-shell audio", ".media-source-shell video"]) {
  if (!css.includes(selector)) {
    issues.push(`styles.css: missing responsive container rule for ${selector}`);
  }
}

if (issues.length) {
  console.error(`Mobile layout QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Mobile layout QA passed for ${htmlFiles.length} HTML files.`);
