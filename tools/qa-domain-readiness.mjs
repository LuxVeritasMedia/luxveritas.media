import { resolve4, resolveCname } from "node:dns/promises";

const baseDomain = process.env.LUX_DOMAIN || "luxveritas.media";
const apexHost = baseDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
const wwwHost = `www.${apexHost}`;
const firebaseHostingIp = "199.36.158.100";
const strict = process.env.LUX_DOMAIN_STRICT === "1";
const issues = [];
const warnings = [];
const passed = [];

function pass(message) {
  passed.push(message);
}

function issue(message) {
  issues.push(message);
}

async function aRecords(hostname) {
  try {
    return await resolve4(hostname);
  } catch {
    return [];
  }
}

async function cnameRecords(hostname) {
  try {
    return await resolveCname(hostname);
  } catch {
    return [];
  }
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
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error?.message || String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

const [apexA, wwwA, wwwCname, apexHttps, wwwHttps] = await Promise.all([
  aRecords(apexHost),
  aRecords(wwwHost),
  cnameRecords(wwwHost),
  head(`https://${apexHost}`),
  head(`https://${wwwHost}`)
]);

if (apexA.includes(firebaseHostingIp)) {
  pass(`${apexHost} A includes Firebase Hosting IP ${firebaseHostingIp}.`);
} else {
  issue(`${apexHost} A should include ${firebaseHostingIp}; found ${apexA.join(", ") || "none"}.`);
}

if (apexHttps.ok) {
  pass(`https://${apexHost} responds with HTTP ${apexHttps.status}.`);
} else {
  issue(`https://${apexHost} is not ready (${apexHttps.error || `HTTP ${apexHttps.status}`}).`);
}

if (wwwA.length || wwwCname.length) {
  pass(`${wwwHost} has DNS records: A=${wwwA.join(", ") || "none"} CNAME=${wwwCname.join(", ") || "none"}.`);
} else {
  issue(`${wwwHost} has no A or CNAME records.`);
}

if (wwwHttps.ok) {
  pass(`https://${wwwHost} responds with HTTP ${wwwHttps.status}${wwwHttps.location ? ` -> ${wwwHttps.location}` : ""}.`);
} else if (wwwA.length || wwwCname.length) {
  issue(`https://${wwwHost} DNS exists but HTTPS is not ready (${wwwHttps.error || `HTTP ${wwwHttps.status}`}).`);
} else {
  warnings.push(`https://${wwwHost} cannot be tested until DNS exists.`);
}

console.log(`Domain readiness for ${apexHost}`);
for (const message of passed) console.log(`PASS ${message}`);

if (warnings.length) {
  console.log("Domain readiness warnings:");
  for (const warning of warnings) console.log(`WARN ${warning}`);
}

if (issues.length) {
  console.log("Domain readiness blockers:");
  for (const item of issues) console.log(`BLOCK ${item}`);
  console.log("");
  console.log("Expected Firebase Hosting DNS:");
  console.log(`- A ${apexHost} ${firebaseHostingIp}`);
  console.log(`- Add ${wwwHost} as a Firebase Hosting custom domain, then use the DNS record Firebase gives for www.`);
  console.log("- If Firebase offers a redirect option, redirect www to the apex after SSL is active.");
  if (strict) process.exit(1);
}

console.log(`Domain readiness checked: ${passed.length} passed, ${warnings.length} warning(s), ${issues.length} blocker(s).`);
if (!strict && issues.length) {
  console.log("Run with LUX_DOMAIN_STRICT=1 when domain blockers must fail the command.");
}
