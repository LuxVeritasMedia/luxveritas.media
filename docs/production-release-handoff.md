# Lux Veritas Production Release Handoff

Status date: 2026-06-11

This repo is the public LuxVeritas.media front door. The apex site is live and serving the current build. Do not move LuxFlow OS, private prompts, internal dashboards, finance, rights operations, or unreleased canon into this public repo.

## Current Live Build

- Live apex: `https://luxveritas.media`
- Firebase project: `lux-veritas-media`
- GitHub repo: `LuxVeritasMedia/luxveritas.media`
- Current live asset version: `20260611-report-gate-readiness`
- Current phase: Phase 4 of 10, capture/legal/readiness
- Next major phase: Phase 5, authenticated portal shell

## What Is Working

- Public site deploys from GitHub to Firebase Hosting.
- Apex HTTPS works at `https://luxveritas.media`.
- Public forms submit to `/api/submit`.
- Valid live form submissions are stored server-side when the inbox provider is offline.
- Public submit buttons reset after success, stored capture, timeout, validation failure, or fallback.
- Browser-flow QA covers stored capture, email-draft fallback, rate-limit recovery, portal fallback, and submit-button reset.
- Portal sign-in is a screened access capture, not a real account login yet.
- Lux Player MVP has audio, visual, and radio slots with approved preview sources.
- Listen, Watch, and Radio player actions select the matching source and return stable reporting keys.
- Audio, video, and radio playback lifecycle events return play, pause, milestone, and ended reporting values.
- Protected operator reporting summarizes playback actions, source types, reporting keys, and retention milestones.
- Brand-house visual identity is live on Home and About, with responsive QA coverage for the six public house marks.
- CTA, media, consented interaction, and form reporting paths have QA coverage.
- Private operator reporting exists behind approved access.

## Launch Blockers

These are the known blockers before calling the site public-launch ready.

1. `www.luxveritas.media` DNS and Firebase Hosting redirect are not configured.
2. `RESEND_API_KEY` must be set to a real approved provider key. The current secret value is the offline sentinel.
3. `forms@luxveritas.media` must be verified with the email provider before silent inbox delivery is considered live.
4. Privacy page needs legal/business approval.
5. Terms page needs legal/business approval.
6. External CRM/Google workflow target may be selected after the private workflow is approved. The signed Firebase private handoff is already active for the MVP intake queue.

Use `docs/launch-blocker-resolution.md` as the operational closeout packet for the remaining release blockers. Use `docs/legal-review-packet.md` for Privacy and Terms review. Use `docs/final-launch-runbook.md` for the exact final launch sequence.

## Required Commands

Run these before launch review:

```bash
firebase login --reauth
node tools/qa-provider-readiness.mjs
node tools/qa-domain-readiness.mjs
node tools/qa-release-readiness.mjs
LUX_PILOT_BROWSER=1 LUX_PILOT_LIVE=1 node tools/qa-pilot-readiness.mjs
node tools/qa-final-release-gate.mjs
```

After the approved email provider key exists:

```bash
LUX_RESEND_API_KEY="re_..." node tools/setup-inbox-provider-secret.mjs
firebase deploy --only functions:submitForm,functions:reportActivity --project lux-veritas-media --non-interactive --force
LUX_FORM_MATRIX_WRITE=1 LUX_EXPECT_EMAIL_SENT=1 node tools/qa-live-form-matrix.mjs
```

For final release approval after all blockers are cleared, run the gate with write tests enabled:

```bash
LUX_FINAL_WRITE_TESTS=1 node tools/qa-final-release-gate.mjs
```

Do not use `LUX_FINAL_SKIP_BROWSER=1` or `LUX_FINAL_SKIP_LIVE=1` for release approval. Those flags are only for faster local audits.

After legal approval:

```bash
LUX_LEGAL_REVIEW_ITEM=privacy LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY="Reviewer Name" node tools/set-legal-review-status.mjs
LUX_LEGAL_REVIEW_ITEM=terms LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY="Reviewer Name" node tools/set-legal-review-status.mjs
node tools/build-static.mjs
node tools/prepare-hosting.mjs
node tools/qa-release-readiness.mjs
```

## Release Acceptance

Do not call the MVP release-ready until all of these are true:

- `node tools/qa-release-readiness.mjs` has no blockers.
- `LUX_PILOT_BROWSER=1 LUX_PILOT_LIVE=1 node tools/qa-pilot-readiness.mjs` has no blockers in strict review.
- `LUX_FINAL_WRITE_TESTS=1 node tools/qa-final-release-gate.mjs` passes without `LUX_FINAL_ALLOW_BLOCKERS=1`.
- Final release gate runs without `LUX_FINAL_SKIP_BROWSER=1` or `LUX_FINAL_SKIP_LIVE=1`.
- `https://luxveritas.media/data/lux-build-manifest.json` matches the expected local asset version.
- Test submissions send silently to `info@luxveritas.media`.
- Pending stored submissions can be replayed from private reporting.
- Privacy and Terms are approved in `data/lux-legal-review.json`.
- `www.luxveritas.media` resolves and redirects or serves correctly over HTTPS.
