import { access, readFile } from "node:fs/promises";

const issues = [];
const requiredFiles = [
  "docs/collaboration/README.md",
  "docs/collaboration/STATUS.md",
  "docs/collaboration/DECISIONS.md",
  ".github/pull_request_template.md",
  ".github/ISSUE_TEMPLATE/node-work-package.md",
  "tools/report-node-progress.mjs",
];

for (const file of requiredFiles) {
  try {
    await access(file);
  } catch {
    issues.push(`missing ${file}`);
  }
}

const [workflow, status, decisions, pullRequestTemplate, issueTemplate, reporter] = await Promise.all([
  readFile("docs/collaboration/README.md", "utf8"),
  readFile("docs/collaboration/STATUS.md", "utf8"),
  readFile("docs/collaboration/DECISIONS.md", "utf8"),
  readFile(".github/pull_request_template.md", "utf8"),
  readFile(".github/ISSUE_TEMPLATE/node-work-package.md", "utf8"),
  readFile("tools/report-node-progress.mjs", "utf8"),
]);

for (const marker of [
  "GitHub repository",
  "Shared Drive workspace",
  "same GitHub organization and shared Drive, but not through the same user login",
  "node-z/<short-scope>",
  "draft PR is the progress dashboard",
  "Do not force-push",
]) {
  if (!workflow.includes(marker)) issues.push(`workflow missing marker: ${marker}`);
}

for (const marker of ["no remote `node-z/*` branch", "no open pull request", "Immediate Goal", "Update Format"]) {
  if (!status.includes(marker)) issues.push(`status missing marker: ${marker}`);
}

if (!decisions.includes("GitHub is canonical for website code")) issues.push("decision log missing source-of-truth decision");
if (!pullRequestTemplate.includes("Node And Goal")) issues.push("PR template missing node identity section");
if (!issueTemplate.includes("Node work package")) issues.push("issue template missing work-package metadata");
if (!reporter.includes("Progress rule: local work is not shared progress")) issues.push("progress reporter missing visibility rule");
if (/drive\.google\.com\/drive\/folders\//i.test(`${workflow}\n${status}\n${decisions}`)) {
  issues.push("public collaboration docs must not expose private Drive folder URLs");
}

if (issues.length) {
  console.error(`Node collaboration QA failed with ${issues.length} issue(s):`);
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

console.log(`Node collaboration QA passed for ${requiredFiles.length} required files.`);
