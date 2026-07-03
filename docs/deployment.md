# Deployment Notes

## Current Static Prototype

Preview locally:

```bash
node tools/build-static.mjs
node tools/serve-preview.mjs
```

The preview helper serves `dist`, verifies `/data/lux-build-manifest.json`, and automatically moves to the next open port if `4173` is already occupied. Use `LUX_PREVIEW_PORT=4180 node tools/serve-preview.mjs` when you need a specific alternate port.

Validate the preview helper without leaving a server running:

```bash
node tools/qa-preview-helper.mjs
```

Validate the private collaborator upload package before sharing it:

```bash
node tools/qa-private-upload-manifest.mjs
```

Run the pilot readiness gate before release checks or deploys:

```bash
node tools/qa-pilot-readiness.mjs
```

This command rebuilds the static site, prepares the Firebase Hosting artifact, then runs the local public-site, button, access, integration, mobile, accessibility, hosting, and workflow QA gates against the fresh output. Use `LUX_PILOT_BROWSER=1` for browser-flow coverage and `LUX_PILOT_LIVE=1` after deployment credentials and live provider setup are ready.

For a GitHub-side launch audit that reports the remaining release blockers without creating live form or event writes, run the manual `Final Release Audit` workflow from GitHub Actions. It rebuilds the static site, prepares the Hosting artifact, validates the handoff/workflow guardrails, and runs:

```bash
LUX_FINAL_ALLOW_BLOCKERS=1 LUX_FINAL_SKIP_BROWSER=1 LUX_FINAL_SKIP_LIVE=1 node tools/qa-final-release-gate.mjs
```

This workflow is an audit only. It must not be used as release approval because it skips browser/live coverage and write tests by design. Final approval still requires `LUX_FINAL_WRITE_TESTS=1 node tools/qa-final-release-gate.mjs` with no blocker override.

Check whether GitHub Actions and Firebase Hosting have actually caught up to the pushed build:

```bash
node tools/qa-deploy-status.mjs
```

This compares local `HEAD`, `origin/main`, the latest public GitHub Actions Hosting run, and `/data/lux-build-manifest.json` on `luxveritas.media`. Use it when a local build is green but the live site appears stale.

If the latest Hosting workflow is queued or in progress, the deploy-status check reports its age and treats it as a blocker after 30 minutes. Override the threshold for long manual audits with `LUX_DEPLOY_ACTIVE_MAX_MINUTES=60`.

The Hosting workflow has two deploy paths. If `FIREBASE_CI_TOKEN` exists, it uses the pinned Firebase CLI. If that secret is absent, it uses `tools/deploy-firebase-hosting-rest.mjs` with Google Workload Identity / ADC to create, populate, finalize, and release a Firebase Hosting version through the Hosting REST API. Validate the artifact-only path without deploying:

```bash
LUX_FIREBASE_HOSTING_REST_DRY_RUN=1 node tools/deploy-firebase-hosting-rest.mjs
```

If both deploy paths fail at auth, either grant the GitHub Workload Identity service account Firebase Hosting release permissions or add `FIREBASE_CI_TOKEN` with `node tools/setup-firebase-ci-token.mjs`.

Check the separate manual Functions deploy path:

```bash
node tools/qa-functions-deploy-readiness.mjs
```

This no-secret check confirms the Functions workflow shape, local Firebase visibility of deployed Functions, and the latest manual GitHub Functions deploy run. If the latest manual deploy reports missing `iam.serviceAccounts.ActAs` on `lux-veritas-media@appspot.gserviceaccount.com`, use `docs/functions-deploy-iam-repair.md` to grant the GitHub deploy service account the `Service Account User` role on that service account, then rerun the manual Functions workflow. Use `LUX_FUNCTIONS_DEPLOY_STRICT=1` only when that automation blocker should fail the command.

Before launch-day operations, check the local operator machine:

```bash
node tools/qa-operator-environment.mjs
```

