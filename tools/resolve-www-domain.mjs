import { readFile, writeFile } from "node:fs/promises";
import { resolve4, resolveCname } from "node:dns/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const baseDomain = process.env.LUX_DOMAIN || "luxveritas.media";
const apexHost = baseDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
const wwwHost = `www.${apexHost}`;
const firebaseHostingIp = "199.36.158.100";
const writeCloseout = process.env.LUX_WWW_CLOSEOUT_WRITE === "1";
const dryRun = process.env.LUX_WWW_CLOSEOUT_DRY_RUN === "1";
const strict = process.env.LUX_WWW_STRICT === "1";
const updatedBy = (process.env.LUX_WWW_CLOSEOUT_BY || "").trim();
const evidenceReference = (process.env.LUX_WWW_CLOSEOUT_EVIDENCE || `Domain readiness QA ${new Date().toISOString().slice(0, 10)}`).trim();
const secretPattern = /re_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/;
const execFileAsync = promisify(execFile);

async function digRecords(hostname, type) {
  try {
    const { stdout } = await execFileAsync("dig", ["+short", hostname, type], { timeout: 12000 });
    return stdout
      .split("\n")
      .map((item) => item.trim().replace(/\.$/, ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function aRecords(hostname) {
  try {
    const records = await resolve4(hostname);
    if (records.length) return records;
  } catch {
  }
  try {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: { Accept: "application/dns-json" }
    });
    const body = await response.json();
    const records = Array.isArray(body.Answer)
      ? body.Answer.map((answer) => answer.data).filter((item) => /^\d+\.\d+\.\d+\.\d+$/.test(item))
      : [];
    if (records.length) return records;
  } catch {
  }
  try {
    const { stdout } = await execFileAsync("curl", [
      "-fsS",
      "-H",
      "Accept: application/dns-json",
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`
    ], { timeout: 10000 });
    const body = JSON.parse(stdout);
    const records = Array.isArray(body.Answer)
      ? body.Answer.map((answer) => answer.data).filter((item) => /^\d+\.\d+\.\d+\.\d+$/.test(item))
      : [];
    if (records.length) return records;
  } catch {
  }
  return digRecords(hostname, "A");
}

async function cnameRecords(hostname) {
  try {
    const records = await resolveCname(hostname);
    if (records.length) return records.map((item) => item.replace(/\.$/, ""));
  } catch {
  }
  try {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=CNAME`, {
      headers: { Accept: "application/dns-json" }
    });
    const body = await response.json();
    const records = Array.isArray(body.Answer)
      ? body.Answer.map((answer) => String(answer.data || "").replace(/\.$/, "")).filter(Boolean)
      : [];
    if (records.length) return records;
  } catch {
  }
  try {
    const { stdout } = await execFileAsync("curl", [
      "-fsS",
      "-H",
      "Accept: application/dns-json",
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=CNAME`
    ], { timeout: 10000 });
    const body = JSON.parse(stdout);
    const records = Array.isArray(body.Answer)
      ? body.Answer.map((answer) => String(answer.data || "").replace(/\.$/, "")).filter(Boolean)
      : [];
    if (records.length) return records;
  } catch {
  }
  return digRecords(hostname, "CNAME");
}

async function head(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal
    });
    return {
      ok: response.ok || [301, 302, 307, 308].includes(response.status),
      status: response.status,
      location: response.headers.get("location") || ""
    };
  } catch {
    try {
      const { stdout } = await execFileAsync("curl", ["-sS", "-I", "--max-time", "12", url], { timeout: 15000 });
      const status = Number(stdout.match(/^HTTP\/\S+\s+(\d+)/im)?.[1] || 0);
      const location = stdout.match(/^location:\s*(.+)$/im)?.[1]?.trim() || "";
      return {
        ok: [200, 204, 301, 302, 307, 308].includes(status),
        status,
        location
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error?.message || String(error)
      };
    }
  } finally {
    clearTimeout(timeout);
  }
}

function line(label, value) {
  return `${label}: ${value || "none"}`;
}

function updateReadinessGate(manifest, now) {
  return {
    ...manifest,
    updatedAt: now,
    gates: manifest.gates.map((gate) => gate.id === "www_redirect"
      ? {
          ...gate,
          status: "ready",
          statusEvidenceReference: evidenceReference,
          statusUpdatedAt: now,
          statusUpdatedBy: updatedBy
        }
      : gate)
  };
}

function updateCloseout(manifest, now) {
  return {
    ...manifest,
    updatedAt: now,
    items: manifest.items.map((item) => item.id === "www_redirect"
      ? {
          ...item,
          status: "closed",
          evidenceReference,
          closedAt: now,
          closedBy: updatedBy
        }
      : item)
  };
}

const [apexA, wwwA, wwwCname, apexHttps, wwwHttps] = await Promise.all([
  aRecords(apexHost),
  aRecords(wwwHost),
  cnameRecords(wwwHost),
  head(`https://${apexHost}`),
  head(`https://${wwwHost}`)
]);

const writeBlockers = [];
const wwwBlockers = [];
if (!apexA.includes(firebaseHostingIp)) writeBlockers.push(`${apexHost} A does not include ${firebaseHostingIp}`);
if (!apexHttps.ok) writeBlockers.push(`https://${apexHost} is not ready`);
if (!wwwA.length && !wwwCname.length) {
  writeBlockers.push(`${wwwHost} has no A or CNAME records`);
  wwwBlockers.push(`${wwwHost} has no A or CNAME records`);
}
if ((wwwA.length || wwwCname.length) && !wwwHttps.ok) {
  writeBlockers.push(`https://${wwwHost} is not ready`);
  wwwBlockers.push(`https://${wwwHost} is not ready`);
}

const ready = writeBlockers.length === 0;

console.log(`WWW domain closeout check for ${wwwHost}`);
console.log(line(`${apexHost} A`, apexA.join(", ")));
console.log(line(`https://${apexHost}`, apexHttps.ok ? `HTTP ${apexHttps.status}` : apexHttps.error || `HTTP ${apexHttps.status}`));
console.log(line(`${wwwHost} A`, wwwA.join(", ")));
console.log(line(`${wwwHost} CNAME`, wwwCname.join(", ")));
console.log(line(`https://${wwwHost}`, wwwHttps.ok ? `HTTP ${wwwHttps.status}${wwwHttps.location ? ` -> ${wwwHttps.location}` : ""}` : wwwHttps.error || `HTTP ${wwwHttps.status}`));

if (ready) {
  console.log("WWW domain is ready for launch closeout.");
} else {
  console.log("WWW domain blockers:");
  for (const blocker of (wwwBlockers.length ? wwwBlockers : writeBlockers)) console.log(`- ${blocker}`);
  console.log("");
  if (wwwA.length || wwwCname.length) {
    console.log("Next action: wait for Firebase certificate minting and Hosting mapping to finish, then rerun domain readiness.");
  } else {
    console.log("Next action: add www.luxveritas.media as a Firebase Hosting custom domain, set the DNS record Firebase provides, then wait for SSL.");
  }
  if (writeBlockers.some((item) => item.startsWith(apexHost) || item.startsWith(`https://${apexHost}`))) {
    console.log("Apex checks were inconclusive in this environment; verify with node tools/qa-domain-readiness.mjs before closeout.");
  }
}

if (writeCloseout) {
  if (!ready) {
    console.error("Refusing to write launch closeout because www is not ready.");
    process.exit(1);
  }
  if (!updatedBy) {
    console.error("Set LUX_WWW_CLOSEOUT_BY before writing launch closeout.");
    process.exit(1);
  }
  if (!evidenceReference || secretPattern.test(evidenceReference)) {
    console.error("Set a no-secret LUX_WWW_CLOSEOUT_EVIDENCE reference before writing launch closeout.");
    process.exit(1);
  }

  const now = new Date().toISOString();
  const readiness = JSON.parse(await readFile("data/lux-launch-readiness.json", "utf8"));
  const closeout = JSON.parse(await readFile("data/lux-launch-closeout.json", "utf8"));
  const nextReadiness = updateReadinessGate(readiness, now);
  const nextCloseout = updateCloseout(closeout, now);

  if (dryRun) {
    console.log(`Dry run passed for www closeout with evidence: ${evidenceReference}`);
  } else {
    await writeFile("data/lux-launch-readiness.json", `${JSON.stringify(nextReadiness, null, 2)}\n`);
    await writeFile("data/lux-launch-closeout.json", `${JSON.stringify(nextCloseout, null, 2)}\n`);
    console.log("Updated data/lux-launch-readiness.json and data/lux-launch-closeout.json for www_redirect.");
  }
}

if (strict && wwwBlockers.length) process.exit(1);
