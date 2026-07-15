# Lux Veritas Node Z Release Handoff

Audience: Arie, Node Z

Owner counterpart: Frederick, Node X

Status date: 2026-07-15

Repository: `https://github.com/LuxVeritasMedia/luxveritas.media`

Live site: `https://luxveritas.media`

Firebase project: `lux-veritas-media`

Verified baseline: `main@ddd7f30`, asset version `20260710-media-control-r2`

Repository visibility: `PUBLIC`

## Purpose

This is the current authoritative website handoff for Arie. It explains what has been built, what is live, what remains, how Node X and Node Z should divide the work, and which tools should be used to finish the public site and external portal without exposing or merging private LuxOS/LuxFlow systems.

The older `docs/arie-handoff-website-build.md` remains useful as an iteration history. This document supersedes it for current status, commands, priorities, access, and release decisions.

## Repository Visibility Warning

The GitHub repository is currently public. Treat every committed file as publicly readable even though `docs/` is excluded from the Firebase Hosting artifact. This handoff is intentionally no-secret. Put credentials, unreleased masters, private legal advice, internal seeds, private model prompts, and deeper operating material only in an access-controlled Drive folder or a private internal repository.

## North Star

LuxVeritas.media is the calm, premium public doorway into the Lux Veritas universe.

A visitor should immediately understand how to:

- listen
- watch
- join
- attend
- collect
- create

The public site sells the world, demonstrates taste, earns trust, captures aligned interest, and routes approved people toward deeper access. It must never expose private prompts, internal dashboards, financials, rights operations, campaign machinery, private audit data, unreleased canon, or internal app state.

The release standard is not merely that the pages load. Every visible interaction must be intentional, every route must have a clear audience purpose, every form must resolve, media must play correctly, the mobile experience must remain composed, and private layers must stay private.

## Node Model

### Node X: Frederick

Node X is the product owner and final release authority.

Node X owns:

- brand, audience, business, and public-copy approval
- production media approval
- legal and commercial decisions
- final merge approval
- production write tests
- Firebase, inbox, operator-token, and private-secret custody
- final launch declaration

### Node Z: Arie

Node Z is the website release partner and independent quality node.

Node Z owns:

- frontend implementation on a task branch
- visual and interaction refinement
- responsive behavior across desktop, tablet, and mobile
- accessibility and keyboard review
- public route and CTA testing
- Figma review artifacts and approved design specifications
- public LuxFlow product-page polish
- PR evidence: screenshots, commands run, and remaining risk
- independent live-site verification after Node X merges

Node Z does not need the private LuxFlow-OS repository, production secrets, Resend keys, or operator-report token to begin. GitHub, Codex, Figma, Google Drive, and the public website are enough for the first release pass.

## Product Boundary

This repository is the external public website.

It may contain:

- public brand and institutional pages
- music, film, events, Codex, about, press, and contact
- submissions and audience capture
- public app marketplace and product pages
- support, privacy, terms, and data-deletion pages
- request-access and sign-in shells
- public media playback
- noindex operator entry surfaces

It must not contain:

- LuxOS application logic
- SignalCraft or SignalCode private workflow logic
- DAMON, BlackGPT, KYS, or private SignalCraft state
- internal prompts or model routing
- private release, rights, finance, or audit records
- admin dashboards in public client markup
- secrets, private keys, webhook URLs, or service-account files

The future Phase 7 connection is a controlled server-side bridge. It is not a repository merger.

## Current Audited Progress

These are delivery estimates backed by the current repository and live QA evidence. Public website readiness is separate from completion of the full ten-phase ecosystem.

| Measure | Completion | Meaning |
| --- | ---: | --- |
| Public website release readiness | 94% | Live public MVP is healthy and ready for the final release gate |
| Public UI/UX polish | 90% | Core design system and responsive behavior are strong; final human detail pass remains |
| Media/operator release lane | 88% | Song, Video, and Radio controls, QA, rollback, and reporting work; approved production media remains |
| Current Phase 5 | 74% | Private access shell and release controls exist; real account auth is not built |
| Full ten-phase ecosystem | 59% | Later bridge, receipts, private rooms, commerce, and scale remain intentionally unfinished |

## Ten-Phase SITREP

