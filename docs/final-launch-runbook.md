# Lux Veritas Final Launch Runbook

Status date: 2026-07-10

Use this only when moving from pilot-ready to public-release ready. Keep secrets out of the repo and terminal history where possible. Do not call the site release-ready until the final gate passes with write tests enabled and without blocker overrides.

## Starting State

- Apex site is live at `https://luxveritas.media`.
- `www.luxveritas.media` returns HTTP 200.
- Current release candidate asset version is `20260710-media-control-r2`.
- Current phase status is Phase 5 portal pilot prep and release control. Phase 4 legal closeout is approved.
- Media, fan reactions, inbox delivery, private handoff, operator reporting, private intake queue workbench, and private workflow-target recommendation reporting are ready.
- The pilot write gate last passed on 2026-07-17 with 11 live QA submissions, including dedicated pilot feedback routing, inbox delivery required, 13 live event writes, media checks, browser-flow coverage, consented page-view reporting, signal-pass export coverage, protected activation-readiness reporting, and protected operator-report verification. QA run ID: `20260717104612`. Asset version: `20260717-public-release-r7`. The live event matrix includes fan-reaction and release-room retention reporting for the media retention loop, and the gate reconciles exact write-run IDs back through the protected report.
- The no-secret receipt is tracked in `data/lux-pilot-write-evidence.json` and validated with `node tools/qa-pilot-write-evidence.mjs`. Final release requires fresh pilot write evidence; the default freshness window is 72 hours and can be inspected with `LUX_PILOT_WRITE_EVIDENCE_MAX_AGE_HOURS`.
- Known pilot issues are tracked without secrets in `data/lux-pilot-bug-register.json` and validated with `node tools/qa-pilot-bug-register.mjs`. The current decision is `pilot_can_continue` with no known blocking bugs.
- Pilot scenario coverage is tracked in `data/lux-pilot-test-matrix.json`.
- Privacy and Terms owner approval is recorded. Final release still requires pilot write evidence to be refreshed for the current deployed build.

## Launch Order

1. Confirm this operator machine is ready, then confirm the repo and live site are aligned:

```bash
node tools/qa-operator-environment.mjs
node tools/report-mvp-status.mjs
node tools/qa-mvp-preflight.mjs
node tools/export-launch-evidence.mjs
node tools/qa-launch-evidence.mjs
node tools/qa-pilot-test-matrix.mjs
node tools/qa-pilot-write-evidence.mjs
node tools/qa-pilot-bug-register.mjs
node tools/report-open-approvals.mjs
node tools/qa-open-approvals.mjs
node tools/qa-open-approval-decision-forms.mjs
node tools/qa-legal-approval-closeout.mjs
node tools/qa-action-inventory.mjs
node tools/qa-private-integration-activation-dry-runs.mjs
node tools/qa-functions-iam-repair-request.mjs
git status --short --branch
node tools/qa-deploy-status.mjs
node tools/qa-functions-deploy-readiness.mjs
```

If the operator-environment check reports a different Firebase account, log it out and run a fresh login with `info@luxveritas.media` before checking provider secrets or deploying Functions.

If provider readiness says the live provider report is active but local Firebase CLI credentials are expired, the live site is not failing. Refresh only the operator machine:

```bash
firebase login --reauth --no-localhost
node tools/qa-provider-readiness.mjs
```

Select `info@luxveritas.media` in the browser approval flow. Paste the one-time authorization code into the terminal prompt only, never into chat, docs, git, or issue comments.

If the Hosting workflow fails at `Preflight Firebase deploy auth`, generate a Firebase CLI token from the approved Firebase account and store it in GitHub Actions:

```bash
firebase login:ci --no-localhost
node tools/setup-firebase-ci-token.mjs
```

Paste the token into the GitHub CLI prompt only. The helper sets `FIREBASE_CI_TOKEN`, triggers the Hosting workflow, and watches the run.

The Hosting workflow also has a no-token fallback: when `FIREBASE_CI_TOKEN` is absent, it tries `node tools/deploy-firebase-hosting-rest.mjs` with the GitHub Workload Identity service account. If the REST fallback fails, the service account needs Firebase Hosting release permissions, or the Firebase CLI token path above must be completed. Dry-run the REST artifact path without deploying:

