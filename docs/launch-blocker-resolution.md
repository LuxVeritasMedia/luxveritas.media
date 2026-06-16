# Lux Veritas Launch Blocker Resolution

Status date: 2026-06-11

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

## Current Evidence

- Apex site: `https://luxveritas.media` returns HTTP 200.
- Live build version: `20260611-report-gate-readiness`.
- Browser-flow pilot QA passes locally with form, media, and reporting paths.
- Private handoff secret set is active for `firebase_handoff`.
- Operator reporting token hash is configured.
- Release readiness currently reports four blockers: inbox provider, Privacy approval, Terms approval, and `www` DNS.

## Blocker 1 - www Domain

Goal: `https://www.luxveritas.media` resolves and redirects or serves correctly over HTTPS.

Actions:

1. Add `www.luxveritas.media` as a Firebase Hosting custom domain for project `lux-veritas-media`.
2. Add the DNS record Firebase provides for `www` in the domain DNS provider.
3. Wait for Firebase SSL to become active.
4. If Firebase offers a redirect option, redirect `www` to the apex domain.

Verify:

```bash
node tools/qa-domain-readiness.mjs
dig +short www.luxveritas.media
curl -I https://www.luxveritas.media
```

Acceptance:

- `node tools/qa-domain-readiness.mjs` reports no blockers.
- `https://www.luxveritas.media` returns HTTP 200 or an HTTPS redirect to `https://luxveritas.media`.
- `data/lux-launch-closeout.json` marks `www_redirect` closed with a no-secret evidence reference.

## Blocker 2 - Inbox Provider

Goal: public forms store server-side and send silent inbox notifications to the approved Lux Veritas inbox.

Actions:

1. Verify the approved sender/domain in the email provider.
2. Set the approved provider key without printing it:

```bash
LUX_RESEND_API_KEY="re_..." node tools/setup-inbox-provider-secret.mjs
```

3. Redeploy the functions that read the inbox secret:

```bash
firebase deploy --only functions:submitForm,functions:reportActivity --project lux-veritas-media --non-interactive --force
```

4. Run a real write test only when the inbox owner is ready to receive QA mail:

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
LUX_LEGAL_REVIEW_ITEM=privacy LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY="Reviewer Name" node tools/set-legal-review-status.mjs
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
LUX_LEGAL_REVIEW_ITEM=terms LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY="Reviewer Name" node tools/set-legal-review-status.mjs
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
LUX_FINAL_WRITE_TESTS=1 node tools/qa-final-release-gate.mjs
```

If all checks pass, deploy Hosting and run live verification:

```bash
firebase deploy --only hosting --project lux-veritas-media
node tools/qa-live-site.mjs
curl -sS https://luxveritas.media/data/lux-build-manifest.json
```
