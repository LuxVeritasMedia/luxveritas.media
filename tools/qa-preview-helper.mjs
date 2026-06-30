import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const buildManifest = JSON.parse(await readFile("data/lux-build-manifest.json", "utf8"));
const expectedAsset = buildManifest.assetVersion || buildManifest.version || "";
const issues = [];
const passed = [];

function pass(message) {
  passed.push(message);
  console.log(`PASS ${message}`);
}

function issue(message) {
  issues.push(message);
  console.log(`BLOCK ${message}`);
}

function parsePreviewPort(output) {
  const match = output.match(/Local:\s+http:\/\/127\.0\.0\.1:(\d+)\/index\.html/i);
  return match ? Number(match[1]) : 0;
}

async function withBlockedPort(callback) {
  const blocker = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Port intentionally occupied by qa-preview-helper.");
  });
  await new Promise((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(0, "127.0.0.1", resolve);
  });
  const address = blocker.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    return await callback(port);
  } finally {
    await new Promise((resolve) => blocker.close(resolve));
  }
}

async function runPreviewSmoke(blockedPort) {
  const { stdout, stderr } = await execFileAsync(process.execPath, ["tools/serve-preview.mjs"], {
    timeout: 15000,
    maxBuffer: 1024 * 1024,
    env: {
      ...process.env,
      LUX_PREVIEW_SMOKE: "1",
      LUX_PREVIEW_PORT: String(blockedPort),
      LUX_PREVIEW_PORT_ATTEMPTS: "10"
    }
  });
  return `${stdout || ""}${stderr || ""}`;
}

console.log("Lux Veritas preview helper QA");

await withBlockedPort(async (blockedPort) => {
  if (!blockedPort) {
    issue("could not allocate an occupied test port");
    return;
  }
  pass(`allocated occupied test port ${blockedPort}.`);

  let output = "";
  try {
    output = await runPreviewSmoke(blockedPort);
  } catch (error) {
    issue(`serve-preview smoke failed: ${error.message}`);
    const text = `${error.stdout || ""}${error.stderr || ""}`.trim();
    if (text) console.log(text);
    return;
  }

  const previewPort = parsePreviewPort(output);
  if (!previewPort) {
    issue("serve-preview did not print a Local preview URL");
  } else if (previewPort === blockedPort) {
    issue(`serve-preview reused occupied port ${blockedPort}`);
  } else {
    pass(`serve-preview moved from occupied port ${blockedPort} to ${previewPort}.`);
  }

  if (output.includes(`Manifest: asset ${expectedAsset}`)) {
    pass(`serve-preview verified current manifest asset ${expectedAsset}.`);
  } else {
    issue(`serve-preview did not verify current manifest asset ${expectedAsset}`);
    console.log(output.trim());
  }

  if (/Lux Veritas preview serving /i.test(output)) {
    pass("serve-preview reported the Lux Veritas preview root.");
  } else {
    issue("serve-preview did not report the Lux Veritas preview root");
  }
});

console.log("");
console.log(`Preview helper QA checked: ${passed.length} passed, ${issues.length} blocker(s).`);
if (issues.length) process.exit(1);