```bash
LUX_FIREBASE_HOSTING_REST_DRY_RUN=1 node tools/deploy-firebase-hosting-rest.mjs
```

If `node tools/qa-functions-deploy-readiness.mjs` reports the manual Functions deploy blocker for `iam.serviceAccounts.ActAs`, use `docs/functions-deploy-iam-repair.md` to grant the GitHub deploy service account `roles/iam.serviceAccountUser` on `lux-veritas-media@appspot.gserviceaccount.com`, then rerun the manual Functions workflow before relying on automation for future function deploys. This is an automation-hardening blocker and requires explicit project-owner approval before any IAM policy is changed; do not paste service-account keys or GitHub secret values into the repo.

Use `LUX_FUNCTIONS_IAM_PACKET_OUT=/tmp/lux-functions-iam-repair-request.md node tools/export-functions-iam-repair-request.mjs` when a Google Cloud administrator needs a clean no-secret repair packet.

If `node tools/qa-pilot-write-evidence.mjs` reports stale pilot write evidence, rerun the live write gate before final release approval:

```bash
LUX_PILOT_WRITE_TESTS=1 node tools/qa-pilot-write-gate.mjs
```

If the form, event, and protected-report reconciliation checks already passed for a named QA run but local browser startup interrupted the final evidence write, resume that exact run without resending forms:

```bash
LUX_PLAYWRIGHT_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
LUX_PILOT_RESUME_QA_RUN_ID="YYYYMMDDHHMMSS" \
node tools/qa-pilot-write-gate.mjs
```

Resume only a run whose expected 11 form receipts and 13 event receipts have already passed post-write reconciliation.

After any pilot write-gate rerun or bug triage change, rerun the bug-register QA:

```bash
node tools/qa-pilot-bug-register.mjs
```

For current-build release proof, run the pilot write gate. This sends live QA submissions and event writes, requires inbox delivery, checks the live media sources, verifies protected operator reporting, and reconciles the exact write-run IDs back through the protected report:

```bash
LUX_PILOT_WRITE_TESTS=1 node tools/qa-pilot-write-gate.mjs
```

For a non-writing rehearsal only:

```bash
LUX_PILOT_WRITE_DRY_RUN=1 node tools/qa-pilot-write-gate.mjs
```

2. Reconfirm `www` HTTPS:

```bash
node tools/qa-domain-readiness.mjs
node tools/resolve-www-domain.mjs
dig +short www.luxveritas.media
curl -I https://www.luxveritas.media
```

3. Reconfirm inbox delivery if the sender domain, Firebase Functions, or provider secret changes:

```bash
node tools/run-resend-inbox-activation-terminal.mjs
LUX_RESEND_API_KEY="re_..." node tools/activate-inbox-delivery.mjs
```

Prefer the terminal runner for live operator work because it keeps the Resend key out of shell history and leaves only non-secret output in `/tmp/lux-resend-activation.log`.

Use `LUX_INBOX_ACTIVATION_WRITE_TEST=1` only when the inbox owner is ready to receive QA mail. That mode sends a live form write and requires inbox delivery.

Inbox delivery was last confirmed by the 2026-07-17 pilot write gate, QA run ID `20260717104612`, with 11 live capture intents, 13 event writes, and inbox delivery required. Current pilot evidence asset version: `20260717-public-release-r7`. Re-run the live form matrix only if sender domain, provider secret, Functions deployment, or final release evidence freshness changes:

```bash
LUX_FORM_MATRIX_WRITE=1 LUX_EXPECT_EMAIL_SENT=1 node tools/qa-live-form-matrix.mjs
```

4. Reconfirm the recorded legal approval state. Do not change it unless a reviewer provides new evidence:

