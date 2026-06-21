# Lux Veritas Launch Blocker Resolution

Status date: 2026-06-20

This packet tracks only the remaining public-release blockers for LuxVeritas.media. Keep secrets out of this file. Use Firebase Secret Manager, provider dashboards, and approved operator tokens for private values.

Machine-readable closeout tracking lives in `data/lux-launch-closeout.json`. Validate it with:

```bash
node tools/qa-launch-closeout.mjs
```

After a blocker is actually resolved, update the no-secret closeout tracker with an evidence reference only:

```bash
LUX_CLOSEOUT_ITEM=www_redirect \
LUX_CLOSEOUT_STATUS=closed \
LUX_CLOSEOUT_BY="Reviewer Name" \
LUX_CLOSEOUT_EVIDENCE="Launch evidence packet 2026-06-16" \
node tools/set-launch-closeout-status.mjs
```

Use `LUX_CLOSEOUT_DRY_RUN=1` to validate a closeout update without writing. Do not store credentials, provider keys, private tokens, screenshots with secrets, legal advice, or private report exports in the closeout file.

Launch readiness and closeout status must stay in sync: a closeout item cannot be marked closed while its launch gate is still blocked, and a launch gate should not be marked ready while its closeout item remains open.

After verification passes and the closeout item is ready to be reconciled, update the launch readiness gate with a no-secret evidence reference:

```bash
LUX_LAUNCH_GATE=www_redirect \
LUX_LAUNCH_STATUS=ready \
LUX_LAUNCH_BY="Reviewer Name" \
LUX_LAUNCH_EVIDENCE="Domain readiness QA 2026-06-16" \
node tools/set-launch-readiness-status.mjs
```

Use `LUX_LAUNCH_DRY_RUN=1` to validate without writing. A `ready` launch gate also requires synced TODO, handoff, runbook, and closeout updates before final QA will pass.

## Current Evidence

- Apex site: `https://luxveritas.media` returns HTTP 200.
- Live build version: `20260621-media-session`.
- Browser-flow pilot QA passes locally with form, media, and reporting paths.
- Private handoff secret set is active for `firebase_handoff`.
- Operator reporting token hash is configured.
- Release readiness currently reports two external blockers: Privacy approval and Terms approval.
- `www.luxveritas.media` closeout is resolved: DNS, Firebase custom-domain verification, certificate, and Hosting mapping return HTTP 200.
- Inbox provider closeout is resolved: 2026-06-21 pilot write gate confirmed 11 capture intents with inbox delivery required.
- Pilot write gate last passed on 2026-06-21 with live form writes, event writes, inbox delivery required, dedicated pilot feedback routing, fan-reaction reporting, and post-write reconciliation through the protected operator report.

## Closed - www Domain

Goal: `https://www.luxveritas.media` resolves and redirects or serves correctly over HTTPS.

Status: closed on 2026-06-18. Keep the steps below as revalidation guidance if DNS, Hosting domains, or Firebase certificates change.

Actions:

1. Confirm `www.luxveritas.media` remains added and verified as a Firebase Hosting custom domain for project `lux-veritas-media`.
2. Confirm the DNS record Firebase provides for `www` remains present in the domain DNS provider.
3. Wait for Firebase SSL and Hosting mapping to become active.
4. If Firebase offers a redirect option after SSL is active, redirect `www` to the apex domain.

Verify:

```bash
node tools/qa-domain-readiness.mjs
node tools/resolve-www-domain.mjs
dig +short www.luxveritas.media
curl -I https://www.luxveritas.media
```

After DNS and SSL are ready, close the launch gate and closeout tracker together:

```bash
LUX_WWW_CLOSEOUT_WRITE=1 \
LUX_WWW_CLOSEOUT_BY="Reviewer Name" \
LUX_WWW_CLOSEOUT_EVIDENCE="Domain readiness QA 2026-06-16" \
node tools/resolve-www-domain.mjs
```

Acceptance:

- `node tools/qa-domain-readiness.mjs` reports no blockers.
- `https://www.luxveritas.media` returns HTTP 200 or an HTTPS redirect to `https://luxveritas.media`.
- `data/lux-launch-closeout.json` marks `www_redirect` closed with a no-secret evidence reference.

## Closed - Inbox Provider

Goal: public forms store server-side and send silent inbox notifications to the approved Lux Veritas inbox.

Status: closed on 2026-06-17. Keep the steps below as revalidation guidance if the sender domain, provider secret, or Functions deployment changes.

