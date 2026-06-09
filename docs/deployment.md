# Deployment Notes

## Current Static Prototype

Preview locally:

```bash
node tools/build-static.mjs
python3 -m http.server 4173
```

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

The private reporting page also loads `data/lux-launch-readiness.json` and the public media manifest to render Launch Gates. This gives operators a browser-visible view of remaining public-launch blockers: media sources, inbox notifications, private handoff, legal review, and domain redirect status.

The public media manifest uses `luxveritas.media_manifest.v1`. Each media item carries source status, source-required, source type, reporting key, queued CTA, and fallback form path so listen/watch/radio intent can be reported even before approved media URLs are attached.

The public terms manifest uses `luxveritas.public_terms.v1`. Form submissions carry the active public terms, privacy, terms, and submission terms version IDs into Firestore and the private integration payload. These version IDs support capture auditability only; they do not replace final legal review.

The notification replay action:

- requires the same approved operator bearer token as the private report
- posts to `/api/report` with `action: "replay_pending"`
- retries stored submissions whose inbox notification did not send
- is intended for post-provider setup recovery after `RESEND_API_KEY` and the approved sender domain are live
- does not expose provider secrets or delivery internals to public pages

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

```bash
LUX_FORM_INTEGRATION_URL="https://..." \
LUX_FORM_INTEGRATION_SIGNING_SECRET="approved-shared-secret" \
LUX_FORM_INTEGRATION_TARGET="private_workflow" \
node tools/setup-private-integration-secret.mjs
firebase deploy --only functions:submitForm,functions:reportActivity --project lux-veritas-media --non-interactive --force
```

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
node tools/qa-form-delivery.mjs
node tools/qa-integrations.mjs
node tools/qa-integration-contract.mjs
node tools/qa-media-contract.mjs
node tools/qa-live-form-matrix.mjs
node tools/qa-live-event-matrix.mjs
node tools/qa-release-readiness.mjs
/Users/frederickparent/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tools/qa-browser-flows.mjs
LUX_FORM_WRITE=1 node tools/qa-form-delivery.mjs
LUX_FORM_MATRIX_WRITE=1 node tools/qa-live-form-matrix.mjs
LUX_EVENT_MATRIX_WRITE=1 node tools/qa-live-event-matrix.mjs
LUX_FORM_WRITE=1 LUX_EXPECT_EMAIL_SENT=1 node tools/qa-form-delivery.mjs
LUX_RELEASE_STRICT=1 node tools/qa-release-readiness.mjs
```

The default form-delivery, live form matrix, and live event matrix commands check validation without creating records. `LUX_FORM_WRITE=1` creates one safe QA submission. `LUX_FORM_MATRIX_WRITE=1` creates one safe QA submission for each major public capture path and reports whether each was sent to inbox or stored only. `LUX_EVENT_MATRIX_WRITE=1` creates one safe QA event for each major reporting path: view, form open, link click, media action, accepted lead, rejected lead, and report action. Add `LUX_EXPECT_EMAIL_SENT=1` after email configuration to make the form commands fail unless inbox delivery is active. Browser-flow QA serves the built `dist` locally, mocks form delivery, and verifies real CTA clicks, modal submits, submit reset behavior, and media-player follow-up routing. Release-readiness QA reports launch blockers in normal mode and fails in `LUX_RELEASE_STRICT=1` mode.

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
- Configure `www.luxveritas.media` in Firebase Hosting and DNS. Current root apex uses Firebase Hosting IP `199.36.158.100`; `www` should either be added as a second Firebase Hosting custom domain or pointed/redirected to the apex through the DNS provider. Verify with `dig +short www.luxveritas.media` and `curl -I https://www.luxveritas.media`.
- Add SPF/DKIM for sending domain.
- Create GoHighLevel forms, workflows, tags, and pipelines.
- Apply Supabase migrations.
- Review legal/privacy/terms copy.
- Run full mobile, accessibility, form-delivery, and analytics QA.
