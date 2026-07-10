# CR8 App Release Readiness Audit

Status: release-readiness handoff  
Updated: 2026-07-10  
Source of truth: `data/cr8-app-release-readiness.json`

## Executive Sitrep

LuxVeritas.media is ready to sell and capture interest for CR8. The public product page, waitlist/download surface, support route, privacy route, terms route, delete-data route, candidate store assets, and store metadata packet are live.

CR8 itself is not yet App Store or Google Play ready from the evidence in this website repo. The app has its own build conversation, so the next move is an app-side release-readiness audit against this packet.

Current split:

- LuxVeritas.media website ecosystem: Phase 5 of 10.
- CR8 website sales layer: substantially ready.
- CR8 app release: Phase 2 of 8 from this repo's evidence.
- KYS remains on its own clock: Phase 1, receipt-first.

## North Star

CR8 should become the cleanest first LuxFlow product door: a calm, premium creator app that turns raw ideas into reviewable creative packets, while LuxVeritas.media sells the promise, captures aligned users, protects trust, and routes only ready people into deeper access.

The public website must stay the best front door: beautiful, disciplined, conversion-aware, legally careful, fast, mobile-clean, and honest about what is live versus what opens by access.

## Current Percentages

These percentages are readiness estimates, not vanity scores.

| Area | Percent | Confidence | Read |
| --- | ---: | --- | --- |
| LuxVeritas.media website | 68% | high | Strong public foundation, live deploy, app marketplace layer, capture routes, and CR8 sales surface are in place. Remaining work is deeper portal, conversion polish, store-link wiring, and ongoing pilot evidence after each release. |
| CR8 website sales layer | 78% | high | Product page, support/legal/download routes, candidate assets, and store metadata packet are live. Needs approved final art and real app links. |
| CR8 app release | 24% | medium-low | Website evidence is prepared, but actual app build, signing, device QA, screenshots, beta, store setup, and submission are outside this repo and must be audited in the app build conversation. |
| LuxFlow app commercialization | 42% | medium | The marketplace pattern exists. Commercial readiness needs actual app builds, store records, legal/data safety, support operations, and launch analytics. |

## Website Phase Map

1. Public Site Foundation: complete.
2. Firebase, GitHub, Domain: complete.
3. Public Access-Control Cleanup: complete.
4. Capture, Legal, Seed, Boundary Readiness: closed for the current public layer.
5. Portal Pilot Prep and App Marketplace Layer: current.
6. Role/Tier Matrix and Screened Intake Routing: partially defined.
7. LuxOS/LuxFlow Internal Bridge: deferred until bridge contract is approved.
8. KYS Receipts, Consent, and Audit Layer: deferred.
9. Partner, Investor, Licensing, Creator Rooms: gated shells only.
10. Full Launch Governance, Membership, Commerce, and Scale: future.

## CR8 App Phase Map

1. Public Sales and Capture Layer: complete.
2. Scope Lock and Release Contract: current.
3. Working App MVP: required.
4. Platform Build, Signing, and Accounts: required.
5. Store Assets, Legal, Rating, and Data Safety: partially prepared.
6. QA, Security, Accessibility, and Beta: required.
7. Store Submission and Review: required.
8. Launch Loop and Website Conversion Wiring: required.

## P0 Next Steps

1. Run the release-readiness audit inside the CR8 app build conversation.
2. Lock the CR8 MVP: supported platforms, account posture, save/export behavior, data model, and paid/free launch posture.
3. Produce runnable app evidence: local run, simulator/device run, and verified create/shape/review/export path.
4. Capture real app screenshots only after the app runs.
5. Keep candidate website assets marked as candidate until owner approval is recorded.

## App-Side Acceptance Gates

CR8 is not complete until these are true:

- App runs locally.
- App runs on the intended iOS target.
- App runs on the intended Android target.
- Core CR8 workflow works: capture idea, shape packet, review packet, export/share packet.
- Error states, empty states, and recovery states work.
- No secrets are committed.
- Privacy/data behavior matches the store answers.
- Screenshots are captured from the actual app.
- TestFlight or Google internal testing evidence exists if mobile launch is intended.
- Store records are created and reviewed.

## Website-Side Acceptance Gates

LuxVeritas.media remains responsible for:

- Selling CR8 clearly.
- Capturing aligned users.
- Keeping support, privacy, terms, delete-data, and download routes live.
- Replacing waitlist placeholders with App Store and Google Play links after approval.
- Never presenting website preview cards as real app screenshots.
- Keeping the public promise aligned with actual app behavior.

## Exact Prompt For The CR8 App Build Conversation

```text
Use the Lux Veritas website packet as source context. Read docs/cr8-store-submission.md, data/cr8-store-submission.json, and data/cr8-app-release-readiness.json.

Audit the CR8 app build for App Store and Google Play readiness.

Do not mark real screenshots, approved assets, signing, TestFlight, Google internal testing, privacy answers, or store submission complete unless evidence exists in the app repo or store consoles.

Return:
- files checked
- current app phase
- blockers
- first fix batch
- QA commands
```

## Hard Rule

The website can sell, capture, support, and route CR8. The app build must prove the actual product. Do not confuse a beautiful product page with a submitted app.