This no-secret check confirms the repo, Node runtime, Firebase CLI, Firebase login/project visibility, optional GitHub CLI, live asset version pointer, and local preview port. If `4173` is occupied, the check distinguishes a current Lux Veritas preview from another local app; use `node tools/serve-preview.mjs` to start the preview on the next open port without stopping unrelated work. The Firebase CLI account must be `info@luxveritas.media`; a different Google account can make provider secrets look missing even when production is healthy. Use `LUX_OPERATOR_ENV_STRICT=1` only when machine setup warnings or blockers should fail the command.

If Homebrew is unavailable or sudo is not approved, a no-sudo GitHub CLI can live at `.codex-tools/gh-local/bin/gh`. The operator check recognizes that repo-local path. To run `gh` manually from this shell, use:

```bash
export PATH="$PWD/.codex-tools/gh-local/bin:$PATH"
gh --version
gh auth status
```

For a no-secret snapshot of the MVP status, live asset version, legal status, media readiness, pilot write evidence freshness, and active launch blockers:

```bash
node tools/report-mvp-status.mjs
```

The status report also includes the no-secret launch closeout tracker so DNS, inbox, Privacy, and Terms closeout progress appears in the same operator snapshot. Pilot write evidence defaults to a 72-hour freshness window; override only for investigation with `LUX_PILOT_WRITE_EVIDENCE_MAX_AGE_HOURS`. Use `LUX_MVP_STATUS_JSON=1` when another operator or automation needs structured output. Use `LUX_MVP_STATUS_STRICT=1` only when active public-launch blockers should fail the command.

Validate the report contract before relying on it in a launch handoff:

```bash
node tools/qa-mvp-status.mjs
```

This QA treats live/local asset drift as a warning because the Hosting workflow runs it before deployment. Use `node tools/qa-deploy-status.mjs` after deploy when stale production assets should be treated as blockers.

Run the local MVP preflight when you want one no-secret command for operator environment, deploy status, launch-blocker sync, MVP status, and release-readiness signals:

```bash
node tools/qa-mvp-preflight.mjs
```

This includes a preview-helper smoke test so operators know local browser QA has a working fallback when the default preview port is occupied. Use `LUX_MVP_PREFLIGHT_STRICT=1` only when known launch blockers should fail the command.

Export a no-secret launch evidence packet for the private launch folder:

```bash
node tools/export-launch-evidence.mjs
LUX_EVIDENCE_FORMAT=json node tools/export-launch-evidence.mjs
LUX_EVIDENCE_LIVE=1 LUX_EVIDENCE_OUT=/tmp/lux-launch-evidence.md node tools/export-launch-evidence.mjs
```

Validate the evidence exporter before using it in a handoff:

```bash
node tools/qa-launch-evidence.mjs
```

Launch evidence includes the no-secret closeout tracker, so final handoffs can compare launch gates against DNS, inbox, Privacy, and Terms closeout status without exposing provider credentials or private legal materials.

Validate the no-secret closeout tracker for the four remaining public-launch blockers:

```bash
node tools/qa-launch-closeout.mjs
```

When a blocker is resolved, update the no-secret closeout tracker with an evidence reference:

```bash
LUX_CLOSEOUT_ITEM=www_redirect \
LUX_CLOSEOUT_STATUS=closed \
LUX_CLOSEOUT_BY="Reviewer Name" \
LUX_CLOSEOUT_EVIDENCE="Launch evidence packet 2026-06-16" \
node tools/set-launch-closeout-status.mjs
```

Use `LUX_CLOSEOUT_DRY_RUN=1` to validate without writing. Keep credentials, private report tokens, provider keys, screenshots with secrets, and legal advice out of `data/lux-launch-closeout.json`.

Then update the matching launch readiness gate after the verification command passes:

```bash
LUX_LAUNCH_GATE=www_redirect \
LUX_LAUNCH_STATUS=ready \
LUX_LAUNCH_BY="Reviewer Name" \
LUX_LAUNCH_EVIDENCE="Domain readiness QA 2026-06-16" \
node tools/set-launch-readiness-status.mjs
```

Use `LUX_LAUNCH_DRY_RUN=1` to validate without writing. Keep launch readiness, closeout, TODO, handoff, and runbook status synchronized before final QA.

Firebase Hosting serves the static site and rewrites:

- `/api/submit` to the Firebase Function `submitForm`
- `/api/event` to the Firebase Function `trackSiteEvent`
- `/api/report` to the Firebase Function `reportActivity`

