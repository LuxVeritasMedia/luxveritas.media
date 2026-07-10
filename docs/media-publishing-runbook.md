# Lux Veritas Media Publishing Runbook

Status: operator-ready local workflow

Purpose: replace the public Song, Video, or Radio source without exposing upload controls, credentials, or internal systems in public website markup.

## North Star

The public site should make listening and watching feel immediate. The operator path should be calm, reversible, and provable: plan, apply, preview, QA, deploy, and verify.

## Start Here

From the website repo:

```bash
cd /Users/frederickparent/Documents/Codex/LuxVeritas-website
node tools/lux-media-control.mjs status
```

This reports the current Song, Video, and Radio sources without changing anything.

## Song

Plan first:

```bash
node tools/lux-media-control.mjs plan --slot song --file "/path/to/approved-song.wav"
```

Apply only after reviewing the plan:

```bash
node tools/lux-media-control.mjs apply --slot song --file "/path/to/approved-song.wav" --confirm
```

Supported local formats: AAC, M4A, MP3, OGG, WAV.

## Video

Plan the video and poster together:

```bash
node tools/lux-media-control.mjs plan --slot video --file "/path/to/approved-video.webm" --poster "/path/to/approved-poster.jpg"
```

Apply:

```bash
node tools/lux-media-control.mjs apply --slot video --file "/path/to/approved-video.webm" --poster "/path/to/approved-poster.jpg" --confirm
```

Supported local video formats: MP4, MOV, WebM. Use browser-tested MP4 or WebM for release.

## Radio

Plan:

```bash
node tools/lux-media-control.mjs plan --slot radio --file "/path/to/approved-radio.wav"
```

Apply:

```bash
node tools/lux-media-control.mjs apply --slot radio --file "/path/to/approved-radio.wav" --confirm
```

Use the Radio slot for a reviewed preview loop or an approved HTTPS audio source. Do not claim a continuous live broadcast until the programming window is real.

## Approved HTTPS Sources

Large production media may live on an approved CDN or storage service. In that case, update the manifest without copying a file into the repo:

```bash
node tools/lux-media-control.mjs plan --slot song --url "https://approved-media.example/song.mp3"
node tools/lux-media-control.mjs apply --slot song --url "https://approved-media.example/song.mp3" --confirm
```

Video with a remote poster:

```bash
node tools/lux-media-control.mjs apply --slot video --url "https://approved-media.example/video.webm" --poster "https://approved-media.example/poster.jpg" --confirm
```

Only approved HTTPS sources are accepted.

## Preview And QA

After every apply:

```bash
node tools/qa-media-control.mjs
node tools/lux-media-control.mjs verify
node tools/build-static.mjs
node tools/prepare-hosting.mjs
node tools/qa-media-contract.mjs
node tools/qa-buttons.mjs
node tools/qa-mobile-layout.mjs
node tools/qa-accessibility.mjs
node tools/serve-preview.mjs
```

Review these local routes:

- `/music.html#lux-player`
- `/spmvp.html#lux-player`
- `/music.html#lux-radio`
- `/portal/reporting.html`

The Song, Video, and Radio controls must select the intended source and leave the page responsive.

## Deploy And Verify

After review, commit and push through the normal GitHub/Firebase path. Then run:

```bash
node tools/qa-deploy-status.mjs
node tools/qa-live-media-sources.mjs
node tools/qa-live-operator-report.mjs
```

For release-day proof, run the fresh live write gate only when the inbox owner is ready for QA messages:

```bash
LUX_PILOT_WRITE_TESTS=1 node tools/qa-pilot-write-gate.mjs
```

## Rollback

Every apply saves the previous manifest and replaced local assets under `.lux-media-control/backups/`.

Restore the latest backup:

```bash
node tools/lux-media-control.mjs rollback --backup latest --confirm
```

Then rebuild, preview, and rerun media QA before committing the rollback.

## Release Rules

- Use only approved music, video, artwork, and radio programming.
- Keep masters, contracts, private rights records, credentials, and unreleased source material outside the public repo.
- Prefer an approved media CDN or storage service for large production files.
- Public buttons should only listen, watch, join, attend, collect, or create.
- Media publishing remains an operator action; it is never exposed as a public browser upload form.
