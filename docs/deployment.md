# Deployment Notes

## Current Static Prototype

Preview locally:

```bash
node tools/build-static.mjs
python3 -m http.server 4173
```

Firebase Hosting serves the static site and rewrites `/api/submit` to the Firebase Function `submitForm`.

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
- logs submissions to Firestore when available
- sends email through Resend when runtime config is present
- falls back to the visitor mail app if the server relay is unavailable or not fully configured

Cloud Firestore is enabled for `lux-veritas-media`, with the default Firestore Native database in `nam5`.

This Google Workspace organization blocks public `allUsers` IAM bindings, so the public form relay uses Cloud Run's Invoker IAM check disabled setting on the generated `submitform` service. The manual functions workflow reapplies that setting after function deploys:

```bash
gcloud run services update submitform --region us-central1 --project lux-veritas-media --no-invoker-iam-check
```

Do not re-add `invoker: "public"` to the v2 function unless the org policy changes; Firebase deploy will try to write an `allUsers` IAM binding and fail.

Configure these runtime environment values in Firebase/Google Cloud before treating silent email as complete:

```text
RESEND_API_KEY
FORM_TO_EMAIL=info@luxveritas.media
FORM_FROM_EMAIL=Lux Veritas <forms@luxveritas.media>
```

The `FORM_FROM_EMAIL` domain must be verified with the email provider. Do not commit these values to the repo.

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
- Add SPF/DKIM for sending domain.
- Create GoHighLevel forms, workflows, tags, and pipelines.
- Apply Supabase migrations.
- Review legal/privacy/terms copy.
- Run full mobile, accessibility, form-delivery, and analytics QA.
