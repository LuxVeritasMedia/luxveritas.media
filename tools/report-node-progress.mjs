import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repo = "LuxVeritasMedia/luxveritas.media";

async function run(command, args) {
  try {
    const { stdout } = await execFileAsync(command, args, {
      cwd: process.cwd(),
      timeout: 20000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return { ok: true, output: stdout.trim() };
  } catch (error) {
    return {
      ok: false,
      output: String(error.stderr || error.stdout || error.message || error).trim(),
    };
  }
}

function heading(label) {
  console.log(`\n${label}`);
  console.log("-".repeat(label.length));
}

const [status, head, branches, prs, runs] = await Promise.all([
  run("git", ["status", "--short", "--branch"]),
  run("git", ["log", "-1", "--date=iso-strict", "--pretty=format:%h|%ad|%an|%s"]),
  run("git", [
    "for-each-ref",
    "--sort=-committerdate",
    "--format=%(refname:short)|%(objectname:short)|%(committerdate:iso-strict)|%(authorname)|%(subject)",
    "refs/remotes/origin/node-x/",
    "refs/remotes/origin/node-z/",
  ]),
  run("gh", [
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--limit",
    "30",
    "--json",
    "number,title,isDraft,author,headRefName,baseRefName,updatedAt,url,statusCheckRollup",
  ]),
  run("gh", [
    "run",
    "list",
    "--repo",
    repo,
    "--limit",
    "8",
    "--json",
    "databaseId,status,conclusion,headBranch,headSha,displayTitle,createdAt,url",
  ]),
]);

console.log("Lux Veritas node progress report");
console.log(`Generated: ${new Date().toISOString()}`);

heading("Current checkout");
console.log(status.output || "No status output.");
console.log(head.output || "No commit output.");

heading("Node branches");
if (!branches.ok) console.log(`Unavailable: ${branches.output}`);
else if (!branches.output) console.log("No remote node-x/* or node-z/* branches are visible locally.");
else console.log(branches.output);

heading("Open pull requests");
if (!prs.ok) {
  console.log(`Unavailable: ${prs.output}`);
} else {
  const items = JSON.parse(prs.output || "[]");
  if (!items.length) console.log("No open pull requests.");
  for (const item of items) {
    const checks = (item.statusCheckRollup || []).map((check) => check.conclusion || check.status).filter(Boolean);
    console.log(`#${item.number} ${item.isDraft ? "DRAFT " : ""}${item.title}`);
    console.log(`  ${item.headRefName} -> ${item.baseRefName}`);
    console.log(`  author=${item.author?.login || "unknown"} updated=${item.updatedAt} checks=${checks.join(",") || "none"}`);
    console.log(`  ${item.url}`);
  }
}

heading("Recent Actions");
if (!runs.ok) {
  console.log(`Unavailable: ${runs.output}`);
} else {
  const items = JSON.parse(runs.output || "[]");
  for (const item of items) {
    console.log(`${item.conclusion || item.status} #${item.databaseId} ${item.headBranch} ${item.headSha.slice(0, 8)} ${item.displayTitle}`);
    console.log(`  ${item.url}`);
  }
}

console.log("\nProgress rule: local work is not shared progress until a branch or draft PR is pushed.");