```bash
firebase login
firebase use <project-id>
firebase deploy --only hosting,functions
```

GitHub Actions deploys use Google Workload Identity as the no-key default path. If Firebase CLI rejects that auth path, set the GitHub Actions secret `FIREBASE_CI_TOKEN` with a token generated by `firebase login:ci` from an approved Lux Veritas Firebase account. Do not use a Google access token for this secret, and do not commit the token to the repo. The Hosting and manual Functions workflows run `node tools/qa-firebase-deploy-auth.mjs` before expensive build/test work so missing deploy auth fails early with an actionable message.

Recommended recovery flow:

```bash
firebase login:ci --no-localhost
node tools/setup-firebase-ci-token.mjs
```

Paste the Firebase CLI token into the GitHub CLI secret prompt, not into chat. The helper stores `FIREBASE_CI_TOKEN`, triggers the Hosting workflow, and watches the run. Use `LUX_FIREBASE_CI_SETUP_DRY_RUN=1 node tools/setup-firebase-ci-token.mjs` to validate the helper without setting secrets.

The deploy ignore list excludes source briefs, extraction text, QA screenshots, and generation tooling.

Firebase Hosting applies baseline public headers for static pages and assets: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, and `Strict-Transport-Security`. Keep these in `firebase.json` and verify them with `node tools/qa-hosting-config.mjs`; live header verification is part of `node tools/qa-live-site.mjs`.

## Current Form Relay

The public form posts to `/api/submit`.

The Firebase Function:

- validates required fields
- rejects honeypot spam
- applies best-effort rate limiting
- assigns screened intake routing fields for protected review
- logs submissions to Firestore when available
- sends email through Resend when runtime config is present
- accepts and records submissions even when email notification is not fully configured

The site event function:

- accepts only consented analytics events
- stores CTA, media, portal, and content-view activity in Firestore `site_events`
- receives stable `cta_id` values for buttons, links, media actions, form opens, and private report actions
- hashes client network identity before storage
- leaves browser-local reporting intact as a fallback

The activity report function:

- requires a Google/Firebase bearer token from an approved Lux Veritas account
- returns protected counts and latest records from `form_submissions` and `site_events`
- returns operator summaries for lead paths, role demand, event demand, page paths, and clicked destinations
- returns screened routing summaries for intake queues and follow-up priority
- returns CTA signal summaries so button, link, and media intent can be reviewed by stable action ID
- reports pending inbox notification backlog for stored submissions
- is intended for the noindex private portal reporting page only

The private reporting page also loads `data/lux-launch-readiness.json`, `data/lux-legal-review.json`, and the public media manifest to render Launch Gates. This gives operators a browser-visible view of remaining public-launch blockers: media sources, inbox notifications, private handoff, legal review, and domain redirect status.

The private reporting page also loads a sanitized public closeout view at `/data/lux-launch-closeout-public.json`. The deploy artifact generates this from `data/lux-launch-closeout.json` without operator commands, required-evidence internals, provider secrets, or private report exports.
Live-site QA verifies this endpoint remains present and sanitized after deployment.

The public media manifest uses `luxveritas.media_manifest.v1`. Each media item carries source status, source-required, source type, reporting key, queued CTA, and fallback form path so listen/watch/radio intent can be reported even before approved media URLs are attached.

The public build manifest uses `luxveritas.build_manifest.v1` and is deployed at `/data/lux-build-manifest.json`. It records the active asset version, app script URL, stylesheet URL, media manifest version, brand-house version, fan-flywheel version, drop-room version, portal-room version, phase-status version, public terms version, and route counts so live-site diagnostics can confirm production is serving the intended build.

The public web app manifest is deployed at `/site.webmanifest` with Lux Veritas app naming, theme color, standalone display mode, and the `/assets/luxveritas-icon.svg` icon. Public-site QA validates page-level manifest links and install metadata; live-site QA validates the deployed manifest.

The public offline fallback is deployed at `/offline.html` and registered through `/service-worker.js`. The service worker only handles same-origin GET requests, skips `/api/` requests, and uses the offline page for failed navigation requests; it is a progressive enhancement, not a replacement for live form, reporting, or media delivery.

