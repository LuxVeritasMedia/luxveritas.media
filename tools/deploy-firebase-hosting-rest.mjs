import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, posix, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { googleAccessToken } from "./lib/google-cloud-auth.mjs";

const project = process.env.LUX_FIREBASE_PROJECT || "lux-veritas-media";
const site = process.env.LUX_FIREBASE_SITE || project;
const channel = String(process.env.LUX_FIREBASE_HOSTING_CHANNEL || "live").trim().toLowerCase();
const channelTtl = String(process.env.LUX_FIREBASE_HOSTING_CHANNEL_TTL || "604800s").trim();
const dryRun = process.env.LUX_FIREBASE_HOSTING_REST_DRY_RUN === "1";
const apiRoot = "https://firebasehosting.googleapis.com/v1beta1";
const uploadRoot = "https://upload-firebasehosting.googleapis.com/upload";

function normalizePublicPath(filePath) {
  return `/${filePath.split(sep).join(posix.sep)}`;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function parseJson(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function releaseMessage() {
  const sha = process.env.GITHUB_SHA || "";
  const runId = process.env.GITHUB_RUN_ID || "";
  return [
    channel === "live" ? "GitHub Actions REST deploy" : `GitHub Actions REST preview ${channel}`,
    sha ? `commit ${sha.slice(0, 12)}` : "",
    runId ? `run ${runId}` : ""
  ].filter(Boolean).join(" ");
}

async function walk(dir, root = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath, root));
    else if (entry.isFile()) files.push(relative(root, fullPath));
  }
  return files.sort();
}

function hostingHeaders(headers = []) {
  return headers.map((entry) => ({
    glob: entry.source,
    headers: Object.fromEntries((entry.headers || []).map((header) => [header.key, header.value]))
  }));
}

function hostingRedirects(redirects = []) {
  return redirects.map((entry) => ({
    glob: entry.source,
    location: entry.destination,
    statusCode: Number(entry.type || 301)
  }));
}

function hostingRewrites(rewrites = []) {
  return rewrites.map((entry) => {
    if (entry.destination) return { glob: entry.source, path: entry.destination };
    if (entry.function) {
      return {
        glob: entry.source,
        function: entry.function.functionId,
        functionRegion: entry.function.region
      };
    }
    throw new Error(`Unsupported Hosting rewrite: ${JSON.stringify(entry)}`);
  });
}

async function apiFetch(path, { method = "GET", body, token, root = apiRoot } = {}) {
  const response = await fetch(`${root}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body == null ? {} : { "Content-Type": "application/json" })
    },
    body: body == null ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  const json = parseJson(text);
  if (!response.ok) {
    const detail = json?.error?.message || text || response.statusText;
    throw new Error(`${method} ${path} failed: ${response.status} ${response.statusText}: ${detail}`);
  }
  return json;
}

async function ensurePreviewChannel(token) {
  if (channel === "live") return null;
  const sitePath = `/sites/${encodeURIComponent(site)}`;
  const createPath = `${sitePath}/channels?channelId=${encodeURIComponent(channel)}`;
  const response = await fetch(`${apiRoot}${createPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ttl: channelTtl })
  });
  const text = await response.text();
  const json = parseJson(text);
  if (response.ok) return json;
  if (response.status === 409) {
    return apiFetch(`${sitePath}/channels/${encodeURIComponent(channel)}`, { token });
  }
  const detail = json?.error?.message || text || response.statusText;
  throw new Error(`POST ${createPath} failed: ${response.status} ${response.statusText}: ${detail}`);
}

async function uploadFile(uploadUrl, hash, gzipped, token) {
  const response = await fetch(`${uploadUrl}/${encodeURIComponent(hash)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Content-Length": String(gzipped.length)
    },
    body: gzipped
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`upload ${hash} failed: ${response.status} ${response.statusText}: ${text}`);
  }
}

async function main() {
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(channel)) {
    throw new Error(`Invalid Firebase Hosting channel id: ${channel}`);
  }
  const firebaseConfig = JSON.parse(await readFile("firebase.json", "utf8"));
  const hosting = firebaseConfig.hosting || {};
  const publicDir = process.env.LUX_FIREBASE_HOSTING_PUBLIC || hosting.public || "dist";
  const publicStat = await stat(publicDir);
  if (!publicStat.isDirectory()) throw new Error(`${publicDir} must be a directory. Run node tools/prepare-hosting.mjs first.`);

  const relativeFiles = await walk(publicDir);
  if (!relativeFiles.length) throw new Error(`${publicDir} does not contain deployable files.`);

  const fileEntries = [];
  const files = {};
  for (const file of relativeFiles) {
    const raw = await readFile(join(publicDir, file));
    const gzipped = gzipSync(raw);
    const hash = sha256(gzipped);
    const publicPath = normalizePublicPath(file);
    files[publicPath] = hash;
    fileEntries.push({ file, publicPath, hash, gzipped });
  }

  if (dryRun) {
    console.log(`Firebase Hosting REST deploy dry run for site ${site}, channel ${channel}.`);
    console.log(`Would deploy ${fileEntries.length} file(s) from ${publicDir}.`);
    console.log(`Would preserve ${hosting.headers?.length || 0} header rule(s), ${hosting.redirects?.length || 0} redirect(s), and ${hosting.rewrites?.length || 0} rewrite(s).`);
    if (channel !== "live") console.log(`Would create or refresh preview channel ${channel} with TTL ${channelTtl}.`);
    return;
  }

  const { token, source } = await googleAccessToken();
  console.log(`Firebase Hosting REST deploy for site ${site}, channel ${channel}, using ${source}.`);
  console.log(`Deploying ${fileEntries.length} file(s) from ${publicDir}.`);
  let channelInfo = await ensurePreviewChannel(token);

  const version = await apiFetch(`/sites/${encodeURIComponent(site)}/versions`, {
    method: "POST",
    token,
    body: {
      config: {
        headers: hostingHeaders(hosting.headers),
        redirects: hostingRedirects(hosting.redirects),
        rewrites: hostingRewrites(hosting.rewrites)
      },
      labels: {
        source: "github-actions",
        project
      }
    }
  });

  const versionName = version.name;
  if (!versionName) throw new Error("Firebase Hosting create version response did not include a version name.");

  const populated = await apiFetch(`/${versionName}:populateFiles`, {
    method: "POST",
    token,
    body: { files }
  });

  const required = new Set(populated.uploadRequiredHashes || []);
  const uploadUrl = populated.uploadUrl || `${uploadRoot}/${versionName}/files`;
  for (const entry of fileEntries) {
    if (required.has(entry.hash)) await uploadFile(uploadUrl, entry.hash, entry.gzipped, token);
  }
  console.log(`Uploaded ${required.size} required file hash(es).`);

  await apiFetch(`/${versionName}?updateMask=status`, {
    method: "PATCH",
    token,
    body: { status: "FINALIZED" }
  });

  const release = await apiFetch(`/sites/${encodeURIComponent(site)}/channels/${encodeURIComponent(channel)}/releases?versionName=${encodeURIComponent(versionName)}`, {
    method: "POST",
    token,
    body: {
      message: releaseMessage()
    }
  });

  console.log(`Firebase Hosting REST deploy released ${release.name || versionName}.`);
  if (channel !== "live") {
    channelInfo = await apiFetch(`/sites/${encodeURIComponent(site)}/channels/${encodeURIComponent(channel)}`, { token });
    if (channelInfo?.url) console.log(`Firebase Hosting preview URL: ${channelInfo.url}`);
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
