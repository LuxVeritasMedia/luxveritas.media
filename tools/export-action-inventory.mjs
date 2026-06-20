import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { actionInventoryVersion, extractActionInventory, summarizeActions } from "./lib/action-inventory.mjs";

const outPath = process.env.LUX_ACTION_INVENTORY_OUT || "data/lux-action-inventory.json";
const buildManifest = JSON.parse(await readFile("data/lux-build-manifest.json", "utf8"));
const actions = await extractActionInventory(".");
const summary = summarizeActions(actions);

const inventory = {
  schemaVersion: "luxveritas.action_inventory.v1",
  version: actionInventoryVersion,
  buildAssetVersion: buildManifest.assetVersion,
  routeCount: Object.keys(summary.byRoute).length,
  actionCount: actions.length,
  summary,
  actions
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(`Exported ${actions.length} Lux Veritas public actions to ${outPath}.`);