Firebase Hosting serves `/service-worker.js` with `Cache-Control: no-cache` so offline-shell updates can activate promptly instead of being held behind normal app-script caching.

Attach approved release media only after the public audio, visual, and radio/stream URLs are cleared for launch:

```bash
LUX_MEDIA_SPMVP_RELEASE_URL="https://..." \
LUX_MEDIA_VISUAL_WORLD_URL="https://..." \
LUX_MEDIA_LUX_RADIO_URL="https://..." \
node tools/set-approved-media-sources.mjs
node tools/build-static.mjs
node tools/prepare-hosting.mjs
node tools/qa-media-contract.mjs
node tools/qa-release-readiness.mjs
```

Use `LUX_MEDIA_DRY_RUN=1` to validate URLs without writing. Source URLs must be HTTPS. Poster URLs may be HTTPS or local `/assets/...` files.

The public terms manifest uses `luxveritas.public_terms.v1`. Form submissions carry the active public terms, privacy, terms, and submission terms version IDs into Firestore and the private integration payload. These version IDs support capture auditability only; they do not replace final legal review.

The legal review manifest uses `luxveritas.legal_review.v1`. Privacy and Terms remain launch blockers until each item is explicitly marked `approved` with reviewer metadata:

```bash
LUX_LEGAL_SYNC_LAUNCH=1 \
LUX_LEGAL_EVIDENCE="Legal review packet YYYY-MM-DD" \
LUX_LEGAL_REVIEW_ITEM=privacy \
LUX_LEGAL_REVIEW_STATUS=approved \
LUX_LEGAL_REVIEWED_BY="Reviewer Name" \
node tools/set-legal-review-status.mjs

LUX_LEGAL_SYNC_LAUNCH=1 \
LUX_LEGAL_EVIDENCE="Legal review packet YYYY-MM-DD" \
LUX_LEGAL_REVIEW_ITEM=terms \
LUX_LEGAL_REVIEW_STATUS=approved \
LUX_LEGAL_REVIEWED_BY="Reviewer Name" \
node tools/set-legal-review-status.mjs
```

Use `LUX_LEGAL_DRY_RUN=1` to validate the command without writing. `LUX_LEGAL_SYNC_LAUNCH=1` keeps `data/lux-legal-review.json`, `data/lux-launch-readiness.json`, and `data/lux-launch-closeout.json` synchronized. Do not mark either item approved until counsel or the responsible business reviewer has accepted the public page language.

Run `node tools/qa-legal-sync.mjs` before launch approval to verify the synced approval dry-runs and no-secret evidence guards.

The notification replay action:

- requires the same approved operator bearer token as the private report
- posts to `/api/report` with `action: "replay_pending"`
- retries stored submissions whose inbox notification did not send
- is intended for post-provider setup recovery after `RESEND_API_KEY` and the approved sender domain are live
- does not expose provider secrets or delivery internals to public pages

The inbox test action:

- requires the same approved operator bearer token as the private report
- posts to `/api/report` with `action: "test_inbox"`
- sends one controlled provider-test message through the same server-side email path as public submissions
- returns `email_provider_not_configured` until the approved provider key and sender domain are active
- should be run before replaying pending inbox records

The private handoff replay action:

- requires the same approved operator bearer token as the private report
- posts to `/api/report` with `action: "replay_integration"`
- retries stored submissions whose private handoff did not send
- is intended for post-integration setup recovery after the approved private workflow target is configured
- does not expose workflow URLs or protected hosting settings to public pages

Cloud Firestore is enabled for `lux-veritas-media`, with the default Firestore Native database in `nam5`.

This Google Workspace organization blocks public `allUsers` IAM bindings, so the public form relay uses Cloud Run's Invoker IAM check disabled setting on the generated v2 services. The Functions workflow validates Functions code on relevant `functions/**`, `firebase.json`, or workflow-file pushes. Actual Functions deployment is intentionally manual through `workflow_dispatch` until the GitHub deploy service account has `Service Account User` / `iam.serviceAccounts.ActAs` on `lux-veritas-media@appspot.gserviceaccount.com`; use `docs/functions-deploy-iam-repair.md` for the no-secret repair packet. The local Firebase CLI path remains the proven fallback. The manual deploy job reapplies the Cloud Run setting after function deploys:

