# Lux Veritas Website TODO

Current phase: Phase 4 of 10 - capture, legal, seed, and boundary readiness.

## P0 - Protect Internal Material
- [x] Remove internal ops/backend terms from generated public pages.
- [x] Gate or noindex Portal, Investor, Creator, Licensing, admin, and private Codex routes.
- [x] Remove route-ready/future implementation language from generated public pages.
- [x] Keep financials, rights ops, campaign mechanics, private prompts, and canon-bible material out of public routes.
- [ ] Re-run public banned-term QA before every production deploy.

## P1 - Public Conversion Layer
- [x] Rewrite Home operating-system language as fan journey.
- [x] Rewrite Membership as waitlist/conversion page.
- [x] Rewrite Community as public join page + gated experience.
- [x] Rewrite Music and SPMVP as listen/watch/join pages.
- [x] Rewrite Events as request-access invitation layer.
- [x] Add static email handoff to `info@luxveritas.media` for public forms.
- [x] Add Firebase server-side form relay with validation, honeypot, rate limiting, and email fallback.
- [x] Deploy public site from a clean `dist` artifact instead of the repo root.
- [x] Split Firebase Functions deploy into a manual workflow until Cloud Run IAM is fixed.
- [ ] Fix Firebase/Cloud Run IAM so `submitForm` can be invoked by Hosting. Current blocker: deploy reaches Cloud Run, then fails on `Unable to set the invoker for the IAM policy` for `submitForm(us-central1)`.
- [ ] Configure email provider runtime secrets so server relay sends silently without visitor mail app.

## P2 - Content Model
- [x] Split Codex into Outer / Inner / Sanctum.
- [x] Split Ledger into public Ledger-lite and private internal details.
- [x] Works shows only published or intentionally teased works.
- [x] Store is live products or drop waitlist only.
- [x] Brands are noindex/gated until active.
- [ ] Create Phase 5 private portal content model before adding account features.

## P3 - Legal
- [x] Replace Privacy placeholder with legal-review-safe draft structure.
- [x] Replace Terms placeholder with legal-review-safe draft structure.
- [x] Add submission terms language to Submissions and Terms.
- [ ] Legal review: Privacy.
- [ ] Legal review: Terms.
- [ ] Add Event Terms if ticketing or public RSVP goes live.
- [ ] Add Purchase/Membership terms if commerce or paid membership goes live.

## P4 - Phase 4 Readiness
- [x] Add product boundary doc.
- [x] Add Lux ecosystem master seed.
- [x] Link master seed into KYS binder index.
- [ ] Review and upload seed/binder docs to Drive or a private internal repo; do not push them to public GitHub.
- [ ] Confirm Google Drive upload set excludes secrets, local caches, and internal-only source materials.

## P5 - Portal Prep
- [x] Keep Portal and Sign In as private-access shells.
- [ ] Define approved role model before auth build: visitor, member, artist, creator, press, partner, investor, operator, admin.
- [ ] Define access request interface before wiring any live services.
- [ ] Keep LuxOS/LuxFlow bridge deferred until Phase 7.

## P6 - QA
- [x] Check public nav/footer source.
- [x] Check noindex/gating source.
- [x] Run local build after source edits.
- [ ] Check mobile layout.
- [x] Check primary CTAs in generated source.
- [x] Check form modal open/action/button behavior locally.
- [x] Replace automatic `mailto:` jump with visible email-draft fallback to prevent submit-page freeze.
- [x] Add deploy-artifact button QA for dead public buttons.
- [x] Add public-site QA for internal links, nav/footer, noindex routes, banned terms, and media requirements.
- [x] Add private noindex local activity report for pilot testing.

## P7 - Media MVP
- [x] Add Lux Player MVP to Music and SPMVP with listen/watch/radio actions.
- [x] Record media intent events locally for reporting bridge readiness.
- [x] Add public media manifest for release, visual, and radio player entries.
- [ ] Attach approved release audio, video, and radio sources.
- [ ] Relay media events server-side after Firebase/Cloud Run IAM is fixed.