```bash
node tools/export-legal-review-request.mjs
LUX_LEGAL_PACKET_OUT=/tmp/lux-legal-review-request.md node tools/export-legal-review-request.mjs
LUX_APPROVAL_FORMS_OUT=/tmp/lux-open-approval-decision-forms.md node tools/export-open-approval-decision-forms.mjs
node tools/qa-open-approval-decision-forms.mjs
node tools/qa-legal-review-request.mjs
node tools/qa-legal-sync.mjs
node tools/qa-legal-approval-closeout.mjs
LUX_LEGAL_CONFIRM_WRITE=1 LUX_LEGAL_SYNC_LAUNCH=1 LUX_LEGAL_EVIDENCE="Legal review packet YYYY-MM-DD" LUX_LEGAL_REVIEW_ITEM=privacy LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY="Reviewer Name" node tools/set-legal-review-status.mjs
LUX_LEGAL_CONFIRM_WRITE=1 LUX_LEGAL_SYNC_LAUNCH=1 LUX_LEGAL_EVIDENCE="Legal review packet YYYY-MM-DD" LUX_LEGAL_REVIEW_ITEM=terms LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY="Reviewer Name" node tools/set-legal-review-status.mjs
node tools/build-static.mjs
node tools/prepare-hosting.mjs
node tools/qa-release-readiness.mjs
```

5. Commit, push, and wait for Hosting deploy:

```bash
git status --short --branch
git add data/lux-legal-review.json data/lux-launch-readiness.json data/lux-launch-closeout.json legal/privacy.html legal/terms.html data/lux-build-manifest.json service-worker.js
git commit -m "Approve launch legal review"
git push origin main
node tools/qa-deploy-status.mjs
node tools/qa-live-assets.mjs
node tools/qa-live-media-sources.mjs
node tools/qa-live-operator-report.mjs
```

6. Run final release approval with real writes:

```bash
LUX_FINAL_WRITE_TESTS=1 node tools/qa-final-release-gate.mjs
```

The final gate also runs operator-environment, MVP status, MVP preflight, and launch-evidence checks before strict deploy/domain/provider/release checks. Treat warnings from those early checks as launch-day operator cleanup, even when the formal blocker is still one of the known external gates.

## Do Not Ship If

- `LUX_FINAL_ALLOW_BLOCKERS=1` is required for the final gate to pass.
- `LUX_FINAL_SKIP_BROWSER=1` or `LUX_FINAL_SKIP_LIVE=1` is used for final approval.
- `LUX_FINAL_WRITE_TESTS=1` has not been run.
- `LUX_PILOT_WRITE_TESTS=1 node tools/qa-pilot-write-gate.mjs` has not passed for the current live build during the pilot release rehearsal.
- `node tools/qa-pilot-write-evidence.mjs` reports stale pilot write evidence for the final release window.
- `node tools/qa-pilot-bug-register.mjs` reports open blocking bugs or stale pilot evidence.
- Live form writes do not send to `info@luxveritas.media`.
- The live operator report cannot be verified with `LUX_REPORT_TOKEN`.
- Privacy or Terms still show `needs_review`.
- `www.luxveritas.media` does not serve/redirect over HTTPS.

## After The Gate Passes

- Replay pending inbox notifications from `/portal/reporting.html` with an approved operator token.
- Save the passing pilot write-gate output in the private launch folder if the gate was run for release rehearsal.
- Export the private report JSON/CSV for launch evidence.
- Export the no-secret legal review request with `LUX_LEGAL_PACKET_OUT=/tmp/lux-legal-review-request.md node tools/export-legal-review-request.mjs`, then move it to the private launch folder with any real legal approval notes.
- Export the no-secret private integration request with `LUX_PRIVATE_INTEGRATION_PACKET_OUT=/tmp/lux-private-integration-request.md node tools/export-private-integration-request.mjs`, run `node tools/qa-private-integration-field-map.mjs`, `node tools/qa-private-workflow-matrix.mjs`, `node tools/qa-external-workflow-targets.mjs`, `node tools/qa-private-workflow-selection.mjs`, `node tools/qa-private-workflow-approval-closeout.mjs`, and `node tools/qa-private-integration-request.mjs`, then move it to the private launch folder before adding any real provider workflow details. The source selection file remains `docs/private-workflow-selection.json`; the exported request includes the `google_workspace` first-activation packet with approval fields, current pilot-write evidence, a sanitized receiver implementation sample, dry-run command, live acceptance checks, and Firebase rollback while `firebase_handoff` remains active.
- Export the no-secret launch evidence packet with `LUX_EVIDENCE_LIVE=1 LUX_EVIDENCE_OUT=/tmp/lux-launch-evidence.md node tools/export-launch-evidence.mjs`, then move it to the private launch folder.
- Record the passing final-gate command output in the private launch folder.
- Do not paste provider keys, operator tokens, or private report exports into this public repo.
