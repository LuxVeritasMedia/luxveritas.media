import { readdir, readFile } from "node:fs/promises";
import { join, normalize, relative } from "node:path";

const root = "dist";
const issues = [];

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
  const match = attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1] || "";
}

function stripTags(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAccessibleText(attrs, inner = "") {
  return Boolean(
    attrValue(attrs, "aria-label").trim()
    || attrValue(attrs, "title").trim()
    || stripTags(inner)
  );
}

function lastIndexOfAny(text, needles) {
  return Math.max(...needles.map((needle) => text.lastIndexOf(needle)));
}

const htmlFiles = (await walk(root)).filter((file) => file.endsWith(".html"));

for (const file of htmlFiles) {
  const rel = normalize(relative(root, file));
  const html = await readFile(file, "utf8");

  if (!/^<!doctype html>/i.test(html.trim())) issues.push(`${rel}: missing doctype`);
  if (!/<html[^>]*\slang=["']en["']/i.test(html)) issues.push(`${rel}: missing html lang`);
  if (!/<title>[^<]+<\/title>/i.test(html)) issues.push(`${rel}: missing title`);
  if (!/<meta\s+name=["']description["']\s+content=["'][^"']+["']/i.test(html)) {
    issues.push(`${rel}: missing meta description`);
  }
  if (!/<a\s+class=["']skip-link["']\s+href=["']#main["']/.test(html)) {
    issues.push(`${rel}: missing skip link to #main`);
  }
  if (!/<main\b[^>]*\sid=["']main["']/.test(html)) issues.push(`${rel}: missing main#main landmark`);
  if (!/<header\b/i.test(html)) issues.push(`${rel}: missing header landmark`);
  if (!/<footer\b/i.test(html)) issues.push(`${rel}: missing footer landmark`);
  if (!/<nav\b[^>]*aria-label=["']Primary["'][^>]*id=["']primary-nav["']|<nav\b[^>]*id=["']primary-nav["'][^>]*aria-label=["']Primary["']/.test(html)) {
    issues.push(`${rel}: primary nav missing aria-label`);
  }
  if (!/<nav\b[^>]*aria-label=["']Footer["']/.test(html)) {
    issues.push(`${rel}: footer nav missing aria-label`);
  }

  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  for (const id of new Set(duplicateIds)) issues.push(`${rel}: duplicate id "${id}"`);

  for (const match of html.matchAll(/aria-controls=["']([^"']+)["']/gi)) {
    if (!ids.includes(match[1])) issues.push(`${rel}: aria-controls references missing id "${match[1]}"`);
  }

  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    if (!hasAccessibleText(match[1], match[2])) issues.push(`${rel}: button missing accessible name`);
  }

  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attrValue(match[1], "href");
    if (href && !hasAccessibleText(match[1], match[2])) issues.push(`${rel}: link ${href} missing accessible name`);
  }

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\salt\s*=/.test(match[1])) issues.push(`${rel}: image missing alt attribute`);
  }

  for (const match of html.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const type = attrValue(attrs, "type").toLowerCase();
    if (type === "hidden" || attrs.includes("honeypot") || attrValue(attrs, "aria-hidden") === "true") continue;
    if (attrValue(attrs, "aria-label") || attrValue(attrs, "aria-labelledby")) continue;
    const id = attrValue(attrs, "id");
    if (id && new RegExp(`<label\\b[^>]*for=["']${id}["']`, "i").test(html)) continue;
    const before = html.slice(0, match.index);
    const lastLabelOpen = before.lastIndexOf("<label");
    const lastLabelClose = lastIndexOfAny(before, ["</label>", "</form>", "</div>", "</section>"]);
    if (lastLabelOpen <= lastLabelClose) {
      const name = attrValue(attrs, "name") || tag;
      issues.push(`${rel}: ${tag}[name="${name}"] missing label`);
    }
  }
}

if (issues.length) {
  console.error(`Accessibility QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Accessibility QA passed for ${htmlFiles.length} HTML files.`);
