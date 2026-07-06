# CR8 Store Submission Packet

Status: prepared, pending final app assets  
Updated: 2026-07-06  
Source of truth: `data/cr8-store-submission.json`

## Boundary

CR8 is ready to present as a public LuxFlow product and waitlist page. It is not ready for final App Store or Google Play submission until the real app build exists, screenshots are captured from that build, store rating questionnaires are completed, and the candidate visual assets are explicitly approved.

Do not submit the public product-page preview cards as store screenshots. They are product-direction previews, not captured app screens.

## Public URLs

- Product: `https://luxveritas.media/luxflow/cr8/`
- Support: `https://luxveritas.media/luxflow/cr8/support.html`
- Privacy: `https://luxveritas.media/luxflow/cr8/privacy.html`
- Terms: `https://luxveritas.media/luxflow/cr8/terms.html`
- Data deletion: `https://luxveritas.media/luxflow/cr8/delete-data.html`
- Download/waitlist: `https://luxveritas.media/luxflow/cr8/download.html`

## Listing Metadata

Apple App Store candidate:

- App name: `CR8`
- Subtitle: `Creative packets for artists`
- Promotional text: `Create from the source. Shape ideas, prompts, assets, and release thoughts into clean packets for review and collaboration.`
- Category candidate: `Productivity`
- Secondary category candidate: `Graphics & Design`
- Keywords candidate: `creator,ideas,prompts,briefs,artists,media,packets`

Google Play candidate:

- App name: `CR8`
- Short description: `Shape ideas, prompts, and creative assets into reviewable packets.`
- Category candidate: `Productivity`
- Support email: `info@luxveritas.media`

## Candidate Assets

- Apple icon source candidate: `assets/apps/cr8/cr8-icon-1024.png`
- Google Play icon candidate: `assets/apps/cr8/cr8-google-play-icon-512.png`
- Google Play feature graphic candidate: `assets/apps/cr8/cr8-google-play-feature-1024x500.png`

These are candidate assets only. They are not approved final art until the owner approves them.

Regenerate candidate PNGs from editable SVG sources with `node tools/generate-cr8-store-assets.mjs`.

## Screenshot Capture Plan

Apple requires one to ten screenshots for a supported device set. Prioritize the current large iPhone set first, then iPad only if the shipped app supports iPad.

Google Play requires real screenshots for publication and strongly recommends at least four high-resolution screenshots for app recommendations eligibility. The screenshots should show actual CR8 app use, not marketing-only art.

Capture order once the app build exists:

1. Capture onboarding or first project screen.
2. Capture idea intake.
3. Capture packet shaping.
4. Capture review/export path.
5. Capture settings/support only if needed for review.

## Age Rating Notes

Apple rating: complete the App Store Connect questionnaire after final feature scope is locked.

Google rating: complete the Google Play IARC questionnaire after final feature scope is locked.

Candidate expectation is a broad-audience creative utility, but any account, community, submission, media, commerce, or creator-participation feature can change the questionnaire answers. Use the shipped behavior, not the product ambition, when answering.

## Remaining Blockers

- Real CR8 app build.
- Owner approval for icon and feature graphic.
- Captured app screenshots.
- Apple App Store Connect app record, bundle ID, rating questionnaire, privacy answers, and build upload.
- Google Play Console app record, package name, content rating, data safety, feature graphic, icon, and screenshot uploads.
- Final legal review for app-specific privacy, terms, data deletion, and purchase/subscription language if paid features go live.

## Official References

- Apple screenshot specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- Apple app icon guidance: https://developer.apple.com/help/app-store-connect/manage-app-information/add-an-app-icon/
- Google Play preview assets: https://support.google.com/googleplay/android-developer/answer/9866151