| Phase | Scope | Completion | State |
| --- | --- | ---: | --- |
| 1 | Public site foundation | 100% | Complete |
| 2 | Firebase, GitHub, and custom domain | 100% | Complete |
| 3 | Public/internal access-control cleanup | 100% | Complete |
| 4 | Capture, legal, seed, and boundary readiness | 98% | Closeout; private archive maintenance remains |
| 5 | Private portal shell and release control | 74% | Current phase |
| 6 | Role/tier matrix and screened intake routing | 56% | Contract defined; deeper implementation follows |
| 7 | Controlled LuxOS/LuxFlow bridge | 18% | Deliberately deferred |
| 8 | KYS receipts, consent, and audit layer | 10% | Foundation only |
| 9 | Partner, investor, licensing, and creator rooms | 22% | Public capture shells only |
| 10 | Governance, membership, commerce, and scale | 16% | Waitlist and compliance foundation |

## Verified Live State

As of this handoff:

- `main` is clean and aligned with `origin/main` at `ddd7f30`.
- GitHub Hosting workflow `#321` completed successfully.
- The live build manifest matches asset version `20260710-media-control-r2`.
- `https://luxveritas.media` returns HTTP 200.
- `https://www.luxveritas.media` returns HTTP 200.
- Apex and `www` DNS point to Firebase Hosting correctly.
- Privacy and Terms owner/business approval is recorded.
- Public launch blockers: `0`.
- Code/config blockers: `0`.
- Blocking pilot bugs: `0`.
- The current pilot write evidence is run `20260714012051`.
- That run proved `11` capture-intent submissions with inbox delivery required.
- That run proved `13` live event writes.
- Protected operator reporting and post-write reconciliation passed.
- Song, Video, and Radio source checks passed.
- The site is live now, but the current posture remains `ready_for_final_release_gate`, not Phase 10 complete.

Pilot evidence has a 72-hour freshness rule. A stale receipt means the write gate must be run again; it does not mean the code regressed.

## What Is Already Working

- Static site generation from `tools/build-static.mjs`.
- Firebase Hosting deployment from GitHub Actions.
- Server-side form capture through `/api/submit`.
- Silent inbox delivery to `info@luxveritas.media` when provider state is active.
- Submission storage and receipt IDs.
- Timeout, validation, fallback, and rate-limit handling without frozen submit buttons.
- Consented CTA, media, content-view, and interaction reporting.
- Public Lux Player with Song, Video, and Radio sources.
- Media playback lifecycle and fan-reaction reporting.
- Guarded local media publishing with plan, apply, verify, backup, and rollback.
- Private portal and sign-in capture shells.
- Protected operator reporting.
- Public app marketplace and waitlist product pages.
- Public legal, support, and data-deletion routes for listed apps.
- Automated checks for buttons, internal links, public/private boundaries, metadata, mobile layout, accessibility structure, media sources, DNS, and deployment drift.

## Public App Surface

The public app marketplace currently includes:

| Product | Public route | Current posture |
| --- | --- | --- |
| CR8 | `/luxflow/cr8/` | Flagship waitlist/product surface |
| CanonCraft | `/luxflow/canoncraft/` | Waitlist/product surface |
| SignalCraft | `/luxflow/signalcrafter/` | Waitlist/product surface |
| RealCraft | `/luxflow/realcraft/` | Waitlist/product surface |
| PromptOps | `/luxflow/promptops/` | Waitlist/product surface |

Important naming decisions:

- SignalCraft is the public product name, but the current route slug is `signalcrafter`. Reconcile the final canonical slug before promotion. Preserve an HTTP redirect if the route changes.
- SignalCode has no approved record or public route in `data/lux-apps.json`. Do not invent its offer, claims, screenshots, pricing, or route. Add it only after Node X approves the public name, slug, audience, feature claims, platform plan, support path, and legal posture.
- LuxOS remains the private operating environment. It is not a public website app and should not be exposed as client-rendered internal functionality.

## Definition Of Website Release

The public website release is accepted when:

- core routes render correctly at desktop and mobile widths
- no visible element overlaps, clips, or causes horizontal scrolling
- every button, link, dialog, and form has an intentional result
- public forms resolve and return a visible receipt or fallback
- Song, Video, and Radio select and play the approved sources
- public copy sells the experience rather than internal operations
- gated routes are noindex and reveal no private material
- Privacy and Terms match actual site behavior
- keyboard navigation and visible focus are usable
- screen-reader landmarks, names, labels, and status updates are coherent
- GitHub CI passes
- Firebase serves the exact reviewed asset version
- a fresh production write gate proves inbox and event delivery
- Node X approves the release candidate and Node Z independently verifies the deployed result

## Remaining Release Work

These items do not invalidate the current live MVP, but they separate a strong pilot from the finished public release and later ecosystem:

