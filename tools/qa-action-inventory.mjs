import { access, readFile } from "node:fs/promises";
import { actionInventoryVersion, extractActionInventory, summarizeActions } from "./lib/action-inventory.mjs";

const issues = [];
const root = process.env.LUX_ACTION_INVENTORY_ROOT || "dist";
const inventoryPath = process.env.LUX_ACTION_INVENTORY_PATH || `${root}/data/lux-action-inventory.json`;
const requiredActionTypes = [
  "link_click",
  "form_open",
  "form_submit",
  "media_action",
  "media_select",
  "fan_reaction",
  "fan_signal_export",
  "portal_signin",
  "operator_report_action",
  "dialog_close",
  "navigation_toggle",
  "consent_update"
];
const requiredReportingEvents = [
  "link_click",
  "form_open",
  "lead_accepted",
  "media_action",
  "media_select",
  "fan_reaction",
  "local_export",
  "portal_signin_capture",
  "report_action",
  "dialog_close",
  "navigation_toggle",
  "consent_update"
];

function issue(message) {
  issues.push(message);
}

function byId(items) {
  return new Map(items.map((item) => [item.id, item]));
}

try {
  await access(inventoryPath);
} catch {
  issue(`missing action inventory artifact: ${inventoryPath}`);
}

const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const buildManifest = JSON.parse(await readFile(`${root}/data/lux-build-manifest.json`, "utf8"));
const expectedActions = await extractActionInventory(root);
const expectedSummary = summarizeActions(expectedActions);

if (inventory.schemaVersion !== "luxveritas.action_inventory.v1") {
  issue(`schemaVersion expected luxveritas.action_inventory.v1, found ${inventory.schemaVersion || "missing"}`);
}
if (inventory.version !== actionInventoryVersion) {
  issue(`version expected ${actionInventoryVersion}, found ${inventory.version || "missing"}`);
}
if (inventory.buildAssetVersion !== buildManifest.assetVersion) {
  issue(`buildAssetVersion ${inventory.buildAssetVersion || "missing"} does not match build manifest ${buildManifest.assetVersion || "missing"}`);
}
if (inventory.actionCount !== expectedActions.length) {
  issue(`actionCount ${inventory.actionCount} does not match extracted action count ${expectedActions.length}`);
}
if (!Array.isArray(inventory.actions) || inventory.actions.length !== inventory.actionCount) {
  issue("actions array missing or length does not match actionCount");
}

const actualById = byId(inventory.actions || []);
for (const expected of expectedActions) {
  const actual = actualById.get(expected.id);
  if (!actual) {
    issue(`inventory missing action ${expected.id}`);
    continue;
  }
  for (const field of ["route", "element", "label", "actionType", "actionValue", "reportingEvent", "expectedOutcome"]) {
    if (String(actual[field] || "") !== String(expected[field] || "")) {
      issue(`${expected.id}: ${field} expected ${expected[field] || "empty"}, found ${actual[field] || "empty"}`);
    }
  }
}

for (const type of requiredActionTypes) {
  if (!inventory.summary?.byType?.[type]) {
    issue(`summary missing action type ${type}`);
  }
}
for (const event of requiredReportingEvents) {
  if (!inventory.summary?.byReportingEvent?.[event]) {
    issue(`summary missing reporting event ${event}`);
  }
}
for (const route of ["index.html", "music.html", "spmvp.html", "portal/reporting.html", "auth/signin.html"]) {
  if (!inventory.summary?.byRoute?.[route]) {
    issue(`summary missing route ${route}`);
  }
}

for (const action of inventory.actions || []) {
  if (!action.id || !action.route || !action.actionType || !action.reportingEvent || !action.expectedOutcome) {
    issue(`action record is missing required fields: ${JSON.stringify(action)}`);
  }
  if (/secret|token|api key|private key/i.test(`${action.label} ${action.expectedOutcome}`)) {
    issue(`${action.id}: inventory appears to expose private implementation language`);
  }
}

if (JSON.stringify(inventory.summary) !== JSON.stringify(expectedSummary)) {
  issue("inventory summary does not match extracted action summary");
}

if (issues.length) {
  console.error(`Action inventory QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Action inventory QA passed for ${inventory.actionCount} action(s) across ${inventory.routeCount} route(s).`);
