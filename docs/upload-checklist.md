# Upload Checklist For Arie

## Purpose

Use this checklist when uploading the Lux Veritas website project to Google Drive for Arie.

This file explains:

- what to upload
- what not to upload
- what Arie should open first
- what is internal-only

## Recommended Drive Folder Name

```text
Lux Veritas Website Build
```

## Recommended Folder Structure

Upload these files and folders into the shared Drive folder:

```text
Lux Veritas Website Build/
  AGENTS.md
  TODO.md
  app.js
  styles.css
  firebase.json
  apphosting.yaml
  .env.example
  robots.txt
  sitemap.xml
  site.webmanifest
  data/
  functions/
  index.html
  music.html
  film.html
  events.html
  codex.html
  about.html
  join.html
  contact.html
  press.html
  submissions.html
  ledger.html
  store.html
  membership.html
  investor.html
  community.html
  insights.html
  spmvp.html
  auth/
  portal/
  works/
  brands/
  legal/
  events/
  assets/
  docs/
    arie-handoff-website-build.md
    arie-quickstart.md
    upload-checklist.md
    private-upload-manifest.json
    strategy-round2.md
    deployment.md
    supabase-blueprint.md
    private-integration-profiles.json
    private-integration-field-map.json
    private-workflow-matrix.json
  tools/
    build-static.mjs
    serve-preview.mjs
    qa-private-upload-manifest.mjs
    qa-preview-helper.mjs
```

## Minimum Required Files

If you want the lightest possible handoff, at minimum upload:

- [AGENTS.md](/Users/frederickparent/Documents/Codex/LuxVeritas-website/AGENTS.md)
- [TODO.md](/Users/frederickparent/Documents/Codex/LuxVeritas-website/TODO.md)
- [tools/build-static.mjs](/Users/frederickparent/Documents/Codex/LuxVeritas-website/tools/build-static.mjs)
- [tools/qa-preview-helper.mjs](/Users/frederickparent/Documents/Codex/LuxVeritas-website/tools/qa-preview-helper.mjs)
- [styles.css](/Users/frederickparent/Documents/Codex/LuxVeritas-website/styles.css)
- [app.js](/Users/frederickparent/Documents/Codex/LuxVeritas-website/app.js)
- [docs/arie-handoff-website-build.md](/Users/frederickparent/Documents/Codex/LuxVeritas-website/docs/arie-handoff-website-build.md)
- [docs/arie-quickstart.md](/Users/frederickparent/Documents/Codex/LuxVeritas-website/docs/arie-quickstart.md)
- [docs/strategy-round2.md](/Users/frederickparent/Documents/Codex/LuxVeritas-website/docs/strategy-round2.md)
- [docs/private-upload-manifest.json](/Users/frederickparent/Documents/Codex/LuxVeritas-website/docs/private-upload-manifest.json)
- [docs/private-workflow-matrix.json](/Users/frederickparent/Documents/Codex/LuxVeritas-website/docs/private-workflow-matrix.json)
- [data](/Users/frederickparent/Documents/Codex/LuxVeritas-website/data)
- [functions](/Users/frederickparent/Documents/Codex/LuxVeritas-website/functions)
- [assets](/Users/frederickparent/Documents/Codex/LuxVeritas-website/assets)

If Arie is expected to view the current static output immediately, also upload:

- all generated `.html` files
- route subfolders such as `events/`, `portal/`, `works/`, `brands/`, `legal/`, `auth/`

## Files And Folders To Exclude

Do **not** upload the original raw source and planning materials unless you explicitly want Arie to review them separately.

Exclude:

- `source_docs/`
- `source_docs_round2/`
- `brief_extracts/`
- `brief_extracts_round2/`
- `*.zip`
- any original zip archives
- any downloaded raw planning packs
- any machine-local caches
- `.git/`
- `.DS_Store`
- `node_modules/` if it exists
- `docs/lux-ecosystem-master-seed.md`
- `docs/kys-binder-index.md`
- any `docs/kys-*.md` internal ecosystem files
- internal LuxFlow OS app folders

Also exclude anything that contains secrets or live credentials, including:

- real `.env` files
- real .env files
- webhook URLs
- API keys
- Firebase private credentials
- Supabase service-role keys
- Stripe secrets
- Printify tokens

## Internal vs Shareable

### Safe To Share With Arie

These are part of the intended internal collaborator handoff:

- current site files
- generator logic
- handoff docs
- quickstart doc
- TODO checklist
- deployment and schema notes
- strategy-round2 summary

### Handle Carefully

Only share these if you want Arie to have broader internal planning context:

- deeper raw planning transcripts
- original strategy source docs
- unreduced operating-system documents
- unreleased internal business planning files

If he only needs to continue the web build, the curated handoff docs should be enough.

## What Arie Should Open First

Ask Arie to open these files in this order:

1. [docs/arie-quickstart.md](/Users/frederickparent/Documents/Codex/LuxVeritas-website/docs/arie-quickstart.md)
2. [docs/arie-handoff-website-build.md](/Users/frederickparent/Documents/Codex/LuxVeritas-website/docs/arie-handoff-website-build.md)
3. [AGENTS.md](/Users/frederickparent/Documents/Codex/LuxVeritas-website/AGENTS.md)
4. [tools/build-static.mjs](/Users/frederickparent/Documents/Codex/LuxVeritas-website/tools/build-static.mjs)
5. [tools/serve-preview.mjs](/Users/frederickparent/Documents/Codex/LuxVeritas-website/tools/serve-preview.mjs)
6. [docs/private-upload-manifest.json](/Users/frederickparent/Documents/Codex/LuxVeritas-website/docs/private-upload-manifest.json)
7. [TODO.md](/Users/frederickparent/Documents/Codex/LuxVeritas-website/TODO.md)

## What Arie Should Run First

From the project root:

```bash
node tools/build-static.mjs
node tools/serve-preview.mjs
```

Then open:

```text
Use the Local URL printed by `node tools/serve-preview.mjs`.
```

## Upload Steps

1. Create the Drive folder:

```text
Lux Veritas Website Build
```

2. Upload the selected files and folders.
3. Confirm that `docs/arie-quickstart.md` and `docs/arie-handoff-website-build.md` are present.
4. Confirm that `tools/build-static.mjs` is present.
5. Confirm that `tools/serve-preview.mjs` and `tools/qa-private-upload-manifest.mjs` are present.
6. Confirm that `data/`, `functions/`, and `assets/` uploaded successfully.
7. Share the folder with Arie.

## Final Check Before Sharing

Before uploading, verify:

- no live secrets are present
- no raw source zip files are included unless intentionally shared
- no internal-only credential files are included
- the handoff docs are present
- `docs/private-upload-manifest.json` is present
- the generator file is present
- `data/` and `functions/` are present
- the current HTML output is present if you want Arie to preview immediately

Run this before sharing:

```bash
node tools/qa-private-upload-manifest.mjs
```
