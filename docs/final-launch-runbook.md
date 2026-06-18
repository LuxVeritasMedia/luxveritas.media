# Lux Veritas Final Launch Runbook

Status date: 2026-06-18

Use this only when moving from pilot-ready to public-release ready. Keep secrets out of the repo and terminal history where possible. Do not call the site release-ready until the final gate passes with write tests enabled and without blocker overrides.

## Starting State

- Apex site is live at `https://luxveritas.media`.
- Current asset version is `20260616-closeout-report`.
- Media, inbox delivery, private handoff, and operator reporting are ready.
- Remaining blockers are `www` Firebase certificate/Hosting mapping, Privacy approval, and Terms approval.

## Launch Order

1. Confirm this operator machine is ready, then confirm the repo and live site are aligned:

```bash
node tools/qa-operator-environment.mjs
node tools/report-mvp-status.mjs
node tools/qa-mvp-preflight.mjs
node tools/qa-launch-evidence.mjs
git status --short --branch
node tools/qa-deploy-status.mjs
```

2. Clear `www` Firebase certificate/Hosting mapping:

```bash
node tools/qa-domain-readiness.mjs
node tools/resolve-www-domain.mjs
dig +short www.luxveritas.media
curl -I https://www.luxveritas.media
```

3. Reconfirm inbox delivery if the sender domain, Firebase Functions, or provider secret changes:

```bash
LUX_RESEND_API_KEY="re_..." node tools/activate-inbox-delivery.mjs
```

Use `LUX_INBOX_ACTIVATION_WRITE_TEST=1` only when the inbox owner is ready to receive QA mail. That mode sends a live form write and requires inbox delivery.

Inbox delivery was last confirmed on 2026-06-17 with:

```bash
LUX_FORM_MATRIX_WRITE=1 LUX_EXPECT_EMAIL_SENT=1 node tools/qa-live-form-matrix.mjs
```

4. Approve legal only after review:

```bash
LUX_LEGAL_REVIEW_ITEM=privacy LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY="Reviewer Name" node tools/set-legal-review-status.mjs
LUX_LEGAL_REVIEW_ITEM=terms LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY="Reviewer Name" node tools/set-legal-review-status.mjs
node tools/build-static.mjs
node tools/prepare-hosting.mjs
node tools/qa-release-readiness.mjs
```

5. Commit, push, and wait for Hosting deploy:

```bash
git status --short --branch
git add data/lux-legal-review.json legal/privacy.html legal/terms.html data/lux-build-manifest.json service-worker.js
git commit -m "Approve launch legal review"
git push origin main
node tools/qa-deploy-status.mjs
```

6. Run final release approval with real writes:

```bash
LUX_FINAL_WRITE_TESTS=1 node tools/qa-final-release-gate.mjs
```

The final gate also runs operator-environment, MVP status, and MVP preflight checks before strict deploy/domain/provider/release checks. Treat warnings from those early checks as launch-day operator cleanup, even when the formal blocker is still one of the known external gates.

## Do Not Ship If

- `LUX_FINAL_ALLOW_BLOCKERS=1` is required for the final gate to pass.
- `LUX_FINAL_SKIP_BROWSER=1` or `LUX_FINAL_SKIP_LIVE=1` is used for final approval.
- `LUX_FINAL_WRITE_TESTS=1` has not been run.
- Live form writes do not send to `info@luxveritas.media`.
- Privacy or Terms still show `needs_review`.
- `www.luxveritas.media` still returns Firebase 404 or does not serve/redirect over HTTPS.

## After The Gate Passes

- Replay pending inbox notifications from `/portal/reporting.html` with an approved operator token.
- Export the private report JSON/CSV for launch evidence.
- Export the no-secret launch evidence packet with `LUX_EVIDENCE_LIVE=1 LUX_EVIDENCE_OUT=/tmp/lux-launch-evidence.md node tools/export-launch-evidence.mjs`, then move it to the private launch folder.
- Record the passing final-gate command output in the private launch folder.
- Do not paste provider keys, operator tokens, or private report exports into this public repo.
