# BladeSmith website completion brief
Date: 2026-09-28
Status: implementation handoff; no account access or deployment implied.

## Authority and baseline
Fred / HarborMaster is the product owner and release authority (existing Node X).
Arie / BladeSmith is the design and frontend lead (existing Node Z).
This brief records Fred's September 28 direction. The requested midnight-plum, cream, chrome and electric-coral visual direction supersedes conflicting older visual guidance for this redesign. Preserve the public/private product boundary.

Inspected baseline: main at 6845f997d92956dfc2a6bfa0859b3850dc982a7e.
The current implementation is a static generator: tools/build-static.mjs, styles.css and app.js. The earlier React/Three.js concept is a separate design reference, not proof of deployed functionality. Recover and compare its source before porting it. Do not edit generated HTML as the primary source.

## Design ownership
BladeSmith can design the complete public experience: layouts, typography, graphic system, artist pages, case studies, motion, responsive states and accessibility. HarborMaster supplies canonical copy, approved media and destination decisions, and reviews release candidates. Work can begin on branches without production credentials.

Use one task branch per coherent deliverable. Use node-z/<scope> for Arie's work; never attribute an agent-created branch to Arie. Keep screenshots, exact Figma frame links, decisions, QA and preview URLs together in the draft PR. One person owns each shared file during a work session.

## Visual contract
- Midnight plum field, oversized cream typography, polished chrome, one electric coral accent.
- A sculptural ribbon with purposeful thickness/curvature, soft shadows and legible reflective highlights.
- Headline remains real readable text. Ribbon crosses negative space without concealing critical letters or navigation.
- Slow opening, energetic separation along a controlled curved path, calm reassembly into an approved abstract mark. If no mark is approved, label the endpoint as a study.
- Desktop full motion, lighter mobile presentation, static reduced-motion and WebGL-unavailable states.
- No scroll hijacking; controls remain usable during animation.
- Every hover response has a keyboard-focus and touch equivalent.
- Three spacious project compositions with challenge/process/outcome overlays, focus trap, Escape dismissal and focus restoration. Unreleased or invented work stays explicitly labeled Concept.

The conversation's proposed headline is “Ideas with gravity.” The current live hero is “Escape to Truth.” Present the proposed hero in preview and retain current brand copy in the content inventory rather than silently deleting it.

Requested primary navigation: Home, Film, Music (Arie Dixon; SXPRTYMVP), About, Contact. Preserve existing Events and Codex routes in secondary/footer navigation. Update navigation QA expectations with the implementation; do not leave tests asserting the obsolete header. Existing intake forms and meaningful conversion paths must continue to work. Existing /contact.html supplies a working contact destination.

## Immediate design workspace
Use the existing GitHub project and preview workflow as the code/review hub; Figma as the visual design source; the existing shared asset workspace as the media source. This is the immediate collaboration workspace, not a claim that the website contains a working CMS.

The repository already defines Firebase Hosting Preview and Firebase Hosting Preview Deploy workflows. Verify a successful run before promising a preview URL. Preview forms must use mock/test delivery before any submission testing: sharing a production backend with a preview does not create a sandbox.

Arie needs his own GitHub collaborator identity, own Codex session, Figma edit access, and access to approved assets. Repository access does not automatically grant a Codex environment, Figma or Drive access. Do not share founder tokens.

## Work packages and acceptance
| Order | Deliverable | Done when |
|---|---|---|
| 1 | Baseline + design inventory | Current routes, source files, assets, claims and incomplete states are mapped; legacy concept source compared |
| 2 | Tokens + Home preview | Plum/cream/chrome/coral system, navigation, readable hero and mobile/static fallback approved in preview |
| 3 | Ribbon module | Three.js/GSAP module lazy-loaded; reverse scroll, cleanup, reduced motion and WebGL failure verified |
| 4 | Film + artist experiences | Arie and SXPRTYMVP pages, three case studies, approved media and real contact routing work |
| 5 | Content editing prototype | Private workspace data contract and draft/preview/review flow proven with test content |
| 6 | Release candidate | Desktop/mobile, keyboard, screen reader, media, form routing, performance and rollback evidence recorded |

Prefer an isolated React/Three.js module in the existing public build first. A whole-site Next.js migration is a separate implementation decision with route/SEO/form parity, hosting and rollback evidence; do not combine it with the first visual review.

## Graphic and motion handoff
Every approved asset needs a stable asset ID, version, source/master reference, permitted uses, reviewer, export dimensions, crop/focal point, poster, alt text or captions as applicable, and a checksum. Keep masters and private prompts out of this public repository. Publish optimized approved exports only.

Produce a connected family: hero ribbon, case-study key art, artist portraits/covers, radio ident, TV ident, social stills and motion cutdowns. Share palette, typography and motion rhythm while allowing each artist/project its own composition.

## Private portal contract
The existing /portal/ and /auth/signin.html are access-request shells. noindex and hidden routes do not authenticate users.
A future private design workspace belongs in the internal application, separate from this public repo. Its first useful screens are:
1. Current preview and review queue.
2. Page content and drafts.
3. Approved asset library.
4. Design tokens and component references.
5. Motion specs and exports.
6. Release checklist and immutable release references.

Separate permissions for draft editing, asset approval, code changes, production publishing, and access administration. Enforce them server-side. Public fan membership cannot grant studio editing rights. Do not expose a general-purpose shell or production secrets through a web editor.

## Validation and release
For documentation-only work: diff hygiene and collaboration-document checks.
For implementation: build once, run existing public-site/button/mobile/accessibility/media/browser checks, then visually inspect desktop and mobile and exercise the full ribbon in a WebGL-capable browser. Static fallback success does not validate the 3D animation.
HarborMaster reviews production release; BladeSmith independently checks the deployed result. Keep a known-good release reference and revert procedure.

## Start prompt for BladeSmith
Read AGENTS.md, this brief, docs/collaboration/README.md and docs/PRODUCT_BOUNDARY.md. Treat Fred's September 28 visual direction recorded here as the redesign brief. Work on a node-z task branch. Start with tokens and a Home preview, preserving existing routes, form contracts and media controls. Show desktop/mobile/static-fallback evidence. Keep internal workspace, prompts and credentials out of the public site. Open a draft PR early. Report Done / Next / Blocked / Decision needed with commit and preview references.
