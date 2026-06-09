# Lux Veritas Website TODO

Current phase: Phase 4 of 10 - capture, legal, seed, and boundary readiness.

## P0 - Protect Internal Material
- [x] Remove internal ops/backend terms from generated public pages.
- [x] Gate or noindex Portal, Investor, Creator, Licensing, admin, and private Codex routes.
- [x] Remove route-ready/future implementation language from generated public pages.
- [x] Keep financials, rights ops, campaign mechanics, private prompts, and canon-bible material out of public routes.
- [x] Re-run public banned-term QA before every production deploy.

## P1 - Public Conversion Layer
- [x] Rewrite Home operating-system language as fan journey.
- [x] Rewrite Membership as waitlist/conversion page.
- [x] Rewrite Community as public join page + gated experience.
- [x] Rewrite Music and SPMVP as listen/watch/join pages.
- [x] Rewrite Events as request-access invitation layer.
- [x] Add static email handoff to `info@luxveritas.media` for public forms.
- [x] Add Firebase server-side form relay with validation, honeypot, rate limiting, and email fallback.
- [x] Mount inbox provider API key through Firebase Functions Secret Manager.
- [x] Add local helper for safely setting the inbox provider secret.
- [x] Add submit timeouts and validation-error handling so form submits resolve without freezing.
- [x] Parallelize server-side email and integration relay attempts so slow providers do not freeze public submits.
- [x] Add client-side receipt IDs for form submissions and local report exports.
- [x] Add path-aware form defaults so CTAs return cleaner role and inquiry data.
- [x] Deploy public site from a clean `dist` artifact instead of the repo root.
- [x] Split Firebase Functions deploy into a path-scoped workflow with manual dispatch and Cloud Run access repair.
- [x] Fix Firebase/Cloud Run public access so `submitForm` can be invoked by Hosting. Org policy blocks `allUsers`; Cloud Run Invoker IAM check is disabled on the `submitform` service instead.
- [x] Enable Cloud Firestore and create default Firestore Native database in `nam5` for form submission storage.
- [x] Confirm live valid form submissions return `stored:true` from `/api/submit`.
- [x] Confirm live QA submission is stored when inbox provider is missing: `email_provider_not_configured`.
- [ ] Configure www.luxveritas.media DNS and Hosting redirect.
- [x] Add consented site-event relay for CTA, media, portal, and content-view reporting.
- [x] Add protected activity report API for approved operator review.
- [x] Add protected operator summaries for lead paths, roles, events, pages, and clicked destinations.
- [x] Add hashed operator-token access path for private pilot reporting.
- [x] Add local helper for generating the private reporting operator-token hash.
- [x] Add stable CTA IDs and protected CTA signal summaries for real button/link reporting.
- [x] Add protected pilot funnel reporting for capture and engagement health.
- [x] Add protected form-delivery readiness reporting for stored-vs-inbox status.
- [x] Add protected inbox outcome reporting by delivery status.
- [x] Add private media-source readiness reporting for audio, video, and radio slots.
- [x] Add private launch-gates reporting for release, capture, legal, and domain blockers.
- [x] Add optional server-side integration fanout for validated form submissions.
- [x] Mount private handoff URL, signing secret, and target through Firebase Functions Secret Manager.
- [x] Add local helper for safely setting private handoff secrets.
- [x] Add protected pending-inbox replay for stored submissions after email provider setup.
- [x] Add protected pending-handoff replay for stored submissions after private workflow setup.
- [x] Add versioned replay-safe private integration payload contract.
- [x] Add direct QA coverage for the private integration payload contract.
- [x] Add protected private handoff target metadata for launch-gate reporting.
- [x] Add operator reporting token status to launch-gate reporting.
- [x] Add screened intake routing fields for Phase 6 reporting and future server-side handoff.
- [x] Add public terms version IDs to capture, reporting, and private handoff payloads.
- [ ] Configure and verify email provider runtime secret `RESEND_API_KEY` plus approved sender domain for inbox notification after Firestore capture.
- [ ] Configure approved private integration endpoint secret after CRM/Google workflow target is chosen.
- [x] Configure `REPORT_OPERATOR_TOKEN_SHA256` on `reportactivity` for private pilot reporting access.