1. Replace preview Song, Video, Radio, and poster sources with approved production media.
2. Complete Node Z's manual UI/UX pass across the route matrix below.
3. Complete a human keyboard and screen-reader pass; automated checks do not replace it.
4. Resolve the SignalCraft canonical slug before external promotion.
5. Decide whether SignalCode receives a public product page.
6. Keep store and paid membership in waitlist mode until purchase, refund, cancellation, and membership operations are approved.
7. Build real account authentication only as a separately approved Phase 5 increment.
8. Keep LuxOS, SignalCraft internals, SignalCode internals, and private app workflows out of this repo until the Phase 7 bridge contract is approved.
9. Repair future manual Firebase Functions deploy IAM before relying on Node Z for direct Functions deployment. Current live Functions are healthy.
10. Preserve fresh pilot evidence after each release-candidate deployment.

## Node Z Route Matrix

### Primary public routes

- `/index.html`
- `/music.html`
- `/film.html`
- `/events.html`
- `/codex.html`
- `/about.html`

Expected top navigation is exactly:

`Home · Music · Film · Events · Codex · About`

The global header action is `Request Access`. Submissions remains the other emphasized public conversion path.

### Conversion and utility routes

- `/join.html`
- `/membership.html`
- `/community.html`
- `/submissions.html`
- `/contact.html`
- `/press.html`
- `/store.html`
- `/works/index.html`
- `/legal/privacy.html`
- `/legal/terms.html`

Expected footer is exactly:

`Works · Store · Membership · Submissions · Press · Contact · Privacy · Terms`

### Media routes

- `/music.html#lux-player`
- `/music.html#lux-radio`
- `/spmvp.html#lux-player`

### App routes

- `/apps/`
- `/luxflow/`
- `/luxflow/cr8/`
- `/luxflow/signalcrafter/`
- each listed app's support, privacy, terms, download, and delete-data route

### Gated and noindex routes

- `/portal/`
- `/auth/signin.html`
- `/portal/reporting.html`
- `/investor.html`
- `/codex-inner.html`
- `/codex-sanctum.html`

These are shells or protected surfaces. They must not be redesigned into public disclosures.

## UI/UX Direction

The visual identity is quiet luxury: calm authority, selective disclosure, high contrast, and deliberate pace.

Preserve:

- obsidian, bone, emerald, deep indigo, and restrained gold
- typography-led hierarchy
- generous spacing without oversized marketing composition
- sharp, composed editorial imagery
- subtle reveal motion
- stable grids and controls
- restrained corners, generally 8px or less
- a clear primary action per section

Avoid:

- generic SaaS dashboard styling on public pages
- decorative card stacks or cards inside cards
- gradient orbs, bokeh, or one-color visual monotony
- autoplay media
- large copy blocks that explain how the interface works
- hype language, fake urgency, or unsupported product claims
- redesigning every page independently

Node Z's first design deliverable should be a Figma review board with captured desktop and mobile frames for Home, Music, Join, Apps, SignalCraft, and Portal. Annotate only real defects or approved improvements. Code remains the source of truth until Node X approves a Figma change.

## Source Of Truth

Read in this order:

1. `AGENTS.md`
2. `docs/node-z-arie-release-handoff.md`
3. `docs/PRODUCT_BOUNDARY.md`
4. `docs/site-build-sitrep.md`
5. `TODO.md`
6. `docs/media-publishing-runbook.md`
7. `tools/build-static.mjs`
8. `styles.css`
9. `app.js`

Do not inspect old zip files, `source_docs`, raw transcripts, private seeds, or previous strategy packets unless Node X explicitly assigns a task that requires them.

The generator is the page source of truth. Do not begin by hand-editing generated HTML.

## Clean-Machine Setup

Use an individual GitHub account that has been invited to the repository. Do not use Node X's password or session.

Recommended runtime is Node.js 22 to match GitHub Actions and Firebase Functions.

```bash
gh auth login --hostname github.com --web --git-protocol https
gh auth setup-git
gh repo clone LuxVeritasMedia/luxveritas.media
cd luxveritas.media
git switch main
git pull --ff-only
node --version
npm --prefix functions ci
node tools/report-mvp-status.mjs
node tools/qa-mvp-preflight.mjs
node tools/serve-preview.mjs
```

The preview helper prints the local URL and selects another safe port if `4173` is occupied.

## Branch And Pull Request Protocol

Never have Node X and Node Z push directly to `main` at the same time.

For every work package:

