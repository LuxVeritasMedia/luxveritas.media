# LuxVeritas.media

External public-facing Lux Veritas website.

This repo is separate from the internal LuxFlow OS app.

Current phase: Phase 5 of 10 - portal pilot prep and release control active. Phase 4 legal closeout is approved. Fresh live write evidence remains the final release-gate check for the current build.

Public website repo:

```text
/Users/frederickparent/Documents/Codex/LuxVeritas-website
```

Internal OS repo:

```text
/Users/frederickparent/Documents/Codex/LuxFlow-OS
```

Use this repo for public brand, music, film, events, Codex, submissions, about, press, contact, SEO, audience capture, and public portal entry points.

Do not add LuxFlow OS internal app modules, admin dashboards, DAMON/BlackGPT workflow state, private audit logs, workspace/project records, API secrets, or internal Firebase/Auth logic to this public site.

## Phase Documents

Start here when continuing the build:

```text
TODO.md
docs/build-phase-plan.md
docs/PRODUCT_BOUNDARY.md
```

Phase 5 remains a private portal shell. Phase 6 intake/routing contracts are defined for screened access. The public media MVP is live with preview sources. The controlled LuxOS/LuxFlow bridge remains deferred and must not merge internal app code into the public website.

## Media Publishing

Song, video, and radio updates use the guarded operator control rather than a public browser upload:

```bash
node tools/lux-media-control.mjs status
node tools/lux-media-control.mjs plan --slot song --file "/path/to/approved-song.wav"
node tools/lux-media-control.mjs apply --slot song --file "/path/to/approved-song.wav" --confirm
```

The same flow supports `video` and `radio`, validates approved formats, creates a rollback backup, and automatically includes local media in the Firebase Hosting artifact. See `docs/media-publishing-runbook.md` for the full release path.

Internal KYS/master-seed documents should be stored in Google Drive or a private internal repository, not pushed to the public GitHub website repo.
