# Player and Copy Preview QA

Date: 2026-10-30
Branch: `codex/preview-player-copy-2026-10-30`
Build: `20261030-player-copy-preview-r1`
Release decision: preview only; production publication requires owner approval.

## Changes

- Respect hidden audio/video controls so Watch does not expose an empty audio player.
- Report actual loading, playing, paused, finished, unavailable, and failed states.
- Drive the progress bar from playback time instead of simulated click percentages.
- Ignore inactive-source events and preserve download errors when the browser pauses.
- Replace implementation language in the Music/SPMVP player, radio descriptions, and fan journey with audience-facing copy.
- Preserve navigation, visual identity, media assets, form delivery code, and private-system boundaries.
- Regenerate static pages with a new cache version. Most HTML diffs only update asset references.

## Local Checks

- Build and sanitized Hosting preparation passed: 71 HTML pages, 100 deploy files.
- Public-site, buttons, access-model, mobile-layout, accessibility, media-contract, Hosting-config, and action-inventory checks passed.
- Browser suite passed using installed Chrome. Includes form validation, failure/rate-limit recovery, sign-in request handling, media reporting, and private-route boundary tests.
- Added real visibility checks at 1280x900 and 390x844 for Music and SPMVP: audio/video/radio switching, inactive-source cleanup, stale events, and horizontal overflow.
- Added corrupt-audio recovery regression coverage; alternative playback controls remain enabled.
- Visually inspected desktop and phone-size playback. These checks are not physical-device Safari certification or a complete accessibility audit.

## Inbox Delivery

The owner authorized labeled QA submissions to the existing live relay. No function or production Hosting deployment was needed.

Run: `20261030PLAYER`

- All 11 capture intents returned `sent`: request, fan, submission, press, investor, event, Codex, licensing, creator, feedback, and portal sign-in request.
- Independently located all 11 matching messages in the `info@luxveritas.media` Gmail inbox, not only provider responses.
- Read the submission message to confirm recipient, matching receipt, and submission source page. Its SPF, DKIM, and DMARC checks passed.
- QA messages remain in the inbox. No customer messages were changed.
- This proves the tested form relay's inbox delivery, not account authentication, role approval, subscriptions, or internal app integration.

## Review Boundary

- PR Hosting previews use the existing same-origin API rewrites. They are not a separate data sandbox: submitting a form can send real email.
- Production `main` remained at `6845f997d92956dfc2a6bfa0859b3850dc982a7e` during local verification.
- The historical July pilot evidence does not match this preview asset version. The QA warning is retained intentionally; this scoped test must not relabel old full-launch evidence as current.
- Before any production publication: obtain owner preview approval, then run the applicable release gate against the approved build.
- Full releases and live radio programming are still not introduced by this patch; the current media remains preview content.
