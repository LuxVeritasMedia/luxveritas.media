# Deployment Notes

## Current Static Prototype

Preview locally:

```bash
node tools/build-static.mjs
python3 -m http.server 4173
```

Firebase Hosting can serve the current static site with `firebase.json`.

```bash
firebase login
firebase use <project-id>
firebase deploy --only hosting
```

The deploy ignore list excludes source briefs, extraction text, QA screenshots, and generation tooling.

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