Actions:

1. Verify the approved sender/domain in the email provider.
2. Activate the approved provider key, redeploy the inbox-aware functions, and run provider readiness:

```bash
LUX_RESEND_API_KEY="re_..." node tools/activate-inbox-delivery.mjs
```

3. Run a real write test only when the inbox owner is ready to receive QA mail:

```bash
LUX_INBOX_ACTIVATION_WRITE_TEST=1 LUX_RESEND_API_KEY="re_..." node tools/activate-inbox-delivery.mjs
```

4. Confirm the full live form matrix if launch-day write testing is needed:

```bash
LUX_FORM_MATRIX_WRITE=1 LUX_EXPECT_EMAIL_SENT=1 node tools/qa-live-form-matrix.mjs
```

5. Replay stored inbox notifications from private reporting after delivery is confirmed.

Verify:

```bash
node tools/qa-provider-readiness.mjs
node tools/qa-release-readiness.mjs
```

Acceptance:

- Provider readiness no longer reports the `RESEND_API_KEY` offline sentinel.
- Live form matrix write test reports inbox delivery.
- Pending stored submissions can be replayed by an approved operator.
- `data/lux-launch-closeout.json` marks `inbox_notifications` closed with a no-secret evidence reference.

## Blocker 3 - Privacy Approval

Goal: Privacy page is reviewed and approved for public launch.

Actions:

1. Review `/legal/privacy.html` against actual data practices.
2. Confirm capture, analytics, events, purchases, submissions, memberships, creator participation, and contact language is acceptable.
3. Use `docs/legal-review-packet.md` as the review checklist.
4. Mark approval only after the responsible legal or business reviewer accepts it:

```bash
LUX_LEGAL_SYNC_LAUNCH=1 LUX_LEGAL_EVIDENCE="Legal review packet YYYY-MM-DD" LUX_LEGAL_REVIEW_ITEM=privacy LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY="Reviewer Name" node tools/set-legal-review-status.mjs
```

Verify:

```bash
node tools/qa-public-site.mjs
node tools/qa-release-readiness.mjs
```

Acceptance:

- `data/lux-legal-review.json` has Privacy status `approved`, with `reviewedAt` and `reviewedBy`.
- Release readiness no longer reports Privacy as a blocker.
- `data/lux-launch-closeout.json` marks `privacy_review` closed with a no-secret evidence reference.

## Blocker 4 - Terms Approval

Goal: Terms page is reviewed and approved for public launch.

Actions:

1. Review `/legal/terms.html` against actual site behavior.
2. Confirm submission, membership, events, purchases, user content, creator participation, licensing, refunds/cancellations, and contact language is acceptable.
3. Use `docs/legal-review-packet.md` as the review checklist.
4. Mark approval only after the responsible legal or business reviewer accepts it:

```bash
LUX_LEGAL_SYNC_LAUNCH=1 LUX_LEGAL_EVIDENCE="Legal review packet YYYY-MM-DD" LUX_LEGAL_REVIEW_ITEM=terms LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY="Reviewer Name" node tools/set-legal-review-status.mjs
```

Verify:

```bash
node tools/qa-public-site.mjs
node tools/qa-release-readiness.mjs
```

Acceptance:

- `data/lux-legal-review.json` has Terms status `approved`, with `reviewedAt` and `reviewedBy`.
- Release readiness no longer reports Terms as a blocker.
- `data/lux-launch-closeout.json` marks `terms_review` closed with a no-secret evidence reference.

## Final Launch Gate

After all blockers are resolved:

```bash
node tools/build-static.mjs
node tools/prepare-hosting.mjs
node tools/qa-pilot-readiness.mjs
LUX_PILOT_BROWSER=1 node tools/qa-pilot-readiness.mjs
LUX_PILOT_LIVE=1 LUX_PILOT_STRICT=1 node tools/qa-pilot-readiness.mjs
node tools/qa-release-readiness.mjs
LUX_PILOT_WRITE_TESTS=1 node tools/qa-pilot-write-gate.mjs
LUX_FINAL_WRITE_TESTS=1 node tools/qa-final-release-gate.mjs
```

If all checks pass, deploy Hosting and run live verification:

```bash
firebase deploy --only hosting --project lux-veritas-media
node tools/qa-live-site.mjs
curl -sS https://luxveritas.media/data/lux-build-manifest.json
```
