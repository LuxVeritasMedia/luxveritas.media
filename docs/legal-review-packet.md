# Lux Veritas Legal Review Packet

Status date: 2026-06-30

This packet is for Privacy and Terms review before public launch. It is not legal approval. Do not mark any item approved until the responsible legal or business reviewer accepts the live draft language and actual operating practices.

## Current Technical Evidence

The public site is technically pilot-ready, but not cleared for unrestricted public launch until Privacy and Terms are approved.

- Live URL: `https://luxveritas.media`
- Current asset version: `20260630-page-view-reporting`
- Pilot write evidence file: `data/lux-pilot-write-evidence.json`
- Latest pilot QA run: `20260630170452`
- Pilot evidence updated: `2026-06-30T17:17:10Z`
- Pilot result: `passed`
- Live capture intents written: `11`
- Live event/reporting writes: `12`
- Inbox delivery required: `true`
- Operator report verified: `true`
- Remaining public-launch blockers: `privacy_review`, `terms_review`

## Review Scope

- Privacy route: `/legal/privacy.html`
- Terms route: `/legal/terms.html`
- Submission route: `/submissions.html`
- Public terms manifest: `data/lux-public-terms.json`
- Legal review manifest: `data/lux-legal-review.json`
- Static page generator: `tools/build-static.mjs`

Current public versions:

- Public terms bundle: `2026-06-09-public-capture`
- Privacy draft: `privacy-draft-2026-06-09`
- Terms draft: `terms-draft-2026-06-09`
- Submission terms draft: `submission-draft-2026-06-09`

## Privacy Checklist

Confirm that `/legal/privacy.html` accurately describes the actual practices for:

- data collected through public forms, portal access requests, submissions, events, membership interest, press, contact, and investor/partner requests
- email and SMS consent, including opt-in language and opt-out expectations
- analytics, consented engagement events, CTA reporting, media-player events, and operator reporting
- purchases, paid drops, memberships, refunds, and cancellations if commerce goes live
- event access, RSVP, guest-list, location, and attendance data if events go live
- submissions, creator participation, user content, licensing inquiries, and review records
- storage, retention, deletion, sharing, service providers, and legal compliance
- contact path for privacy requests

## Terms Checklist

Confirm that `/legal/terms.html` accurately describes the actual practices for:

- public site use, account/access limitations, and screened portal entry
- submissions, including no guarantee of review, response, release, compensation, partnership, employment, or confidentiality unless separately agreed
- user content, creator participation, community behavior, and rights-safe participation
- memberships, private drops, presales, behind-the-scenes access, and member rooms
- events, ticketing/RSVP, private rooms, attendance rules, and cancellation terms if events go live
- purchases, shipping, refunds, cancellations, and commerce support if store/membership payments go live
- licensing, investor, partner, press, and strategic-access requests
- disclaimers, limitation of liability, dispute process, governing law, and contact path

## Approval Commands

Generate the current no-secret reviewer request before approval:

```bash
node tools/export-legal-review-request.mjs
LUX_LEGAL_PACKET_OUT=/tmp/lux-legal-review-request.md node tools/export-legal-review-request.mjs
LUX_LEGAL_PACKET_FORMAT=json node tools/export-legal-review-request.mjs
node tools/qa-legal-review-request.mjs
node tools/qa-legal-sync.mjs
```

The exported request includes no-secret page proof for the live Privacy and Terms routes, including titles, descriptions, placeholder-language checks, and section inventories for reviewer triage.

Run these only after approval is real:

```bash
LUX_LEGAL_SYNC_LAUNCH=1 LUX_LEGAL_EVIDENCE="Legal review packet YYYY-MM-DD" LUX_LEGAL_REVIEW_ITEM=privacy LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY="Reviewer Name" node tools/set-legal-review-status.mjs
LUX_LEGAL_SYNC_LAUNCH=1 LUX_LEGAL_EVIDENCE="Legal review packet YYYY-MM-DD" LUX_LEGAL_REVIEW_ITEM=terms LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY="Reviewer Name" node tools/set-legal-review-status.mjs
node tools/build-static.mjs
node tools/prepare-hosting.mjs
node tools/qa-public-site.mjs
node tools/qa-release-readiness.mjs
```

## Acceptance

- `data/lux-legal-review.json` shows Privacy and Terms as `approved`.
- Each approved item includes `reviewedAt` and `reviewedBy`.
- `data/lux-launch-readiness.json` marks `privacy_review` and `terms_review` ready.
- `data/lux-launch-closeout.json` marks `privacy_review` and `terms_review` closed with no-secret evidence.
- `node tools/qa-release-readiness.mjs` no longer reports Privacy or Terms blockers.
- No legal page says placeholder, template, route-ready, or future implementation.
- Any paid membership, event ticketing, store, or creator-payment launch has matching terms before going live.