## P2 - Content Model
- [x] Split Codex into Outer / Inner / Sanctum.
- [x] Split Ledger into public Ledger-lite and private internal details.
- [x] Works shows only published or intentionally teased works.
- [x] Store is live products or drop waitlist only.
- [x] Brands are noindex/gated until active.
- [x] Create Phase 5 private portal content model before adding account features.

## P3 - Legal
- [x] Replace Privacy placeholder with legal-review-safe draft structure.
- [x] Replace Terms placeholder with legal-review-safe draft structure.
- [x] Add submission terms language to Submissions and Terms.
- [x] Add active public terms version manifest for capture auditability.
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
- [x] Define approved role model before auth build: visitor, member, artist, creator, press, partner, investor, operator, admin.
- [x] Define access request interface before wiring any live services.
- [x] Define screened intake routing map before wiring live services.
- [x] Add QA gate for public access paths, inquiry keys, and portal-role targets.
- [ ] Keep LuxOS/LuxFlow bridge deferred until Phase 7.

## P6 - QA
- [x] Check public nav/footer source.
- [x] Check noindex/gating source.
- [x] Run local build after source edits.
- [x] Add mobile layout QA gate for viewport metadata, mobile nav, grid collapse, and phone-width CTA stacking.
- [x] Add accessibility QA gate for landmarks, labels, skip links, duplicate IDs, and alt text.
- [x] Check primary CTAs in generated source.
- [x] Check form modal open/action/button behavior locally.
- [x] Add QA coverage for bounded form-submit behavior.
- [x] Replace automatic `mailto:` jump with visible email-draft fallback to prevent submit-page freeze.
- [x] Remove `mailto:` form actions from generated public pages and add QA coverage to prevent regressions.
- [x] Add deploy-artifact button QA for dead public buttons.
- [x] Add public-site QA for internal links, nav/footer, noindex routes, banned terms, and media requirements.
- [x] Add private noindex local activity report for pilot testing.
- [x] Add private noindex operator activity report for stored submissions and consented events.
- [x] Add structured CTA, nav, link, and report-action tracking for consented engagement reporting.
- [x] Add QA coverage for stable CTA IDs and protected CTA signal reporting.
- [x] Add post-deploy live smoke QA for production routes, player shell, manifest, noindex, and `/api/submit` status.
- [x] Add repeatable form-delivery QA for validation, stored capture, and inbox notification readiness.
- [x] Add live form matrix QA for major public capture paths.
- [x] Raise pilot form rate limit so the seven-path live matrix can complete without false 429 failures.
- [x] Add live event matrix QA for CTA, media, lead, and reporting events.
- [x] Add workflow QA for hosting and Functions deploy gates.
- [x] Add integration QA for server-side submission fanout and private reporting readiness.
- [x] Add browser-flow QA for real CTA clicks, modal submits, submit reset, and media follow-up routing.
- [x] Add release-readiness QA for launch blockers, media sources, DNS, legal, email, and integration status.
- [x] Add deploy-artifact QA for private launch-gates reporting.

## P7 - Media MVP
- [x] Add Lux Player MVP to Music and SPMVP with listen/watch/radio actions.
- [x] Add versioned media manifest contract for release, visual, and radio slots.
- [x] Record media intent events locally for reporting bridge readiness.
- [x] Relay consented media and CTA events server-side to Firestore.
- [x] Add public media manifest for release, visual, and radio player entries.
- [x] Add source-ready audio/video/stream playback shell for approved media URLs.
- [x] Add media follow-up conversion path when approved audio/video/radio sources are not yet live.
- [x] Show queued vs source-ready media status in the private pilot report.
- [ ] Attach approved release audio, video, and radio sources.
