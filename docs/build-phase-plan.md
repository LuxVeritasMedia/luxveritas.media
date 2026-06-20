# Lux Veritas Build Phase Plan

Status: Phase 5 pilot prep guide

Date: June 2, 2026

## Current Phase

LuxVeritas.media is in Phase 5 of 10: portal pilot prep. Phase 4 capture, domain, inbox, media, and boundary work is ready, but Privacy and Terms legal approval remain open before full public release.

KYS remains on its own clock: KYS Phase 1, which proves receipts before tokens, public identity claims, governance claims, biometrics, or public-chain records.

## Ten-Phase Website/Ecosystem Map

1. Public site foundation - complete.
2. Firebase, GitHub, and domain deployment - complete.
3. Public access-control cleanup - complete.
4. Capture, legal, seed, and boundary readiness - ready except legal approval and private seed upload.
5. Authenticated portal shell - current as a screened access shell, not full auth.
6. Role/tier matrix and screened intake routing - contracts defined for intake and handoff.
7. LuxOS/LuxFlow internal bridge - deferred controlled bridge, not public merge.
8. KYS receipts, consent, and audit layer connected.
9. Partner, investor, licensing, and creator rooms.
10. Full launch governance, membership, commerce, and scale.

## Phase 4 Lock

Phase 4 is complete only when:

- Public pages sell the Lux Veritas world, not the operating model.
- Public capture routes have clear calls to action and review-safe consent language.
- Legal pages are no longer placeholders and are marked for attorney review.
- Internal source, finance, rights ops, campaign mechanics, private prompts, canon-bible material, and dashboards are not exposed publicly.
- The new seed/binder documents are reviewed and stored in Drive or a private internal repository, not pushed to the public GitHub website repo.

## Phase 5 Portal Rule

The Phase 5 portal is a shell only:

- sign in
- request access
- explain screened entry
- route approved people later

It must not contain LuxOS app modules, DAMON/BlackGPT workflow state, private audit logs, private prompts, internal dashboards, finance, rights ops, release ops, or admin workflow state.

## Phase 6 Role Model

Use this role model before building auth or live routing:

| Role | Public Meaning | Access Posture |
| --- | --- | --- |
| visitor | Public site visitor | public pages only |
| member | Approved fan/community participant | gated membership layer |
| artist | Artist or performer | screened creator access |
| creator | Writer, visual artist, filmmaker, designer, or contributor | screened creator access |
| press | Journalist, media, or institutional contact | screened press materials |
| partner | Venue, brand, studio, distributor, or collaborator | screened partner materials |
| investor | Investor or strategic finance contact | screened investor materials |
| operator | Approved Lux Veritas/LuxFlow operator | internal only |
| admin | System administrator | internal only, server-verified |

## Access Request Interface

Do not wire live services until this minimum interface is approved:

| Field | Purpose |
| --- | --- |
| name | human contact name |
| email | primary response path |
| phone | optional response path |
| role_path | member, artist, creator, press, partner, investor, operator, or other |
| inquiry_type | submissions, membership, events, press, partnership, licensing, investor, portal, or general |
| message | visitor-provided context |
| consent_email | permission for email follow-up |
| consent_sms | permission for SMS follow-up when phone is supplied |
| source_page | page where request started |
| timestamp | request time |

## Phase 7 Bridge Rule

Phase 7 is a controlled bridge, not a merge.

LuxVeritas.media may request access for private systems, but it must not import internal LuxFlow code, expose internal APIs, publish private prompts, or ship operational dashboards in public client markup.

The bridge should be implemented from the internal LuxFlow-OS side first, then exposed to LuxVeritas.media only through approved server-side contracts.

## KYS Rule

Any future identity, consent, likeness, submission, creator participation, membership, or private portal action should produce a receipt or reviewable record before it is scaled.

The public site may introduce the promise of consent-first participation. The proof belongs in KYS and the private authenticated layer.
