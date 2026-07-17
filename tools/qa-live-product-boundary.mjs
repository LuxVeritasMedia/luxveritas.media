import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const issues = [];
const buildScript = await readFile("tools/build-static.mjs", "utf8");
const expectedAssetVersion = buildScript.match(/const assetVersion = "([^"]+)"/)?.[1] || "";
const execFileAsync = promisify(execFile);
const fallbackConnectTo = ["--connect-to", "luxveritas.media:443:lux-veritas-media.web.app:443"];
const fallbackHostingBaseUrl = "https://lux-veritas-media.web.app";

const forbiddenPatterns = [
  /DAMON/i,
  /BlackGPT/i,
  /LuxOS/i,
  /CanonCraft/i,
  /SignalCraft/i,
  /private prompts/i,
  /audit logs/i,
  /finance/i,
  /rights ops/i,
  /release ops/i,
  /canon bible/i
];

function issue(message) {
  issues.push(message);
}

async function fetchText(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 12000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method || "GET",
      redirect: options.redirect || "follow",
      headers: options.headers,
      signal: controller.signal
    });
    const text = options.readBody === false ? "" : await response.text();
    return { response, text };
  } catch (error) {
    if (options.method === "HEAD" || options.redirect === "manual") {
      return curlHead(path);
    }
    return curlGet(path, options);
  } finally {
    clearTimeout(timeout);
  }
}

async function curlGet(path, options = {}) {
  let stdout = "";
  try {
    ({ stdout } = await execFileAsync("curl", ["-fsS", `${baseUrl}${path}`], { timeout: options.timeoutMs || 12000 }));
  } catch (error) {
    if (!/Could not resolve host/i.test(String(error.stderr || error.message || "")) || baseUrl !== "https://luxveritas.media") {
      throw error;
    }
    try {
      ({ stdout } = await execFileAsync("curl", ["-fsS", ...fallbackConnectTo, `${baseUrl}${path}`], { timeout: options.timeoutMs || 12000 }));
    } catch {
      ({ stdout } = await execFileAsync("curl", ["-fsS", `${fallbackHostingBaseUrl}${path}`], { timeout: options.timeoutMs || 12000 }));
    }
  }
  return {
    response: {
      ok: true,
      status: 200,
      headers: new Map()
    },
    text: options.readBody === false ? "" : stdout
  };
}

async function curlHead(path) {
  let stdout = "";
  try {
    ({ stdout } = await execFileAsync("curl", ["-sS", "-I", `${baseUrl}${path}`], { timeout: 12000 }));
  } catch (error) {
    if (!/Could not resolve host/i.test(String(error.stderr || error.message || "")) || baseUrl !== "https://luxveritas.media") {
      throw error;
    }
    try {
      ({ stdout } = await execFileAsync("curl", ["-sS", "-I", ...fallbackConnectTo, `${baseUrl}${path}`], { timeout: 12000 }));
    } catch {
      ({ stdout } = await execFileAsync("curl", ["-sS", "-I", `${fallbackHostingBaseUrl}${path}`], { timeout: 12000 }));
    }
  }
  const status = Number(stdout.match(/^HTTP\/\S+\s+(\d+)/im)?.[1] || 0);
  const location = stdout.match(/^location:\s*(.+)$/im)?.[1]?.trim() || "";
  return {
    response: {
      ok: status >= 200 && status < 400,
      status,
      headers: {
        get(key) {
          return key.toLowerCase() === "location" ? location : "";
        }
      }
    },
    text: ""
  };
}

function scan(label, text) {
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) issue(`${label}: exposes internal boundary term ${pattern}`);
  }
}

if (!expectedAssetVersion) {
  issue("tools/build-static.mjs: missing assetVersion");
}

try {
  const { response, text } = await fetchText("/data/lux-build-manifest.json");
  if (!response.ok) {
    issue("/data/lux-build-manifest.json: expected HTTP 200");
  } else {
    const manifest = JSON.parse(text);
    if (manifest.assetVersion !== expectedAssetVersion) {
      issue(`/data/lux-build-manifest.json: live assetVersion ${manifest.assetVersion || "missing"} does not match ${expectedAssetVersion}`);
    }
    if (manifest.stylesheet !== `styles.css?v=${expectedAssetVersion}`) {
      issue("/data/lux-build-manifest.json: stylesheet does not match expected version");
    }
  }
} catch (error) {
  issue(`/data/lux-build-manifest.json: request failed (${error.message})`);
}

try {
  const { response, text } = await fetchText(`/styles.css?v=${expectedAssetVersion}`);
  if (!response.ok) issue(`/styles.css?v=${expectedAssetVersion}: expected HTTP 200`);
  scan(`/styles.css?v=${expectedAssetVersion}`, text);
} catch (error) {
  issue(`/styles.css?v=${expectedAssetVersion}: request failed (${error.message})`);
}

try {
  const { response, text } = await fetchText("/robots.txt");
  if (!response.ok) issue("/robots.txt: expected HTTP 200");
  if (!text.includes("Disallow: /private-steward.html")) {
    issue("/robots.txt: missing private steward disallow");
  }
  if (/blackgpt|damon/i.test(text)) {
    issue("/robots.txt: exposes retired internal route name");
  }
  scan("/robots.txt", text);
} catch (error) {
  issue(`/robots.txt: request failed (${error.message})`);
}

for (const path of [
  "/data/cr8-store-submission.json",
  "/data/lux-action-inventory.json",
  "/data/lux-launch-closeout-public.json",
  "/data/lux-launch-readiness.json",
  "/data/lux-legal-review.json",
  "/data/lux-open-approvals.json",
  "/data/lux-phase-status.json",
  "/data/lux-pilot-bug-register.json",
  "/data/lux-pilot-write-evidence.json",
  "/data/lux-radio-programming.json",
  "/data/lux-release-room.json"
]) {
  try {
    const { response } = await fetchText(path);
    if (response.status !== 404) {
      issue(`${path}: expected HTTP 404, received ${response.status}`);
    }
  } catch (error) {
    issue(`${path}: request failed (${error.message})`);
  }
}

try {
  const { response, text } = await fetchText(`/not-a-lux-route-${Date.now()}`);
  if (response.status !== 404) {
    issue(`unknown route: expected HTTP 404, received ${response.status}`);
  }
  if (!text.includes("The signal ends here.")) {
    issue("unknown route: missing Lux Veritas 404 content");
  }
} catch (error) {
  issue(`unknown route: request failed (${error.message})`);
}

try {
  const { response, text } = await fetchText("/private-steward.html");
  if (!response.ok) {
    issue("/private-steward.html: expected HTTP 200");
  }
  if (!text.includes('name="robots" content="noindex, nofollow"')) {
    issue("/private-steward.html: missing noindex metadata");
  }
  if (!text.includes("Internal materials are not public.")) {
    issue("/private-steward.html: missing locked-shell boundary copy");
  }
  scan("/private-steward.html", text);
} catch (error) {
  issue(`/private-steward.html: request failed (${error.message})`);
}

try {
  const { response } = await fetchText("/blackgpt-damon.html", {
    method: "HEAD",
    redirect: "manual",
    readBody: false
  });
  const location = response.headers.get("location") || "";
  if (![301, 308].includes(response.status) || location !== "/index.html") {
    issue(`/blackgpt-damon.html: expected permanent redirect to /index.html, received HTTP ${response.status}${location ? ` -> ${location}` : ""}`);
  }
} catch (error) {
  issue(`/blackgpt-damon.html: redirect check failed (${error.message})`);
}

if (issues.length) {
  console.error(`Live product boundary QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Live product boundary QA passed for ${baseUrl}.`);