```bash
gcloud run services update submitform --region us-central1 --project lux-veritas-media --no-invoker-iam-check
gcloud run services update tracksiteevent --region us-central1 --project lux-veritas-media --no-invoker-iam-check
gcloud run services update reportactivity --region us-central1 --project lux-veritas-media --no-invoker-iam-check
gcloud run services update receiveprivatehandoff --region us-central1 --project lux-veritas-media --no-invoker-iam-check
```

Verify the manual Functions deploy state with `node tools/qa-functions-deploy-readiness.mjs` after any IAM repair or Functions workflow dispatch.

Do not re-add `invoker: "public"` to the v2 function unless the org policy changes; Firebase deploy will try to write an `allUsers` IAM binding and fail.

Configure the email provider secret in Firebase Secret Manager before treating silent inbox delivery as complete:

```text
RESEND_API_KEY
```

The function defaults to `FORM_TO_EMAIL=info@luxveritas.media` and `FORM_FROM_EMAIL=Lux Veritas <forms@luxveritas.media>`. The `forms@luxveritas.media` sending domain must be verified with the email provider. Do not commit secrets to the repo.

Recommended setup:

```bash
LUX_RESEND_API_KEY="re_..." node tools/qa-resend-domain-readiness.mjs
LUX_RESEND_API_KEY="re_..." node tools/activate-inbox-delivery.mjs
LUX_FORM_WRITE=1 LUX_EXPECT_EMAIL_SENT=1 node tools/qa-form-delivery.mjs
```

`activate-inbox-delivery.mjs` runs the Resend sender-domain readiness check before writing the Firebase secret. Use `LUX_INBOX_ACTIVATION_SKIP_DOMAIN_CHECK=1` only when an approved operator has separately verified the sender domain and needs to recover deployment quickly.

If provider or release readiness reports `Firebase credentials expired`, run `firebase login --reauth --no-localhost` locally, select `info@luxveritas.media`, and paste the one-time code into the terminal prompt only before rechecking secrets or deploying Functions.

For an offline pilot deployment before the real provider key exists, keep `RESEND_API_KEY` set to `not_configured`. The function treats only values beginning with `re_` as active provider keys.

Optional sender/recipient overrides can still be set on the Cloud Run service generated by Firebase Functions:

```bash
gcloud run services update submitform \
  --region us-central1 \
  --project lux-veritas-media \
  --set-env-vars FORM_TO_EMAIL=info@luxveritas.media,FORM_FROM_EMAIL="Lux Veritas <forms@luxveritas.media>"
```

The browser form times out after 12 seconds, and server-side email/integration relays each time out after 6 seconds. Email and optional integration fanout run in parallel so a slow secondary relay does not hold the browser hostage. When inbox delivery is not configured or unavailable, the submission is still recorded when Firestore is available and the visitor sees a recorded-submission or email-draft fallback instead of a stuck submit state.

## Screened Intake Routing

Every validated form submission receives protected routing fields before storage and relay:

- `routing_queue`
- `routing_label`
- `routing_priority`
- `routing_next_action`
- `routing_sla`

These fields let the private report and future server-side integration separate membership, submissions, events, press, partner/licensing, investor, and general access requests without exposing private tools or internal workflows on the public site.

After inbox delivery is configured, open `/portal/reporting.html`, load private activity with an approved operator token, and use `Replay Pending Inbox` to retry stored submissions that were captured while email was offline. The replay endpoint only sends records whose `deliveryStatus` indicates a pending or failed inbox notification.

For pilot reporting access, use a private operator token hash. Generate a strong token outside the repo, keep the raw token in the private operator password manager, and configure only its SHA-256 hash on the `reportactivity` service:

```bash
LUX_REPORT_TOKEN="paste-private-operator-token-here" node tools/generate-report-operator-token.mjs
printf "%s" "<sha256>" | firebase functions:secrets:set REPORT_OPERATOR_TOKEN_SHA256 --project lux-veritas-media
```

