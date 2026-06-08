import { access, readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = "dist";
const issues = [];
const requiredFiles = ["index.html", "app.js", "styles.css", "assets/luxveritas-threshold.png"];
const actionAttributes = [
  "data-open-form",
  "data-close-dialog",
  "data-nav-toggle",
  "data-consent",
  "data-track",
  "data-media-action",
  "data-media-item",
  "data-portal-signin",
  "data-report-action",
  "data-submit-form"
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

function attrValue(attrs, name) {
  const match = attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] || "";
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

for (const file of requiredFiles) {
  try {
    await access(join(root, file));
  } catch {
    issues.push(`Missing required deploy file: ${file}`);
  }
}

const files = (await walk(root)).filter((file) => file.endsWith(".html"));

for (const file of files) {
  const rel = relative(root, file);
  const html = await readFile(file, "utf8");

  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const attrs = match[1];
    const label = stripTags(match[2]) || "(icon button)";
    const type = attrValue(attrs, "type").toLowerCase();
    const hasAction = actionAttributes.some((attr) => attrs.includes(attr));
    const isSubmit = type === "submit";

    if (!hasAction && !isSubmit) {
      issues.push(`${rel}: button "${label}" has no recognized action attribute`);
    }
  }

  for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
    const href = attrValue(match[1], "href");
    if (href === "#") {
      issues.push(`${rel}: link uses href="#"`);
    }
  }

  if (["music.html", "spmvp.html"].includes(rel)) {
    if (!html.includes("data-media-player")) {
      issues.push(`${rel}: missing media player`);
    }
    for (const action of ["play", "watch", "radio"]) {
      if (!html.includes(`data-media-action="${action}"`)) {
        issues.push(`${rel}: missing media action "${action}"`);
      }
    }
  }
}

if (issues.length) {
  console.error(`Button QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Button QA passed for ${files.length} HTML files.`);
