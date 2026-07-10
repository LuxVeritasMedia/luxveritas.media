import { access, copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const mediaSlots = {
  song: {
    id: "spmvp-release",
    label: "Song",
    assetBase: "spmvp-release",
    extensions: [".aac", ".m4a", ".mp3", ".ogg", ".wav"]
  },
  video: {
    id: "visual-world",
    label: "Video",
    assetBase: "visual-world",
    extensions: [".mp4", ".mov", ".webm"]
  },
  radio: {
    id: "lux-radio",
    label: "Radio",
    assetBase: "lux-radio",
    extensions: [".aac", ".m4a", ".mp3", ".ogg", ".wav"]
  }
};

const slotAliases = {
  audio: "song",
  release: "song",
  visual: "video",
  stream: "radio"
};

const imageExtensions = [".avif", ".jpg", ".jpeg", ".png", ".webp"];

function usage() {
  return `Lux Veritas media control

Status:
  node tools/lux-media-control.mjs status

Plan a local file update without writing:
  node tools/lux-media-control.mjs plan --slot song --file "/path/to/song.wav"
  node tools/lux-media-control.mjs plan --slot video --file "/path/to/video.webm" --poster "/path/to/poster.jpg"
  node tools/lux-media-control.mjs plan --slot radio --file "/path/to/radio.wav"

Apply an approved update:
  node tools/lux-media-control.mjs apply --slot song --file "/path/to/song.wav" --confirm

Use an approved HTTPS source instead of copying a file:
  node tools/lux-media-control.mjs apply --slot video --url "https://media.example.com/video.webm" --poster "https://media.example.com/poster.jpg" --confirm

Rollback the latest applied update:
  node tools/lux-media-control.mjs rollback --backup latest --confirm

Every apply creates a local backup under .lux-media-control/backups/. Run build and QA before committing or deploying.`;
}

function parseArgs(argv) {
  const command = argv[0] && !argv[0].startsWith("--") ? argv[0] : "status";
  const flags = command === "status" && argv[0]?.startsWith("--") ? argv : argv.slice(1);
  const result = {
    command,
    confirm: false,
    manifest: "data/lux-media-manifest.json",
    backupRoot: ".lux-media-control/backups"
  };

  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === "--confirm") {
      result.confirm = true;
      continue;
    }
    if (!["--slot", "--file", "--url", "--poster", "--manifest", "--backup-root", "--backup"].includes(flag)) {
      throw new Error(`Unknown option: ${flag}`);
    }
    const value = flags[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
    index += 1;
    const key = flag.replace(/^--/, "").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    result[key] = value;
  }

  return result;
}

function normalizeSlot(value) {
  const normalized = String(value || "").toLowerCase();
  const slot = slotAliases[normalized] || normalized;
  if (!mediaSlots[slot]) throw new Error(`Unknown media slot "${value || ""}". Use song, video, or radio.`);
  return slot;
}