```bash
git switch main
git pull --ff-only
git switch -c node-z/ui-release-pass
```

Before committing:

```bash
node tools/build-static.mjs
node tools/prepare-hosting.mjs
node tools/qa-buttons.mjs
node tools/qa-public-site.mjs
node tools/qa-mobile-layout.mjs
node tools/qa-accessibility.mjs
node tools/qa-media-contract.mjs
git status --short
git diff --check
```

Then:

```bash
git add <intentional-files-only>
git commit -m "Polish public release UI"
git push -u origin node-z/ui-release-pass
gh pr create --base main --head node-z/ui-release-pass
```

Every PR should state:

- routes changed
- user-visible behavior changed
- screenshots at desktop and mobile widths
- commands run and results
- public/private boundary impact
- remaining risks or manual checks

Node X reviews and merges. The merge to `main` triggers the Firebase Hosting workflow. Node Z then verifies the live pages independently.

## Production Test Ownership

Node Z may run all local and non-writing live checks.

Node X should remain the default owner of checks that:

- send real inbox messages
- write production events
- use the protected operator token
- change Firebase secrets or IAM
- deploy Functions manually
- publish production media

This prevents duplicate QA submissions and accidental credential spread. If Node Z becomes an approved operator later, create an individual access path rather than sharing Node X's raw token.

## Media Publishing

Inspect current sources:

```bash
node tools/lux-media-control.mjs status
```

Plan before changing anything:

```bash
node tools/lux-media-control.mjs plan --slot song --file "/path/to/approved-song.wav"
node tools/lux-media-control.mjs plan --slot video --file "/path/to/approved-video.webm" --poster "/path/to/approved-poster.jpg"
node tools/lux-media-control.mjs plan --slot radio --file "/path/to/approved-radio.wav"
```

Only Node X or an approved media operator should use `apply --confirm`. Every apply creates a rollback package under `.lux-media-control/backups/`.

## Recommended Tool And MCP Stack

Installed capability does not imply that Arie's account is authenticated. He must connect each service on his computer with his own account and least-privilege access.

The current Codex environment has useful installed capabilities for GitHub, Figma, Google Drive, Chrome/in-app browser control, Gmail, Product Design, image generation, Supabase, HubSpot, Notion, and Slack. Arie's machine and workspace may expose a different set until he installs or connects them.

| Tool | Current recommendation | Use in this project |
| --- | --- | --- |
| Codex Desktop/CLI | Primary | Read the repo, implement scoped changes, run tests, inspect diffs |
| GitHub plugin or official GitHub MCP | Required | Repository context, PRs, reviews, Actions, issues; prefer OAuth and least privilege |
| Figma plugin or Figma remote MCP | Required for design pass | Capture live pages, compare frames, annotate defects, inspect design context, connect approved components |
| Chrome control and in-app Browser | Required for QA | Test the real live experience using logged-in or public browser state |
| Playwright | Required automation | Repeatable desktop/mobile interaction and regression testing |
| Google Drive plugin | Recommended | Shared approved assets, reports, screenshots, and private handoff packets |
| Product Design audit tools | Recommended | Flow audit, conversion review, accessibility-aware UI critique |
| Image generation | Optional | Original approved campaign or product imagery; never replace real app screenshots |
| Gmail plugin | Optional and screened | Confirm approved QA delivery without exposing unrelated inbox data |
| Claude Code | Optional second reviewer | Independent review or implementation on a separate branch; never edit the same branch concurrently with Codex |
| Supabase plugin | Deferred | Use only after a migration or approved Phase 7/production data task |
| HubSpot plugin | Deferred | Not the currently approved external workflow; do not wire it casually |
| Adobe Express Developer MCP | Specialized, not needed now | Useful for building Adobe Express add-ons, not for general LuxVeritas.media frontend work |
| Adobe Analytics MCP | Future option | Consider only if Lux Veritas adopts Adobe Analytics and approves the data model |
| Wix | Do not introduce | The canonical site is source-controlled and deployed through GitHub/Firebase; Wix would create a second source of truth unless a full migration is approved |

Preferred Figma posture:

- use Figma's remote MCP when available
- share frame-specific URLs, not vague file links
- capture the live page into a review file
- separate defects, approved refinements, and future concepts
- do not treat generated Figma frames as permission to rewrite the design system

Preferred GitHub MCP posture:

- start read-only if Arie is evaluating the repo
- enable only repository, pull-request, and Actions capabilities needed for the task
- use OAuth when the host supports it
- never place a personal access token in the repository, chat, screenshots, or shared Drive

