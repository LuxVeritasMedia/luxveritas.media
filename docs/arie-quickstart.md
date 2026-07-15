# Arie Quickstart

Role: Node Z website release partner

Full handoff: `docs/node-z-arie-release-handoff.md`

## Open First

1. `AGENTS.md`
2. `docs/node-z-arie-release-handoff.md`
3. `docs/PRODUCT_BOUNDARY.md`
4. `docs/site-build-sitrep.md`
5. `TODO.md`
6. `tools/build-static.mjs`
7. `styles.css`
8. `app.js`

Do not inspect old zip files, `source_docs`, raw transcripts, private seeds, or internal LuxFlow repositories unless Node X explicitly assigns that work.

## Current State

- Live: `https://luxveritas.media`
- Repo: `LuxVeritasMedia/luxveritas.media`
- Phase: 5 of 10
- Public website release readiness: 94%
- UI/UX polish: 90%
- Baseline: `main@ddd7f30`
- Asset version: `20260710-media-control-r2`
- Public launch blockers: 0
- Code/config blockers: 0

## Clean-Machine Setup

Use Node.js 22 to match CI and Firebase Functions.

```bash
gh auth login --hostname github.com --web --git-protocol https
gh auth setup-git
gh repo clone LuxVeritasMedia/luxveritas.media
cd luxveritas.media
git switch main
git pull --ff-only
npm --prefix functions ci
node tools/report-mvp-status.mjs
node tools/qa-mvp-preflight.mjs
node tools/serve-preview.mjs
```

Use the local URL printed by the preview helper.

## Start A Work Branch

```bash
git switch main
git pull --ff-only
git switch -c node-z/ui-release-pass
```

Do not push directly to `main`.

## Edit First

1. `tools/build-static.mjs` for page structure and copy
2. `styles.css` for visual and responsive behavior
3. `app.js` for public interactions
4. `data/lux-apps.json` for approved public app metadata

Generated `.html` files are output, not the first source to edit.

## Required UI/UX Routes

- Home
- Music and Lux Player
- Join
- Apps and LuxFlow
- CR8
- SignalCraft at `/luxflow/signalcrafter/`
- Portal and Sign In shells

SignalCode does not have an approved public route yet. LuxOS remains private.

## Navigation Contract

Primary nav:

`Home · Music · Film · Events · Codex · About`

Header action:

`Request Access`

Footer:

`Works · Store · Membership · Submissions · Press · Contact · Privacy · Terms`

## Run Before A PR

```bash
node tools/build-static.mjs
node tools/prepare-hosting.mjs
node tools/qa-buttons.mjs
node tools/qa-public-site.mjs
node tools/qa-mobile-layout.mjs
node tools/qa-accessibility.mjs
node tools/qa-media-contract.mjs
git diff --check
```

Capture desktop and mobile screenshots for every changed route.

## Push For Review

```bash
git add <intentional-files-only>
git commit -m "Polish public release UI"
git push -u origin node-z/ui-release-pass
gh pr create --base main --head node-z/ui-release-pass
```

Node X reviews and merges. The merge deploys through GitHub/Firebase.

## Tools

Use first:

- Codex Desktop/CLI
- GitHub plugin or official GitHub MCP
- Figma plugin or Figma remote MCP
- Chrome/in-app Browser
- Playwright
- Google Drive
- Product Design audit tools

Use Claude only as an independent reviewer or on a separate branch. Do not introduce Wix. Adobe tools are for approved asset production; Adobe's developer MCP is not needed for this website pass.

## Do Not Share

- account passwords
- API keys
- Firebase service-account keys
- operator tokens
- `.env` files

Arie should use individual account invitations and OAuth. Node X remains the default owner of production write tests, secrets, Firebase IAM, and production media publishing.
