import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMediaControl } from "./lux-media-control.mjs";

const root = await mkdtemp(join(tmpdir(), "lux-media-control-"));
const silent = { log() {}, error() {} };
const fixedNow = () => new Date("2026-07-10T12:00:00.000Z");

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

try {
  await mkdir(join(root, "data"), { recursive: true });
  await mkdir(join(root, "inputs"), { recursive: true });
  const originalManifest = {
    schemaVersion: "luxveritas.media_manifest.v1",
    version: "test-original",
    updatedAt: "2026-07-09T12:00:00.000Z",
    items: [
      { id: "spmvp-release", sourceStatus: "ready", sourceUrl: "https://media.example.com/original.wav", posterUrl: "https://media.example.com/poster.jpg" },
      { id: "visual-world", sourceStatus: "ready", sourceUrl: "https://media.example.com/original.webm", posterUrl: "https://media.example.com/poster.jpg" },
      { id: "lux-radio", sourceStatus: "ready", sourceUrl: "https://media.example.com/radio.wav", posterUrl: "https://media.example.com/poster.jpg" }
    ]
  };
  await writeFile(join(root, "data/lux-media-manifest.json"), `${JSON.stringify(originalManifest, null, 2)}\n`);
  await writeFile(join(root, "inputs/song.wav"), "RIFF-test-audio");
  await writeFile(join(root, "inputs/poster.png"), "PNG-test-poster");
  await writeFile(join(root, "inputs/wrong.txt"), "not-video");

  const plan = await runMediaControl([
    "plan",
    "--slot", "song",
    "--file", "inputs/song.wav",
    "--poster", "inputs/poster.png"
  ], { cwd: root, now: fixedNow, stdout: silent });
  assert.equal(plan.status, "plan_ready");
  assert.equal(plan.source.target, "assets/media/spmvp-release.wav");
  assert.equal(await exists(join(root, "assets/media/spmvp-release.wav")), false);

  const applied = await runMediaControl([
    "apply",
    "--slot", "audio",
    "--file", "inputs/song.wav",
    "--poster", "inputs/poster.png",
    "--confirm"
  ], { cwd: root, now: fixedNow, stdout: silent });
  assert.equal(applied.status, "applied");
  assert.equal(await exists(join(root, "assets/media/spmvp-release.wav")), true);
  assert.equal(await exists(join(root, "assets/media/spmvp-release-poster.png")), true);

  const updated = JSON.parse(await readFile(join(root, "data/lux-media-manifest.json"), "utf8"));
  assert.equal(updated.version, "2026-07-10-media-control");
  assert.equal(updated.items[0].sourceUrl, "https://luxveritas.media/assets/media/spmvp-release.wav");
  assert.equal(updated.items[0].posterUrl, "/assets/media/spmvp-release-poster.png");

  const verified = await runMediaControl(["verify"], { cwd: root, now: fixedNow, stdout: silent });
  assert.equal(verified.status, "ready");

  const rolledBack = await runMediaControl(["rollback", "--backup", "latest", "--confirm"], {
    cwd: root,
    now: fixedNow,
    stdout: silent
  });
  assert.equal(rolledBack.status, "rolled_back");
  assert.equal(await exists(join(root, "assets/media/spmvp-release.wav")), false);
  const restored = JSON.parse(await readFile(join(root, "data/lux-media-manifest.json"), "utf8"));
  assert.equal(restored.version, "test-original");
  assert.equal(restored.items[0].sourceUrl, "https://media.example.com/original.wav");

  await assert.rejects(
    runMediaControl(["plan", "--slot", "video", "--file", "inputs/wrong.txt"], {
      cwd: root,
      now: fixedNow,
      stdout: silent
    }),
    /not allowed/
  );

  const prepareHosting = await readFile("tools/prepare-hosting.mjs", "utf8");
  const runbook = await readFile("docs/media-publishing-runbook.md", "utf8");
  for (const marker of ["manifestAssetFiles", "lux-media-manifest.json", "localAssetPathFromUrl"]) {
    assert.ok(prepareHosting.includes(marker), `prepare-hosting missing ${marker}`);
  }
  for (const marker of [
    "node tools/lux-media-control.mjs status",
    "--slot song",
    "--slot video",
    "--slot radio",
    "rollback --backup latest --confirm",
    "node tools/qa-live-media-sources.mjs"
  ]) {
    assert.ok(runbook.includes(marker), `media runbook missing ${marker}`);
  }

  console.log("Media control QA passed: plan, apply, verify, rollback, invalid-file guard, packaging, and runbook markers are ready.");
} finally {
  await rm(root, { recursive: true, force: true });
}