The report endpoint still accepts approved Google OAuth bearer tokens for `REPORT_ALLOWED_EMAILS` or `REPORT_ALLOWED_DOMAIN`. The hash token path is for controlled pilot access before full authenticated portal accounts are ready.

For this pilot machine, the raw operator token is stored in macOS Keychain as `Lux Veritas Report Operator Token` for account `info@luxveritas.media`; do not export it into committed files. Release-readiness, provider-readiness, live operator report, pilot write, and post-write reconciliation QA can read that Keychain item when `LUX_REPORT_TOKEN` is not set.

Optional server-side integration fanout can forward validated, stored form submissions to an approved private tool such as a CRM, Google workflow, or automation router. Keep this server-side only. Do not place integration URLs in public markup or client JavaScript.

Set `FORM_INTEGRATION_TARGET` to a short protected workflow profile label, such as `private_workflow`. This label is not a provider URL; it lets private reporting and receivers confirm which approved handoff profile is active. The server sends it in the `X-Lux-Target` header and in the payload receiver metadata.

After the private integration target and target profile are configured, use `Replay Pending Handoff` on `/portal/reporting.html` to retry stored submissions whose `integrationStatus` indicates a pending or failed private handoff.

The MVP includes a signed internal Firebase receiver, `receivePrivateHandoff`, for a real private intake queue before GoHighLevel or Google Suite automation is selected. It requires `X-Lux-Signature`, validates `luxveritas.form_submission.v1`, and stores accepted payloads in the protected `private_handoffs` collection. This is a server-side bridge only; public pages still post only to `/api/submit`.

Private handoff target labels are tracked in `docs/private-integration-profiles.json`. This file is a no-secret registry only: it contains approved profile labels, intended provider class, required Firebase secret names, and the shared handoff contract. It must not contain provider URLs, tokens, webhook paths, or credentials. Current and future labels include:

- `firebase_handoff` - current signed internal Firebase receiver.
- `private_workflow` - generic approved private workflow.
- `ghl_crm` - future CRM profile after account and workflow approval.
- `google_workspace` - future workspace intake profile after account and workflow approval.
- `codex_ops` - future build-packet routing profile after operator approval.

Downstream field mapping is tracked in `docs/private-integration-field-map.json`. This no-secret map aligns the versioned form payload with contact, routing, audit, tag, archive, and review-packet fields for `firebase_handoff`, `private_workflow`, `ghl_crm`, `google_workspace`, and `codex_ops`. It is an implementation guide only; receiver URLs, account identifiers, field IDs, tokens, and private workflow details still belong outside the repo.

Downstream routing readiness is tracked in `docs/private-workflow-matrix.json`. Use it before selecting GHL, Google Workspace, or CodexOps so every public capture queue has an owner, SLA, current `firebase_handoff` path, approved next profiles, workflow actions, and acceptance checks. Validate it with:

```bash
node tools/qa-private-workflow-matrix.mjs
```

External target selection is tracked in `docs/external-workflow-targets.json`. Use it as the no-secret decision layer before replacing the MVP `firebase_handoff` target with GHL, Google Workspace, CodexOps, or a generic approved private workflow. Validate it with:

```bash
node tools/qa-external-workflow-targets.mjs
```

Private workflow selection readiness is tracked in `docs/private-workflow-selection.json`. It keeps `firebase_handoff` active, recommends `google_workspace` as the first external approval target for review/archive/legal-version evidence, places `ghl_crm` second for membership and event follow-up, and defers `codex_ops` until operator packet rules are approved. Validate it with:

```bash
node tools/qa-private-workflow-selection.mjs
```

Export a no-secret private integration activation request before choosing or changing the external workflow target:

```bash
node tools/export-private-integration-request.mjs
LUX_PRIVATE_INTEGRATION_PACKET_OUT=/tmp/lux-private-integration-request.md node tools/export-private-integration-request.mjs
LUX_PRIVATE_INTEGRATION_PACKET_FORMAT=json node tools/export-private-integration-request.mjs
node tools/qa-private-integration-field-map.mjs
node tools/qa-private-workflow-matrix.mjs
node tools/qa-private-workflow-selection.mjs
node tools/qa-private-integration-request.mjs
```

