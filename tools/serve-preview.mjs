import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.env.LUX_PREVIEW_ROOT || "dist");
const requestedPort = Number(process.env.LUX_PREVIEW_PORT || 4173);
const host = process.env.LUX_PREVIEW_HOST || "127.0.0.1";
const maxAttempts = Number(process.env.LUX_PREVIEW_PORT_ATTEMPTS || 20);
const smoke = process.env.LUX_PREVIEW_SMOKE === "1";

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".wav", "audio/wav"],
  [".webm", "video/webm"],
  [".xml", "application/xml; charset=utf-8"]
]);

function contentType(pathname) {
  return mimeTypes.get(extname(pathname).toLowerCase()) || "application/octet-stream";
}

function resolveRequestPath(urlPathname) {
  const decoded = decodeURIComponent(urlPathname.split("?")[0] || "/");
  const normalized = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const relative = normalized === "/" ? "index.html" : normalized.replace(/^[/\\]/, "");
  const candidate = resolve(root, relative);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
  return candidate;
}

async function fileForRequest(urlPathname) {
  const candidate = resolveRequestPath(urlPathname);
  if (!candidate) return null;
  try {
    const info = await stat(candidate);
    if (info.isDirectory()) return join(candidate, "index.html");
    if (info.isFile()) return candidate;
  } catch {
    if (!extname(candidate)) {
      const htmlCandidate = `${candidate}.html`;
      try {
        const info = await stat(htmlCandidate);
        if (info.isFile()) return htmlCandidate;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function buildServer() {
  return createServer(async (req, res) => {
    if (!req.url || !["GET", "HEAD"].includes(req.method || "")) {
      res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Method not allowed");
      return;
    }

    const file = await fileForRequest(new URL(req.url, "http://localhost").pathname);
    if (!file) {
      try {
        const body = await readFile(join(root, "404.html"));
        res.writeHead(404, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        });
        if (req.method === "HEAD") res.end();
        else res.end(body);
      } catch {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
      }
      return;
    }

    try {
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": contentType(file),
        "Cache-Control": "no-store"
      });
      if (req.method === "HEAD") res.end();
      else res.end(body);
    } catch {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Unable to read preview file");
    }
  });
}

async function listenOnOpenPort(port, attempt = 1) {
  const server = buildServer();
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE" && attempt < maxAttempts) {
        resolveListen(listenOnOpenPort(port + 1, attempt + 1));
      } else {
        rejectListen(error);
      }
    });
    server.listen(port, host, () => resolveListen({ server, port }));
  });
}

async function verifyManifest(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/data/lux-build-manifest.json`);
    if (!response.ok) return `manifest HTTP ${response.status}`;
    const manifest = await response.json();
    return manifest.assetVersion ? `asset ${manifest.assetVersion}` : "manifest missing assetVersion";
  } catch (error) {
    return `manifest unavailable: ${error.message}`;
  }
}

const { server, port } = await listenOnOpenPort(requestedPort);
const baseUrl = `http://${host}:${port}`;
const manifestStatus = await verifyManifest(baseUrl);

console.log(`Lux Veritas preview serving ${root}`);
console.log(`Local: ${baseUrl}/index.html`);
console.log(`Manifest: ${manifestStatus}`);
if (port !== requestedPort) {
  console.log(`Note: port ${requestedPort} was unavailable, so preview moved to ${port}.`);
}

if (smoke) {
  await new Promise((resolveClose) => server.close(resolveClose));
} else {
  console.log("Press Ctrl+C to stop.");
}
