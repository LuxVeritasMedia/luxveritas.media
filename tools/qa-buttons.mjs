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
  "data-fan-reaction",
  "data-media-item",
  "data-fan-signal-export",
  "data-portal-signin",
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
for (const marker of ["portalSigninPayload", 'formType: "portal_signin"', "Portal access request recorded", "portal_signin_capture"]) {
  if (!appJs.includes(marker)) {
    issues.push(`app.js: missing portal sign-in capture marker ${marker}`);
  }
}
for (const marker of ['trackInteraction("form_open"', 'trackInteraction("link_click"']) {
  if (!appJs.includes(marker)) {
    issues.push(`app.js: missing interaction reporting marker ${marker}`);
  }
}
for (const marker of ['trackInteraction("media_select"', 'trackInteraction("dialog_close"', 'trackInteraction("consent_update"']) {
  if (!appJs.includes(marker)) {
    issues.push(`app.js: missing button reporting marker ${marker}`);
  }
}
for (const marker of ["public_terms_version", "privacy_version", "terms_version", "submission_terms_version"]) {
  if (!appJs.includes(marker)) {
    issues.push(`app.js: missing legal version marker ${marker}`);
  }
}
for (const marker of ["showMediaFollowup", "media_followup_offered"]) {
  if (!appJs.includes(marker)) {
    issues.push(`app.js: missing media follow-up marker ${marker}`);
  }
}
for (const marker of ["source_status", "source_ready", "source_required", "reporting_key", "data-source-status", "data-reporting-key"]) {
  if (!appJs.includes(marker)) {
    issues.push(`app.js: missing media reporting marker ${marker}`);
  }
}
for (const marker of ["cta_id", "interactionId", "interactionIntent", "slugify"]) {
  if (!appJs.includes(marker)) {
    issues.push(`app.js: missing stable CTA reporting marker ${marker}`);
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
    if (!html.includes('id="lux-player"')) {
      issues.push(`${rel}: missing direct operator review anchor lux-player`);
    }
    if (!html.includes("data-media-followup")) {
      issues.push(`${rel}: missing media follow-up conversion module`);
    }
    for (const action of ["play", "watch", "radio"]) {
      if (!html.includes(`data-media-action="${action}"`)) {
        issues.push(`${rel}: missing media action "${action}"`);
      }
    }
    for (const marker of ["data-source-status", "data-source-required", "data-reporting-key", "data-fallback-form-type"]) {
      if (!html.includes(marker)) {
        issues.push(`${rel}: missing media contract marker ${marker}`);
      }
    }
  }

  if (rel === "music.html") {
    if (!html.includes('id="lux-radio"')) {
      issues.push(`${rel}: missing direct operator review anchor lux-radio`);
    }
    if (!/<div class="hero-actions">[\s\S]*data-media-action="play"[\s\S]*data-media-action="watch"[\s\S]*data-open-form="fan"[\s\S]*<\/div>/i.test(html)) {
      issues.push(`${rel}: hero Listen/Watch/Join CTAs must route to player play, player watch, and fan capture`);
    }
  }

  if (rel === "portal/reporting.html") {
    if (!html.includes("No activity records, launch controls, workflow details, or operator tools are published on this route.")) {
      issues.push(`${rel}: missing private reporting boundary copy`);
    }
    for (const marker of ["data-private-report", "data-report-action", "data-action-inventory", "data-launch-readiness"]) {
      if (html.includes(marker)) {
        issues.push(`${rel}: must not expose operator marker ${marker}`);
      }
    }
  }

  if (rel === "index.html") {
    for (const marker of ["form-terms", "public_terms_version", "privacy_version", "terms_version", "submission_terms_version"]) {
      if (!html.includes(marker)) {
        issues.push(`${rel}: missing form legal marker ${marker}`);
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
    "membership.html": 'data-open-form="fan"',
    "store.html": 'data-open-form="fan"',
    "community.html": 'data-open-form="fan"'
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
