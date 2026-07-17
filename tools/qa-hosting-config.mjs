import { readFile } from "node:fs/promises";

const issues = [];
const config = JSON.parse(await readFile("firebase.json", "utf8"));
const hosting = config.hosting || {};
const headers = Array.isArray(hosting.headers) ? hosting.headers : [];
const redirects = Array.isArray(hosting.redirects) ? hosting.redirects : [];
const rewrites = Array.isArray(hosting.rewrites) ? hosting.rewrites : [];
const ignores = Array.isArray(hosting.ignore) ? hosting.ignore : [];

function headerMap(source) {
  const entry = headers.find((item) => item.source === source);
  return new Map((entry?.headers || []).map((header) => [header.key, header.value]));
}

if (hosting.public !== "dist") {
  issues.push(`hosting.public expected dist, found ${hosting.public || "missing"}`);
}

for (const ignored of ["functions/**", "source_docs/**", "source_docs_round2/**", "brief_extracts/**", "brief_extracts_round2/**", "tools/**", "docs/**"]) {
  if (!ignores.includes(ignored)) issues.push(`hosting.ignore missing ${ignored}`);
}

const globalHeaders = headerMap("**");
const expectedGlobalHeaders = new Map([
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"],
  ["X-Frame-Options", "SAMEORIGIN"],
  ["Strict-Transport-Security", "max-age=31536000"]
]);

for (const [key, value] of expectedGlobalHeaders) {
  if (globalHeaders.get(key) !== value) {
    issues.push(`global hosting header ${key} expected ${value}, found ${globalHeaders.get(key) || "missing"}`);
  }
}

const binaryHeaders = headerMap("**/*.@(png|jpg|webp)");
if (binaryHeaders.get("Cache-Control") !== "public,max-age=31536000,immutable") {
  issues.push("image cache header is missing immutable one-year policy");
}

const mediaHeaders = headerMap("**/*.@(svg|wav|webm)");
if (mediaHeaders.get("Cache-Control") !== "public,max-age=31536000,immutable") {
  issues.push("media cache header is missing immutable one-year policy");
}

const appHeaders = headerMap("**/*.@(js|css)");
if (appHeaders.get("Cache-Control") !== "public,max-age=300") {
  issues.push("app asset cache header is missing short cache policy");
}

const serviceWorkerHeaders = headerMap("/service-worker.js");
if (serviceWorkerHeaders.get("Cache-Control") !== "no-cache") {
  issues.push("service worker cache header must be no-cache");
}

for (const [source, functionId] of [
  ["/api/submit", "submitForm"],
  ["/api/event", "trackSiteEvent"],
  ["/api/report", "reportActivity"]
]) {
  const rewrite = rewrites.find((item) => item.source === source);
  if (rewrite?.function?.functionId !== functionId || rewrite.function.region !== "us-central1") {
    issues.push(`${source} rewrite expected ${functionId} in us-central1`);
  }
}

const oldInternalRouteRedirect = redirects.find((item) => item.source === "/blackgpt-damon.html");
if (
  oldInternalRouteRedirect?.destination !== "/index.html"
  || oldInternalRouteRedirect.type !== 301
) {
  issues.push("hosting redirects must permanently send the old internal route to /index.html");
}

if (rewrites.some((item) => item.source === "**")) {
  issues.push("hosting must not rewrite unknown public routes; Firebase should serve 404.html with HTTP 404");
}

const notFoundHtml = await readFile("404.html", "utf8");
if (!notFoundHtml.includes('name="robots" content="noindex, nofollow"')) {
  issues.push("404.html must include noindex, nofollow metadata");
}
if (!notFoundHtml.includes("The signal ends here.")) {
  issues.push("404.html is missing the Lux Veritas not-found message");
}

if (issues.length) {
  console.error(`Hosting config QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Hosting config QA passed.");
