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
const appJs = await readFile(join(root, "app.js"), "utf8");

if (!appJs.includes('result.delivery === "stored"')) {
  issues.push("app.js: stored form submissions are not handled as accepted");
}
if (!appJs.includes("Received. Thank you. Your request is recorded with Lux Veritas.")) {
  issues.push("app.js: missing stored-submission success message");
}
if (!appJs.includes('const submitEndpoint = "/api/submit";')) {
  issues.push("app.js: missing server-side form endpoint");
}
for (const marker of ["submitTimeoutMs", "submission_timeout", "showSubmissionError"]) {
  if (!appJs.includes(marker)) {
    issues.push(`app.js: missing bounded form-submit marker ${marker}`);
  }
}
for (const marker of ['trackInteraction("form_open"', 'trackInteraction("link_click"', 'trackInteraction("report_action"']) {
  if (!appJs.includes(marker)) {
    issues.push(`app.js: missing interaction reporting marker ${marker}`);
  }
}
if (!appJs.includes("renderPrivateSummary")) {
  issues.push("app.js: missing private report summary rendering");
}
if (!appJs.includes("renderPrivateDelivery")) {
  issues.push("app.js: missing private delivery readiness rendering");
}
for (const marker of ["privateReportCache", "exportPrivateReport", "exportLocalReportCsv", "rowsToCsv"]) {
  if (!appJs.includes(marker)) {
    issues.push(`app.js: missing report export marker ${marker}`);
  }
}
for (const marker of ["showMediaFollowup", "media_followup_offered"]) {
  if (!appJs.includes(marker)) {
    issues.push(`app.js: missing media follow-up marker ${marker}`);
  }
}
for (const marker of [
  'rolePath: "Member"',
  'inquiryType: "Membership"',
  'rolePath: "Investor"',
  'inquiryType: "Investor"',
  'rolePath: "Partner"',
  'inquiryType: "Licensing"',
  'rolePath: "Creator"'
]) {
  if (!appJs.includes(marker)) {
    issues.push(`app.js: missing form intent default ${marker}`);
  }
}

for (const file of files) {
  const rel = relative(root, file);
  const html = await readFile(file, "utf8");

  if (/action\s*=\s*["']mailto:/i.test(html)) {
    issues.push(`${rel}: form action still uses mailto`);
  }
  if (/href\s*=\s*["']mailto:/i.test(html)) {
    issues.push(`${rel}: static link still uses mailto`);
  }

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
    if (!html.includes("data-media-followup")) {
      issues.push(`${rel}: missing media follow-up conversion module`);
    }
    for (const action of ["play", "watch", "radio"]) {
      if (!html.includes(`data-media-action="${action}"`)) {
        issues.push(`${rel}: missing media action "${action}"`);
      }
    }
  }

  if (rel === "portal/reporting.html") {
    if (!html.includes('data-private-delivery="status"')) {
      issues.push(`${rel}: missing private delivery readiness tile`);
    }
    if (!html.includes("data-media-readiness-summary") || !html.includes("data-media-readiness-list")) {
      issues.push(`${rel}: missing media readiness report`);
    }
    if (!html.includes("data-private-funnel")) {
      issues.push(`${rel}: missing private pilot funnel report`);
    }
    for (const action of ["export-private-json", "export-private-csv", "export-csv"]) {
      if (!html.includes(`data-report-action="${action}"`)) {
        issues.push(`${rel}: missing report export action "${action}"`);
      }
    }
    for (const summary of ["forms", "roles", "integrations", "events", "destinations"]) {
      if (!html.includes(`data-private-summary="${summary}"`)) {
        issues.push(`${rel}: missing private summary "${summary}"`);
      }
    }
  }

  const routeIntentChecks = {
    "join.html": 'data-open-form="fan"',
    "investor.html": 'data-open-form="investor"',
    "portal/index.html": 'data-portal-role="member"',
    "portal/library.html": 'data-open-form="creator"',
    "portal/releases.html": 'data-open-form="licensing"',
    "submissions.html": 'data-open-form="submission"',
    "membership.html": 'data-open-form="fan"'
  };
  if (routeIntentChecks[rel] && !html.includes(routeIntentChecks[rel])) {
    issues.push(`${rel}: missing ${routeIntentChecks[rel]}`);
  }
}

if (issues.length) {
  console.error(`Button QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Button QA passed for ${files.length} HTML files.`);
