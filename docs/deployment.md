# Deployment Notes

## Current Static Prototype

Preview locally:

```bash
node tools/build-static.mjs
python3 -m http.server 4173
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

Before launch-day operations, check the local operator machine:

```bash
node tools/qa-operator-environment.mjs
```

This no-secret check confirms the repo, Node runtime, Firebase CLI, Firebase login/project visibility, optional GitHub CLI, live asset version pointer, and local preview port. Use `LUX_OPERATOR_ENV_STRICT=1` only when machine setup warnings or blockers should fail the command.

For a no-secret snapshot of the MVP status, live asset version, legal status, media readiness, and active launch blockers:

```bash
node tools/report-mvp-status.mjs
```

The status report also includes the no-secret launch closeout tracker so DNS, inbox, Privacy, and Terms closeout progress appears in the same operator snapshot. Use `LUX_MVP_STATUS_JSON=1` when another operator or automation needs structured output. Use `LUX_MVP_STATUS_STRICT=1` only when active public-launch blockers should fail the command.

Validate the report contract before relying on it in a launch handoff:

```bash
node tools/qa-mvp-status.mjs
```

This QA treats live/local asset drift as a warning because the Hosting workflow runs it before deployment. Use `node tools/qa-deploy-status.mjs` after deploy when stale production assets should be treated as blockers.

Run the local MVP preflight when you want one no-secret command for operator environment, deploy status, launch-blocker sync, MVP status, and release-readiness signals:

```bash
node tools/qa-mvp-preflight.mjs
```

Use `LUX_MVP_PREFLIGHT_STRICT=1` only when known launch blockers should fail the command.

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

The public media manifest uses `luxveritas.media_manifest.v1`. Each media item carries source status, source-required, source type, reporting key, queued CTA, and fallback form path so listen/watch/radio intent can be reported even before approved media URLs are attached.

The public build manifest uses `luxveritas.build_manifest.v1` and is deployed at `/data/lux-build-manifest.json`. It records the active asset version, app script URL, stylesheet URL, media manifest version, public terms version, and route counts so live-site diagnostics can confirm production is serving the intended build.

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
LUX_LEGAL_REVIEW_ITEM=privacy \
LUX_LEGAL_REVIEW_STATUS=approved \
LUX_LEGAL_REVIEWED_BY="Reviewer Name" \
node tools/set-legal-review-status.mjs

LUX_LEGAL_REVIEW_ITEM=terms \
LUX_LEGAL_REVIEW_STATUS=approved \
LUX_LEGAL_REVIEWED_BY="Reviewer Name" \
node tools/set-legal-review-status.mjs
```

Use `LUX_LEGAL_DRY_RUN=1` to validate the command without writing. Do not mark either item approved until counsel or the responsible business reviewer has accepted the public page language.

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

This Google Workspace organization blocks public `allUsers` IAM bindings, so the public form relay uses Cloud Run's Invoker IAM check disabled setting on the generated `submitform` service. The Functions workflow validates Functions code on relevant `functions/**`, `firebase.json`, or workflow-file pushes. Actual Functions deployment is intentionally manual through `workflow_dispatch` until the GitHub deploy service account has the same proven permissions as the local Firebase CLI path. The manual deploy job reapplies the Cloud Run setting after function deploys:

```bash
gcloud run services update submitform --region us-central1 --project lux-veritas-media --no-invoker-iam-check
gcloud run services update tracksiteevent --region us-central1 --project lux-veritas-media --no-invoker-iam-check
gcloud run services update reportactivity --region us-central1 --project lux-veritas-media --no-invoker-iam-check
```

Do not re-add `invoker: "public"` to the v2 function unless the org policy changes; Firebase deploy will try to write an `allUsers` IAM binding and fail.

Configure the email provider secret in Firebase Secret Manager before treating silent inbox delivery as complete:

```text
RESEND_API_KEY
```

The function defaults to `FORM_TO_EMAIL=info@luxveritas.media` and `FORM_FROM_EMAIL=Lux Veritas <forms@luxveritas.media>`. The `forms@luxveritas.media` sending domain must be verified with the email provider. Do not commit secrets to the repo.

Recommended setup:

```bash
LUX_RESEND_API_KEY="re_..." node tools/setup-inbox-provider-secret.mjs
firebase deploy --only functions:submitForm,functions:reportActivity --project lux-veritas-media --non-interactive --force
LUX_FORM_WRITE=1 LUX_EXPECT_EMAIL_SENT=1 node tools/qa-form-delivery.mjs
```

If provider or release readiness reports `Firebase credentials expired`, run `firebase login --reauth` locally before rechecking secrets or deploying Functions.

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

For this pilot machine, the raw operator token is stored in macOS Keychain as `Lux Veritas Report Operator Token` for account `info@luxveritas.media`; do not export it into committed files.

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

The private operator report includes accepted handoff counts, recent handoff receipts, and handoff summaries by target, event type, source page, and routing queue. Pending handoffs still come from submission records whose `integrationStatus` has not reached `sent`; accepted handoffs come from the protected `private_handoffs` collection.

```bash
LUX_FORM_INTEGRATION_URL="https://..." \
LUX_FORM_INTEGRATION_SIGNING_SECRET="approved-shared-secret" \
LUX_FORM_INTEGRATION_TARGET="private_workflow" \
node tools/setup-private-integration-secret.mjs
firebase deploy --only functions:submitForm,functions:reportActivity,functions:receivePrivateHandoff --project lux-veritas-media --non-interactive --force
```

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
node tools/qa-provider-readiness.mjs
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

The default pilot-readiness command runs local code gates only. Add `LUX_PILOT_BROWSER=1` for Playwright browser-flow coverage and `LUX_PILOT_LIVE=1` for live domain/provider/release checks, including deploy-status alignment, no-write live form matrix, and event matrix reachability; add `LUX_PILOT_STRICT=1` when external launch blockers must fail the aggregate command. The default form-delivery, live form matrix, and live event matrix commands check validation without creating records. `LUX_FORM_WRITE=1` creates one safe QA submission. `LUX_FORM_MATRIX_WRITE=1` creates one safe QA submission for each major public capture path and reports whether each was sent to inbox or stored only. `LUX_EVENT_MATRIX_WRITE=1` creates one safe QA event for each major reporting path: view, form open, link click, media action, media playback lifecycle, accepted lead, rejected lead, and report action. Add `LUX_EXPECT_EMAIL_SENT=1` after email configuration to make the form commands fail unless inbox delivery is active. Browser-flow QA serves the built `dist` locally, mocks form delivery, and verifies real CTA clicks, modal submits, submit reset behavior, media-player source mapping, playback lifecycle reporting, and media-player follow-up routing. Public-site, live-site, live-product-boundary, deploy-status, and release-readiness QA validate `/data/lux-build-manifest.json` so stale production assets are visible quickly. Live-product-boundary QA also checks production CSS, robots, private-steward noindex, and the retired internal route redirect. Release-readiness QA reports launch blockers in normal mode and fails in `LUX_RELEASE_STRICT=1` mode; when `LUX_REPORT_TOKEN` is supplied, it uses live `/api/report` provider status for inbox, handoff, and operator-token gates. Domain-readiness QA reports apex and `www` DNS/HTTPS blockers in normal mode and fails in `LUX_DOMAIN_STRICT=1` mode. Provider-readiness QA checks Firebase secret metadata, classifies secret values as active/offline/invalid without printing the values, and, when `LUX_REPORT_TOKEN` is supplied, checks live inbox, private handoff, and operator-token status from `/api/report`; use `LUX_PROVIDER_STRICT=1` when provider blockers must fail the command.

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
