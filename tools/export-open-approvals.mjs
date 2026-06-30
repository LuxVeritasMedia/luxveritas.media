import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const outputPath = process.env.LUX_OPEN_APPROVALS_OUT || "data/lux-open-approvals.json";

const result = await execFileAsync(process.execPath, ["tools/report-open-approvals.mjs"], {
  env: { ...process.env, LUX_OPEN_APPROVALS_JSON: "1" },
  timeout: 30000,
  maxBuffer: 1024 * 1024 * 4
});

const report = JSON.parse(result.stdout);
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Exported open approvals report to ${outputPath}.`);