The exported request lists the active and future profile labels, required Firebase secret names, handoff contract, current pilot-write evidence, a sanitized receiver implementation sample, dry-run command, approval guard for future profiles, and acceptance checks. It also renders a focused `google_workspace` first-activation section with required approval fields, queue coverage, dry-run command, post-activation checks, acceptance criteria, and Firebase rollback. Move the generated file to the private launch folder before storing real provider URLs, workflow notes, or approval records.

The private operator report includes accepted handoff counts, recent handoff receipts, and handoff summaries by target, event type, source page, and routing queue. Pending handoffs still come from submission records whose `integrationStatus` has not reached `sent`; accepted handoffs come from the protected `private_handoffs` collection.

```bash
LUX_FORM_INTEGRATION_URL="https://..." \
LUX_FORM_INTEGRATION_SIGNING_SECRET="approved-shared-secret" \
LUX_FORM_INTEGRATION_TARGET="firebase_handoff" \
node tools/activate-private-integration.mjs
```

Use `LUX_PRIVATE_INTEGRATION_ACTIVATION_DRY_RUN=1` to validate profile, URL shape, and activation flow without writing secrets or deploying. Future profiles such as `ghl_crm`, `google_workspace`, and `codex_ops` require `LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1` after human approval.

The activation helper wraps `tools/setup-private-integration-secret.mjs` so operators use approved profile labels before any secret update or function deploy.

For the internal Firebase receiver profile, use the deployed HTTPS function URL as `LUX_FORM_INTEGRATION_URL`, set `LUX_FORM_INTEGRATION_TARGET=firebase_handoff`, set a strong private signing secret, redeploy `submitForm`, `reportActivity`, and `receivePrivateHandoff`, then replay pending handoffs from the private report.

For an offline pilot deployment before the real endpoint exists, keep `FORM_INTEGRATION_URL` and `FORM_INTEGRATION_SIGNING_SECRET` set to `not_configured`, and keep `FORM_INTEGRATION_TARGET` set to `unconfigured`. `FORM_INTEGRATION_URL` must be HTTPS before the handoff is treated as active. `FORM_INTEGRATION_SIGNING_SECRET` is optional but recommended; when present, the function sends an `X-Lux-Signature` HMAC header with each submission payload.

## Private Integration Contract

The server-side private handoff sends a versioned, replay-safe JSON payload. Receivers should treat `idempotencyKey` as the stable duplicate-protection key across first delivery and replay attempts.

Current contract:

```text
schemaVersion: luxveritas.form_submission.v1
eventType: form.submission.received
idempotencyKey: luxveritas:form_submission:<submissionId>
replaySafe: true
```

The function also sends:

```text
X-Lux-Event: luxveritas.form_submission.v1
X-Lux-Idempotency-Key: luxveritas:form_submission:<submissionId>
X-Lux-Target: <protected workflow profile>
X-Lux-Signature: <hmac-sha256 body signature when configured>
```

Payload fields include submission/receipt IDs, source page, form type, inquiry type/key, role/access path, screened routing, contact, consent, and message. Keep workflow URLs, credentials, and receiver-specific field mapping server-side.

Form delivery QA:

```bash
node tools/qa-pilot-readiness.mjs
LUX_PILOT_BROWSER=1 LUX_PILOT_LIVE=1 node tools/qa-pilot-readiness.mjs
node tools/qa-form-delivery.mjs
node tools/qa-integrations.mjs
node tools/qa-integration-contract.mjs
node tools/qa-media-contract.mjs
node tools/qa-hosting-config.mjs
node tools/qa-live-form-matrix.mjs
node tools/qa-live-event-matrix.mjs
node tools/qa-release-readiness.mjs
node tools/qa-domain-readiness.mjs
node tools/qa-functions-deploy-readiness.mjs
node tools/qa-provider-readiness.mjs
node tools/qa-live-assets.mjs
node tools/qa-live-media-sources.mjs
node tools/qa-live-operator-report.mjs
node tools/qa-live-product-boundary.mjs
node tools/qa-deploy-status.mjs
/Users/frederickparent/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tools/qa-browser-flows.mjs
LUX_BROWSER_BASE_URL=https://luxveritas.media node tools/qa-browser-flows.mjs
LUX_FORM_WRITE=1 node tools/qa-form-delivery.mjs
LUX_FORM_MATRIX_WRITE=1 node tools/qa-live-form-matrix.mjs
LUX_EVENT_MATRIX_WRITE=1 node tools/qa-live-event-matrix.mjs
LUX_FORM_WRITE=1 LUX_EXPECT_EMAIL_SENT=1 node tools/qa-form-delivery.mjs
LUX_RELEASE_STRICT=1 node tools/qa-release-readiness.mjs
```