Official references:

- [Plugins in Codex](https://help.openai.com/en/articles/20001256-plugins-in-codex/)
- [Figma MCP server guide](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server)
- [GitHub official MCP server](https://github.com/github/github-mcp-server)
- [Adobe Express Developer MCP](https://developer.adobe.com/express/add-ons/docs/guides/getting-started/local-development/mcp-server)
- [Adobe Analytics MCP](https://developer.adobe.com/analytics-mcp/docs/)

## Account And Access Checklist

Grant access to Arie's individual identity:

- [ ] GitHub organization/repository collaborator access
- [ ] Figma team/project access
- [ ] approved Google Drive folder access
- [ ] Codex workspace seat or individual authorized account
- [ ] Claude seat only if it will be used
- [ ] Firebase Viewer access only if live console inspection is needed
- [ ] stronger Firebase role only when direct deployment becomes part of Node Z's job

Do not share:

- Google account passwords
- GitHub passwords
- Codex or Claude account passwords
- Resend API keys
- Firebase service-account keys
- operator-report tokens
- private workflow signing secrets
- `.env` files

Use organization invitations, OAuth, IAM, and individual seats. Production deployment can remain entirely GitHub-driven, so Node Z does not need broad Firebase access for ordinary website work.

## First Node Z Work Order

### Pass 1: Baseline certification

1. Clone and run the clean-machine commands.
2. Confirm `main@ddd7f30` or newer and record the tested commit.
3. Capture desktop and mobile evidence for Home, Music, Join, Apps, SignalCraft, and Portal.
4. Verify there is no horizontal overflow at 1440px, 1024px, 768px, 390px, and 320px.
5. Test every primary CTA and dialog without production writes.

### Pass 2: UI/UX release refinement

1. Create the Figma review board.
2. Rank findings as release blocker, quality improvement, or future idea.
3. Implement one coherent visual batch in the generator, `styles.css`, and `app.js`.
4. Preserve the six-item primary nav and public/private boundary.
5. Submit screenshots and QA evidence in a PR.

### Pass 3: Product surfaces

1. Review CR8 and SignalCraft public product pages for clarity and consistency.
2. Resolve the `signalcrafter` canonical slug decision with Node X.
3. Keep all apps in waitlist mode until real builds and store URLs exist.
4. Do not add SignalCode until its public product contract is approved.

### Pass 4: Release candidate

1. Node X merges the approved UI/UX PR.
2. GitHub Actions deploys Firebase Hosting.
3. Node Z runs independent live visual and interaction verification.
4. Node X runs the fresh production write gate once.
5. Both nodes sign off against the release definition.

## Final Gate Commands

Non-writing release audit:

```bash
node tools/qa-operator-environment.mjs
node tools/report-mvp-status.mjs
node tools/qa-mvp-preflight.mjs
node tools/qa-deploy-status.mjs
node tools/qa-domain-readiness.mjs
node tools/qa-live-site.mjs
node tools/qa-live-media-sources.mjs
node tools/qa-pilot-write-evidence.mjs
```

Production write gate, Node X by default:

```bash
LUX_FINAL_WRITE_TESTS=1 node tools/qa-final-release-gate.mjs
```

Do not use skip-browser or skip-live flags for final approval.

## Codex Prompt For Arie

```text
You are Node Z for the LuxVeritas.media release.

Read only AGENTS.md, docs/node-z-arie-release-handoff.md, docs/PRODUCT_BOUNDARY.md, docs/site-build-sitrep.md, TODO.md, and the implementation files required by the assigned route. Do not inspect source_docs, old zip files, raw transcripts, private seeds, or internal LuxFlow repositories.

Work on a task branch. Do not push directly to main. The public website must sell the Lux Veritas world without exposing internal systems.

For UI work, edit tools/build-static.mjs, styles.css, and app.js as the source of truth. Rebuild generated pages once after the implementation batch. Preserve the six-item primary nav, footer contract, noindex boundaries, form behavior, media controls, and quiet-luxury identity.

Run one complete QA pass at the end. Return: routes changed, files changed, screenshots captured, commands run, test results, public/private boundary impact, and remaining risks. Do not deploy, write production events, send live QA email, change Firebase IAM, or use secrets without Node X approval.
```

## Immediate Decision

The best immediate use of Node Z is a release-quality UI/UX and interaction pass on the existing static build, followed by an independent live verification. Do not begin a framework migration, LuxOS merge, Wix rebuild, or SignalCode product launch during this pass.