function isHttps(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function localAssetPathFromUrl(value, cwd) {
  if (!value) return null;
  if (value.startsWith("/assets/")) return resolve(cwd, value.slice(1));
  try {
    const url = new URL(value);
    if (url.hostname === "luxveritas.media" && url.pathname.startsWith("/assets/")) {
      return resolve(cwd, url.pathname.slice(1));
    }
  } catch {
    return null;
  }
  return null;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function validateFile(path, allowedExtensions, label) {
  const info = await stat(path);
  if (!info.isFile() || info.size < 1) throw new Error(`${label} must be a non-empty file: ${path}`);
  const extension = extname(path).toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    throw new Error(`${label} extension ${extension || "(none)"} is not allowed. Use ${allowedExtensions.join(", ")}.`);
  }
  return { extension, bytes: info.size };
}

async function prepareInput({ args, cwd, slot }) {
  const definition = mediaSlots[slot];
  if (Boolean(args.file) === Boolean(args.url)) {
    throw new Error("Provide exactly one of --file or --url.");
  }

  let source;
  if (args.file) {
    const sourcePath = resolve(cwd, args.file);
    const file = await validateFile(sourcePath, definition.extensions, `${definition.label} source`);
    const targetRelative = `assets/media/${definition.assetBase}${file.extension}`;
    source = {
      kind: "local_file",
      input: sourcePath,
      bytes: file.bytes,
      targetRelative,
      publicUrl: `https://luxveritas.media/${targetRelative}`
    };
  } else {
    if (!isHttps(args.url)) throw new Error("--url must be an HTTPS URL.");
    const url = new URL(args.url);
    const extension = extname(url.pathname).toLowerCase();
    if (extension && !definition.extensions.includes(extension) && !url.pathname.endsWith(".m3u8")) {
      throw new Error(`${definition.label} URL extension ${extension} is not supported.`);
    }
    source = { kind: "https_url", input: args.url, publicUrl: args.url };
  }

  let poster = null;
  if (args.poster) {
    if (isHttps(args.poster)) {
      poster = { kind: "https_url", input: args.poster, publicUrl: args.poster };
    } else {
      const sourcePath = args.poster.startsWith("/assets/")
        ? resolve(cwd, args.poster.slice(1))
        : resolve(cwd, args.poster);
      const file = await validateFile(sourcePath, imageExtensions, "Poster");
      const targetRelative = `assets/media/${definition.assetBase}-poster${file.extension}`;
      poster = {
        kind: "local_file",
        input: sourcePath,
        bytes: file.bytes,
        targetRelative,
        publicUrl: `/${targetRelative}`
      };
    }
  }

  return { slot, definition, source, poster };
}

export async function validateMediaManifest(manifest, cwd = process.cwd()) {
  const issues = [];
  const items = Array.isArray(manifest?.items) ? manifest.items : [];

  for (const [slot, definition] of Object.entries(mediaSlots)) {
    const item = items.find((candidate) => candidate.id === definition.id);
    if (!item) {
      issues.push(`${slot}: missing manifest item ${definition.id}`);
      continue;
    }
    if (item.sourceStatus !== "ready") issues.push(`${slot}: sourceStatus must be ready`);
    if (!isHttps(item.sourceUrl)) issues.push(`${slot}: sourceUrl must be HTTPS`);
    const localSource = localAssetPathFromUrl(item.sourceUrl, cwd);
    if (localSource && !(await exists(localSource))) issues.push(`${slot}: local source is missing at ${relative(cwd, localSource)}`);
    const localPoster = localAssetPathFromUrl(item.posterUrl, cwd);
    if (localPoster && !(await exists(localPoster))) issues.push(`${slot}: local poster is missing at ${relative(cwd, localPoster)}`);
  }

  return issues;
}

async function loadManifest(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function latestBackup(backupRoot) {
  if (!(await exists(backupRoot))) throw new Error("No media-control backup directory exists yet.");
  const entries = (await readdir(backupRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (!entries.length) throw new Error("No media-control backups are available.");
  return resolve(backupRoot, entries.at(-1));
}

async function createBackup({ cwd, manifestPath, backupRoot, prepared, now }) {
  const stamp = now().toISOString().replace(/[:.]/g, "-");
  const backupDir = resolve(backupRoot, stamp);
  await mkdir(join(backupDir, "files"), { recursive: true });
  await copyFile(manifestPath, join(backupDir, "manifest.json"));
  const changedFiles = [];

  for (const entry of [prepared.source, prepared.poster].filter((item) => item?.kind === "local_file")) {
    const target = resolve(cwd, entry.targetRelative);
    const hadPrevious = await exists(target);
    const backupRelative = `files/${entry.targetRelative.replaceAll("/", "__")}`;
    if (hadPrevious) await copyFile(target, resolve(backupDir, backupRelative));
    changedFiles.push({ targetRelative: entry.targetRelative, hadPrevious, backupRelative });
  }

  const metadata = {
    schemaVersion: "luxveritas.media_control_backup.v1",
    createdAt: now().toISOString(),
    manifestRelative: relative(cwd, manifestPath),
    changedFiles
  };
  await writeFile(join(backupDir, "backup.json"), `${JSON.stringify(metadata, null, 2)}\n`);
  return { backupDir, metadata };
}

async function applyPrepared({ cwd, manifestPath, backupRoot, manifest, prepared, now }) {
  const backup = await createBackup({ cwd, manifestPath, backupRoot, prepared, now });
  for (const entry of [prepared.source, prepared.poster].filter((item) => item?.kind === "local_file")) {
    const target = resolve(cwd, entry.targetRelative);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(entry.input, target);
  }

  const item = manifest.items.find((candidate) => candidate.id === prepared.definition.id);
  if (!item) throw new Error(`Manifest item ${prepared.definition.id} is missing.`);
  item.sourceUrl = prepared.source.publicUrl;
  item.sourceStatus = "ready";
  item.sourceRequired = true;
  if (prepared.poster) item.posterUrl = prepared.poster.publicUrl;
  manifest.updatedAt = now().toISOString();
  manifest.version = `${manifest.updatedAt.slice(0, 10)}-media-control`;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return backup;
}

async function rollbackBackup({ cwd, manifestPath, backupDir }) {
  const metadata = JSON.parse(await readFile(join(backupDir, "backup.json"), "utf8"));
  await copyFile(join(backupDir, "manifest.json"), manifestPath);
  for (const entry of metadata.changedFiles || []) {
    const target = resolve(cwd, entry.targetRelative);
    if (entry.hadPrevious) {
      await mkdir(dirname(target), { recursive: true });
      await copyFile(resolve(backupDir, entry.backupRelative), target);
    } else {
      await rm(target, { force: true });
    }
  }
  return metadata;
}

export async function runMediaControl(argv, options = {}) {
  const cwd = resolve(options.cwd || process.cwd());
  const now = options.now || (() => new Date());
  const stdout = options.stdout || console;
  const args = parseArgs(argv);
  const manifestPath = resolve(cwd, args.manifest);
  const backupRoot = resolve(cwd, args.backupRoot);

  if (["help", "--help", "-h"].includes(args.command)) {
    stdout.log(usage());
    return { status: "help" };
  }

  if (args.command === "rollback") {
    if (!args.confirm) throw new Error("Rollback requires --confirm.");
    const backupDir = args.backup && args.backup !== "latest"
      ? resolve(cwd, args.backup)
      : await latestBackup(backupRoot);
    const metadata = await rollbackBackup({ cwd, manifestPath, backupDir });
    const result = { status: "rolled_back", backupDir: relative(cwd, backupDir), restored: metadata.changedFiles?.length || 0 };
    stdout.log(JSON.stringify(result, null, 2));
    return result;
  }

  const manifest = await loadManifest(manifestPath);
  if (args.command === "status" || args.command === "verify") {
    const issues = await validateMediaManifest(manifest, cwd);
    const result = {
      status: issues.length ? "needs_attention" : "ready",
      manifest: relative(cwd, manifestPath),
      version: manifest.version,
      slots: Object.entries(mediaSlots).map(([slot, definition]) => {
        const item = manifest.items.find((candidate) => candidate.id === definition.id) || {};
        return { slot, label: definition.label, id: definition.id, sourceStatus: item.sourceStatus || "missing", sourceUrl: item.sourceUrl || "" };
      }),
      issues,
      next: "Use plan first, then apply with --confirm. Build and run media QA before deployment."
    };
    stdout.log(JSON.stringify(result, null, 2));
    if (args.command === "verify" && issues.length) throw new Error(`Media control verification found ${issues.length} issue(s).`);
    return result;
  }

  if (!["plan", "apply"].includes(args.command)) throw new Error(`Unknown command: ${args.command}\n\n${usage()}`);
  const slot = normalizeSlot(args.slot);
  const prepared = await prepareInput({ args, cwd, slot });
  const result = {
    status: args.command === "plan" ? "plan_ready" : "applied",
    slot,
    manifestItem: prepared.definition.id,
    source: {
      kind: prepared.source.kind,
      bytes: prepared.source.bytes,
      target: prepared.source.targetRelative,
      publicUrl: prepared.source.publicUrl
    },
    poster: prepared.poster ? {
      kind: prepared.poster.kind,
      bytes: prepared.poster.bytes,
      target: prepared.poster.targetRelative,
      publicUrl: prepared.poster.publicUrl
    } : null
  };

  if (args.command === "apply") {
    if (!args.confirm) throw new Error("Apply requires --confirm after reviewing the plan.");
    const backup = await applyPrepared({ cwd, manifestPath, backupRoot, manifest, prepared, now });
    result.backup = relative(cwd, backup.backupDir);
    result.nextCommands = [
      "node tools/qa-media-control.mjs",
      "node tools/build-static.mjs",
      "node tools/prepare-hosting.mjs",
      "node tools/qa-media-contract.mjs",
      "node tools/qa-live-media-sources.mjs"
    ];
  }

  stdout.log(JSON.stringify(result, null, 2));
  return result;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  runMediaControl(process.argv.slice(2)).catch((error) => {
    console.error(`Media control failed: ${error.message}`);
    process.exitCode = 1;
  });
}
