# Lux Veritas Production Release Handoff

Status date: 2026-06-20

This repo is the public LuxVeritas.media front door. The apex site is live and serving the current build. Do not move LuxFlow OS, private prompts, internal dashboards, finance, rights operations, or unreleased canon into this public repo.

## Current Live Build

- Live apex: `https://luxveritas.media`
- Firebase project: `lux-veritas-media`
- GitHub repo: `LuxVeritasMedia/luxveritas.media`
- Current live asset version: `20260620-fan-reactions`
- Current phase: Phase 5 of 10, portal pilot prep active
- Phase 4 closeout: legal approval remains open before full public release
- Next major phase: authenticated portal shell with approved auth and role gates
- Current MVP posture: pilot-ready with public launch blocked only by external Privacy and Terms approval.

## What Is Working

- Public site deploys from GitHub to Firebase Hosting.
- Apex HTTPS works at `https://luxveritas.media`.
- `www.luxveritas.media` HTTPS works and returns HTTP 200.
- Public forms submit to `/api/submit`.
- Public forms capture optional audience-interest paths for retention and future screened routing.
- Approved sender identity is `forms@luxveritas.media`, with delivery to `info@luxveritas.media` confirmed through live matrix QA.
- Valid live form submissions are stored server-side and sent silently to the approved inbox when the provider is active.
- Public submit buttons reset after success, stored capture, timeout, validation failure, or fallback.
- Browser-flow QA covers stored capture, email-draft fallback, rate-limit recovery, portal fallback, and submit-button reset.
- Portal sign-in is a screened access capture, not a real account login yet.
- Lux Player MVP has audio, visual, and radio slots with approved preview sources.
- Live media-source QA verifies the exact manifest source URLs, content types, and audio/video signatures for the audio, visual, and radio slots.
- Listen, Watch, and Radio player actions select the matching source and return stable reporting keys.
- Media player fan reactions capture replay, invite, collect, and create intent as local signal and protected operator reporting.
- Audio, video, and radio playback lifecycle events return play, pause, milestone, and ended reporting values.
- Protected operator reporting summarizes playback actions, source types, reporting keys, and retention milestones.
- Brand-house visual identity is manifest-driven and live on Home and About, with responsive QA coverage for the six public house marks.
- CTA, media, consented interaction, and form reporting paths have QA coverage.
- Pilot testing is covered by a no-secret scenario matrix for public capture, media player, portal capture, operator reporting, launch gates, and private workflow readiness.
- A dedicated pilot write gate can send live QA submissions and event writes, require inbox delivery, verify live media/browser coverage, and confirm protected operator reporting while allowing only the known Privacy and Terms approval blockers.
- Pilot write gate last passed on 2026-06-20 with 10 live capture-intent submissions, inbox delivery required, live event writes, live media-source checks, live browser-flow coverage, and protected operator-report verification.
- Operator reporting summarizes audience-interest demand from stored captures.
- Operator reporting includes a protected intake queue workbench with queue pressure, SLA, next action, inbox status, and handoff status.
- Operator reporting recommends the next private workflow target from real routing demand while keeping external provider details out of the public site.
- Private operator reporting exists behind approved access.
- Machine-readable phase status is deployed at `/data/lux-phase-status.json`.

## Launch Blockers

These are the known blockers before calling the site public-launch ready.

1. Privacy page needs legal/business approval.
2. Terms page needs legal/business approval.
3. External CRM/Google workflow target may be selected after the private workflow is approved. The signed Firebase private handoff is already active for the MVP intake queue, and the private operator report now shows demand-led recommendations for the first external target.

Before selecting the external target, review `docs/private-workflow-matrix.json` and run `node tools/qa-private-workflow-matrix.mjs`. The matrix maps every public capture queue to its owner, SLA, current `firebase_handoff` path, approved next profiles, workflow actions, and acceptance checks without storing provider details.

Use `docs/launch-blocker-resolution.md` as the operational closeout packet for the remaining release blockers. Use `docs/legal-review-packet.md` for Privacy and Terms review. Use `docs/final-launch-runbook.md` for the exact final launch sequence.

## Required Commands

Run these before launch review:

```bash
node tools/qa-operator-environment.mjs
node tools/report-mvp-status.mjs
node tools/qa-mvp-preflight.mjs
node tools/qa-launch-evidence.mjs
node tools/qa-pilot-test-matrix.mjs
firebase login --reauth
node tools/qa-provider-readiness.mjs
node tools/qa-private-workflow-matrix.mjs
node tools/qa-external-workflow-targets.mjs
node tools/qa-live-media-sources.mjs
node tools/qa-live-operator-report.mjs
node tools/qa-domain-readiness.mjs
node tools/resolve-www-domain.mjs
node tools/qa-release-readiness.mjs
LUX_PILOT_WRITE_TESTS=1 node tools/qa-pilot-write-gate.mjs
LUX_PILOT_BROWSER=1 LUX_PILOT_LIVE=1 node tools/qa-pilot-readiness.mjs
node tools/qa-final-release-gate.mjs
```

Inbox delivery was confirmed on 2026-06-17. Re-run this only if the sender domain, provider secret, or Functions deployment changes:

```bash
LUX_RESEND_API_KEY="re_..." node tools/activate-inbox-delivery.mjs
LUX_FORM_MATRIX_WRITE=1 LUX_EXPECT_EMAIL_SENT=1 node tools/qa-live-form-matrix.mjs
```

For final release approval after all blockers are cleared, run the gate with write tests enabled:

```bash
LUX_FINAL_WRITE_TESTS=1 node tools/qa-final-release-gate.mjs
```

Do not use `LUX_FINAL_SKIP_BROWSER=1` or `LUX_FINAL_SKIP_LIVE=1` for release approval. Those flags are only for faster local audits.

The final release gate includes the no-secret operator-environment, MVP status, and MVP preflight checks before strict release checks. Use those sections as the launch operator's first read on local machine readiness, live asset alignment, and known blocker status.

Set `LUX_REPORT_TOKEN` before running `node tools/qa-live-operator-report.mjs` or the final write gate. The command confirms `/api/report` rejects public traffic, then verifies approved-operator counts, readiness, summaries, playback reporting, handoff reporting, and secret-shaped value protection.

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
- `www.luxveritas.media` serves correctly over HTTPS or redirects to the apex domain.