The default pilot-readiness command runs local code gates only. Add `LUX_PILOT_BROWSER=1` for Playwright browser-flow coverage and `LUX_PILOT_LIVE=1` for live domain/provider/release checks, including deploy-status alignment, no-write live form matrix, and event matrix reachability; add `LUX_PILOT_STRICT=1` when external launch blockers must fail the aggregate command. The default form-delivery, live form matrix, and live event matrix commands check validation without creating records. `LUX_FORM_WRITE=1` creates one safe QA submission. `LUX_FORM_MATRIX_WRITE=1` creates one safe QA submission for each unique capture intent: request, fan, submission, press, investor, event, Codex, licensing, creator, pilot feedback, and portal sign-in. It reports whether each intent was sent to inbox or stored only, and the submit rate limit allows the complete 11-intent matrix plus normal smoke checks from the same launch machine. `LUX_EVENT_MATRIX_WRITE=1` creates one safe QA event for each major reporting path: view, form open, link click, media action, media playback lifecycle, accepted lead, rejected lead, and report action. Add `LUX_EXPECT_EMAIL_SENT=1` after email configuration to make the form commands fail unless inbox delivery is active. Browser-flow QA serves the built `dist` locally, mocks form delivery, and verifies real CTA clicks, modal submits, submit reset behavior, media-player source mapping, playback lifecycle reporting, and media-player follow-up routing. Public-site, live-site, live-product-boundary, deploy-status, and release-readiness QA validate `/data/lux-build-manifest.json` so stale production assets are visible quickly. Live-product-boundary QA also checks production CSS, robots, private-steward noindex, and the retired internal route redirect. Release-readiness QA reports launch blockers in normal mode and fails in `LUX_RELEASE_STRICT=1` mode; when `LUX_REPORT_TOKEN` is supplied, it uses live `/api/report` provider status for inbox, handoff, and operator-token gates. Domain-readiness QA reports apex and `www` DNS/HTTPS blockers in normal mode and fails in `LUX_DOMAIN_STRICT=1` mode. Provider-readiness QA checks Firebase secret metadata, classifies secret values as active/offline/invalid without printing secrets, and, when `LUX_REPORT_TOKEN` is supplied, checks live inbox, private handoff, and operator-token status from `/api/report`; use `LUX_PROVIDER_STRICT=1` when provider blockers must fail the command.

## Future Production Build

The approved production build should move to Next.js App Router and Firebase App Hosting. Store all secrets in Firebase App Hosting environment configuration or Google Cloud Secret Manager.

Required production secrets are listed in `.env.example`.

Do not commit:

- `.env`
- Firebase private keys
- Supabase service-role keys
- GoHighLevel webhook URLs
- Stripe secrets
- Printify tokens

## Manual Setup Before Launch

- Connect GitHub repo to Firebase App Hosting.
- Configure custom domain `luxveritas.media`.
- Configure `www.luxveritas.media` in Firebase Hosting and DNS. Current root apex uses Firebase Hosting IP `199.36.158.100`; `www` currently has no public A or CNAME record. Add `www.luxveritas.media` as a second Firebase Hosting custom domain, then add the DNS record Firebase gives for `www`. After SSL is active, redirect `www` to the apex if Firebase offers that option. Verify with `node tools/qa-domain-readiness.mjs`, `dig +short www.luxveritas.media`, and `curl -I https://www.luxveritas.media`.
- Add SPF/DKIM for sending domain.
- Create GoHighLevel forms, workflows, tags, and pipelines.
- Apply Supabase migrations.
- Review legal/privacy/terms copy.
- Run full mobile, accessibility, form-delivery, and analytics QA.
