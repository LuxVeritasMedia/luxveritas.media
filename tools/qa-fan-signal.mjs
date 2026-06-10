import { readFile } from "node:fs/promises";

const issues = [];
const appJs = await readFile("app.js", "utf8");
const buildScript = await readFile("tools/build-static.mjs", "utf8");
const styles = await readFile("styles.css", "utf8");

function issue(message) {
  issues.push(message);
}

for (const marker of [
  "function fanSignalSection()",
  "data-fan-signal",
  "data-fan-signal-tier",
  "data-fan-signal-detail",
  "data-fan-signal-count=\"media\"",
  "data-fan-signal-count=\"submissions\"",
  "data-fan-signal-count=\"portal\"",
  "data-fan-signal-list",
  "data-fan-signal-export",
  "Circle Signal",
  "Your path remembers the signal."
]) {
  if (!buildScript.includes(marker)) issue(`tools/build-static.mjs missing fan signal marker: ${marker}`);
}

for (const marker of [
  "function renderFanSignal()",
  "function fanSignalLabel(score)",
  "function fanSignalActivityLabel(item)",
  "function fanSignalState()",
  "function exportFanSignalPass(button)",
  "publicBuildVersion",
  "fan_signal_export",
  "luxveritas-signal-pass-",
  "luxveritas_media_events",
  "luxveritas_submissions",
  "luxveritas_portal_attempts",
  "renderFanSignal();"
]) {
  if (!appJs.includes(marker)) issue(`app.js missing fan signal marker: ${marker}`);
}

for (const marker of [
  ".fan-signal-section",
  ".fan-signal-panel",
  ".fan-signal-tier",
  ".fan-signal-latest",
  ".fan-signal-actions"
]) {
  if (!styles.includes(marker)) issue(`styles.css missing fan signal selector: ${marker}`);
}

if (/localStorage\.clear\(\)|eval\(/i.test(appJs)) {
  issue("app.js fan signal implementation contains unsafe or destructive patterns");
}

const assetVersion = buildScript.match(/const assetVersion = "([^"]+)"/)?.[1] || "";
if (!assetVersion) {
  issue("tools/build-static.mjs missing assetVersion");
} else if (!appJs.includes(`const publicBuildVersion = "${assetVersion}"`)) {
  issue("app.js publicBuildVersion must match build assetVersion");
}

if (issues.length) {
  console.error(`Fan signal QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Fan signal QA passed.");
