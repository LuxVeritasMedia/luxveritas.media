# Lux Veritas Open Approval Decision Forms

Generated: 2026-07-14T01:26:56.533Z

Purpose: No-secret approval decision forms for private reviewer records. Fill completed decisions outside the public repo.

Project: LuxVeritas.media
Live URL: https://luxveritas.media
Decision: ready_for_final_release_gate
Open or conditional approvals: 5
Public launch blockers: 0

Pilot evidence: passed run=20260714012051 forms=11 events=13

## Rules

- Do not paste secrets, private URLs, provider account IDs, legal advice, private report exports, contract terms, or non-public operational details into these forms.
- Completed decision records belong in the approved private owner system, not in this public website repo.
- Use approved, needs_changes, or blocked only.
- If a blocker condition is true, record the decision as needs_changes or blocked and resolve it before activation.

## Privacy Review (`privacy_review`)

- Category: legal
- Status: approved
- Blocks public launch: no
- Owner: Legal/business reviewer
- Source: data/lux-legal-review.json

Purpose: Record the Privacy review decision outside the public repo before marking the launch gate approved.

Required decision values: approved, needs_changes, blocked

### Decision Record Template

Fill this record outside the public repo.

| Field | Value |
| --- | --- |
| approvalId | `privacy_review` |
| reviewerName |  |
| reviewedAt |  |
| decision |  |
| evidenceReference |  |
| conditionsOrChanges |  |
| route |  |
| legalVersion |  |
| publicTermsVersion |  |
| privacyVersion |  |
| reviewScope |  |

### Version Lock

- route: /legal/privacy.html
- legalVersion: privacy-draft-2026-07-03
- publicTermsVersion: 2026-07-03-public-capture
- privacyVersion: privacy-draft-2026-07-03
- assetVersion: 20260710-media-control-r2
- pilotQaRunId: 20260714012051

### Do Not Approve If

- The approval record would include secrets, API keys, private URLs, provider account IDs, private report exports, legal advice, contract terms, or non-public operational details.
- The decision owner cannot confirm the reviewed live route, target, role, or upload package matches the version lock.
- The live Privacy page differs from the reviewed route and version.
- The reviewer cannot confirm actual practices for data collection, email or SMS consent, analytics, submissions, memberships, events, purchases, creator participation, storage, retention, deletion, service providers, and contact paths.

### No-Secret Evidence Examples

- Approval email dated YYYY-MM-DD without quoted secrets or private URLs.
- Internal approval record ID without a private link.
- Signed reviewer note dated YYYY-MM-DD with only public route, version, and decision metadata.
- Legal review packet approval for privacy-draft-2026-07-03 dated YYYY-MM-DD.
- Business approval note naming /legal/privacy.html and privacy version only.

### Next Action

Monitor the approved Privacy page and reopen review if public data practices change.

### Verification

`LUX_LEGAL_SYNC_LAUNCH=1 ... LUX_LEGAL_REVIEW_ITEM=privacy ... node tools/set-legal-review-status.mjs && node tools/qa-release-readiness.mjs`

## Terms Review (`terms_review`)

- Category: legal
- Status: approved
- Blocks public launch: no
- Owner: Legal/business reviewer
- Source: data/lux-legal-review.json

Purpose: Record the Terms review decision outside the public repo before marking the launch gate approved.

Required decision values: approved, needs_changes, blocked

### Decision Record Template

Fill this record outside the public repo.

| Field | Value |
| --- | --- |
| approvalId | `terms_review` |
| reviewerName |  |
| reviewedAt |  |
| decision |  |
| evidenceReference |  |
| conditionsOrChanges |  |
| route |  |
| legalVersion |  |
| publicTermsVersion |  |
| termsVersion |  |
| submissionTermsVersion |  |
| reviewScope |  |

### Version Lock

- route: /legal/terms.html
- legalVersion: terms-draft-2026-06-09
- publicTermsVersion: 2026-07-03-public-capture
- termsVersion: terms-draft-2026-06-09
- submissionTermsVersion: submission-draft-2026-06-09
- assetVersion: 20260710-media-control-r2
- pilotQaRunId: 20260714012051

### Do Not Approve If

- The approval record would include secrets, API keys, private URLs, provider account IDs, private report exports, legal advice, contract terms, or non-public operational details.
- The decision owner cannot confirm the reviewed live route, target, role, or upload package matches the version lock.
- The live Terms page differs from the reviewed route and version.
- The reviewer cannot confirm actual practices for submissions, user content, memberships, creator participation, events, licensing, purchases, refunds, cancellations, community access, and contact paths.

### No-Secret Evidence Examples

- Approval email dated YYYY-MM-DD without quoted secrets or private URLs.
- Internal approval record ID without a private link.
- Signed reviewer note dated YYYY-MM-DD with only public route, version, and decision metadata.
- Legal review packet approval for terms-draft-2026-06-09 dated YYYY-MM-DD.
- Business approval note naming /legal/terms.html and terms version only.

### Next Action

Monitor the approved Terms page and reopen review if public site practices change.

### Verification

`LUX_LEGAL_SYNC_LAUNCH=1 ... LUX_LEGAL_REVIEW_ITEM=terms ... node tools/set-legal-review-status.mjs && node tools/qa-release-readiness.mjs`

## Functions Deploy IAM (`functions_deploy_iam`)

- Category: automation
- Status: approval_required
- Blocks public launch: no
- Owner: Google Cloud project owner
- Source: docs/functions-deploy-iam-repair.md

Purpose: Record the Google Cloud project-owner approval outside the public repo before changing IAM for manual Functions deploy automation.

Required decision values: approved, needs_changes, blocked

### Decision Record Template

Fill this record outside the public repo.

| Field | Value |
| --- | --- |
| approvalId | `functions_deploy_iam` |
| reviewerName |  |
| reviewedAt |  |
| decision |  |
| evidenceReference |  |
| conditionsOrChanges |  |
| projectOwner |  |
| deployServiceAccount |  |
| runtimeServiceAccount |  |
| iamRole |  |
| manualWorkflowEvidence |  |

### Version Lock

- firebaseProject: lux-veritas-media
- deployServiceAccount: github-actions-firebase@lux-veritas-media.iam.gserviceaccount.com
- runtimeServiceAccount: lux-veritas-media@appspot.gserviceaccount.com
- iamRole: roles/iam.serviceAccountUser
- verificationCommand: node tools/qa-functions-deploy-readiness.mjs

### Do Not Approve If

- The approval record would include secrets, API keys, private URLs, provider account IDs, private report exports, legal advice, contract terms, or non-public operational details.
- The decision owner cannot confirm the reviewed live route, target, role, or upload package matches the version lock.
- The project owner has not explicitly approved the IAM mutation.
- The approval would create or download a service account key.
- The approval would grant broader roles than Service Account User on the runtime service account.

### No-Secret Evidence Examples

- Approval email dated YYYY-MM-DD without quoted secrets or private URLs.
- Internal approval record ID without a private link.
- Signed reviewer note dated YYYY-MM-DD with only public route, version, and decision metadata.
- Google Cloud IAM change ticket ID without private console URL.
- Project-owner approval note naming the deploy and runtime service accounts only.

### Next Action

Approve and grant roles/iam.serviceAccountUser on lux-veritas-media@appspot.gserviceaccount.com to github-actions-firebase@lux-veritas-media.iam.gserviceaccount.com, then rerun the manual Functions workflow.

### Verification

`node tools/qa-functions-deploy-readiness.mjs`

## External Workflow Target (`external_workflow_target`)

- Category: private_workflow
- Status: recommendation_ready_approval_required
- Blocks public launch: no
- Owner: Private workflow owner
- Source: docs/private-workflow-selection.json

Purpose: Private workflow owner records this outside the public repo before any external workflow target is activated.

Required decision values: approved, needs_changes, blocked

### Decision Record Template

Fill this record outside the public repo.

| Field | Value |
| --- | --- |
| approvalId | `external_workflow_target` |
| reviewerName |  |
| reviewedAt |  |
| decision |  |
| evidenceReference |  |
| conditionsOrChanges |  |
| target |  |
| workflowOwner |  |
| receiverOwner |  |
| receiverLocationEvidence |  |
| signingMaterialEvidence |  |
| replayOwner |  |
| rollbackOwner |  |
| retentionExpectation |  |
| legalVersionEvidenceOwner |  |

### Version Lock

- selectionSchemaVersion: luxveritas.private_workflow_selection.v1
- recommendedTarget: google_workspace
- currentPrimaryTarget: firebase_handoff
- firstExternalApprovalStatus: identified_pending_explicit_private_workflow_owner_approval
- pilotQaRunId: 20260714012051
- assetVersion: 20260710-media-control-r2

### Do Not Approve If

- The approval record would include secrets, API keys, private URLs, provider account IDs, private report exports, legal advice, contract terms, or non-public operational details.
- The decision owner cannot confirm the reviewed live route, target, role, or upload package matches the version lock.
- Receiver location, signing material, or target identity would be stored in the public repo.
- The target is not one of the approved private integration profile IDs.
- Firebase handoff rollback owner and rollback evidence are missing.
- Retention, deletion, legal-version evidence, or replay ownership is unresolved.
- The approval would activate ghl_crm or codex_ops under the google_workspace approval scope.
- Public routes would expose provider account data, provider field IDs, URLs, tokens, prompts, internal dashboards, financials, rights operations, or unreleased canon.

### No-Secret Evidence Examples

- Approval email dated YYYY-MM-DD without quoted secrets or private URLs.
- Internal approval record ID without a private link.
- Signed reviewer note dated YYYY-MM-DD with only public route, version, and decision metadata.
- Private workflow approval note dated YYYY-MM-DD
- Internal owner ticket ID without private URL
- Receiver readiness checklist ID without endpoint, token, account ID, or field ID
- Retention approval note dated YYYY-MM-DD

### Next Action

Approve google_workspace as the first external private workflow target, including receiver owner, receiver location, signing material, replay owner, rollback owner, retention expectations, and legal-version evidence owner; keep firebase_handoff as rollback until live write, replay, and operator-report checks pass.

### Verification

`node tools/qa-private-workflow-selection.mjs && LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1 LUX_PRIVATE_INTEGRATION_ACTIVATION_DRY_RUN=1 ... node tools/activate-private-integration.mjs`

## Seed/Binder Private Upload (`seed_binder_private_upload`)

- Category: internal_docs
- Status: operator_review_required
- Blocks public launch: no
- Owner: Internal operations owner
- Source: docs/private-upload-manifest.json

Purpose: Record private upload approval outside the public repo before sharing the curated collaborator package.

Required decision values: approved, needs_changes, blocked

### Decision Record Template

Fill this record outside the public repo.

| Field | Value |
| --- | --- |
| approvalId | `seed_binder_private_upload` |
| reviewerName |  |
| reviewedAt |  |
| decision |  |
| evidenceReference |  |
| conditionsOrChanges |  |
| operationsOwner |  |
| folderName |  |
| shareTarget |  |
| uploadPackageEvidence |  |
| exclusionEvidence |  |

### Version Lock

- manifest: docs/private-upload-manifest.json
- recommendedFolderName: Lux Veritas Website Build
- shareTarget: private_drive_or_private_repo
- approvalStatus: identified_pending_internal_operations_owner_approval

### Do Not Approve If

- The approval record would include secrets, API keys, private URLs, provider account IDs, private report exports, legal advice, contract terms, or non-public operational details.
- The decision owner cannot confirm the reviewed live route, target, role, or upload package matches the version lock.
- The upload set includes source zip archives, local caches, secrets, private keys, internal-only seed materials, or internal app folders.
- The destination is a public repo, public Drive folder, or unaudited share target.
- The uploader cannot confirm the package matches docs/upload-checklist.md and docs/private-upload-manifest.json.

### No-Secret Evidence Examples

- Approval email dated YYYY-MM-DD without quoted secrets or private URLs.
- Internal approval record ID without a private link.
- Signed reviewer note dated YYYY-MM-DD with only public route, version, and decision metadata.
- Private Drive folder creation note with folder name only.
- Upload checklist signoff dated YYYY-MM-DD without private links.

### Next Action

Approve uploading the curated Lux Veritas Website Build package to the private Lux Veritas Website Build folder for Arie/collaborator access; exclude source zips, local caches, secrets, internal ecosystem seed/binder materials, and internal app folders.

### Verification

`node tools/qa-private-upload-manifest.mjs && node tools/qa-product-boundary.mjs`

## Event Terms (`event_terms`)

- Category: conditional_legal
- Status: conditional
- Blocks public launch: no
- Owner: Legal/business reviewer
- Source: TODO.md

Purpose: Record the event-terms trigger decision outside the public repo before ticketing, paid events, or public RSVP goes live.

Required decision values: approved, needs_changes, blocked

### Decision Record Template

Fill this record outside the public repo.

| Field | Value |
| --- | --- |
| approvalId | `event_terms` |
| reviewerName |  |
| reviewedAt |  |
| decision |  |
| evidenceReference |  |
| conditionsOrChanges |  |
| trigger |  |
| eventFlowOwner |  |
| legalOwner |  |
| goLiveScope |  |

### Version Lock

- currentPublicEventMode: request_access_only
- source: TODO.md

### Do Not Approve If

- The approval record would include secrets, API keys, private URLs, provider account IDs, private report exports, legal advice, contract terms, or non-public operational details.
- The decision owner cannot confirm the reviewed live route, target, role, or upload package matches the version lock.
- Ticketing, paid events, public RSVP, exact private locations, pricing, guest lists, or private performance details would go live without reviewed event terms.

### No-Secret Evidence Examples

- Approval email dated YYYY-MM-DD without quoted secrets or private URLs.
- Internal approval record ID without a private link.
- Signed reviewer note dated YYYY-MM-DD with only public route, version, and decision metadata.
- Event terms not-triggered note dated YYYY-MM-DD.
- Legal trigger ticket ID without private event details.

### Next Action

Add Event Terms before ticketing, paid events, or public RSVP goes live.

### Verification

`Review event flow and rerun legal/release QA.`

## Purchase/Membership Terms (`purchase_membership_terms`)

- Category: conditional_legal
- Status: conditional
- Blocks public launch: no
- Owner: Legal/business reviewer
- Source: TODO.md

Purpose: Record the commerce and paid-membership terms trigger decision outside the public repo before payments, shipping, refunds, or paid access go live.

Required decision values: approved, needs_changes, blocked

### Decision Record Template

Fill this record outside the public repo.

| Field | Value |
| --- | --- |
| approvalId | `purchase_membership_terms` |
| reviewerName |  |
| reviewedAt |  |
| decision |  |
| evidenceReference |  |
| conditionsOrChanges |  |
| trigger |  |
| commerceOwner |  |
| legalOwner |  |
| goLiveScope |  |

### Version Lock

- currentPublicCommerceMode: waitlist_only
- source: TODO.md

### Do Not Approve If

- The approval record would include secrets, API keys, private URLs, provider account IDs, private report exports, legal advice, contract terms, or non-public operational details.
- The decision owner cannot confirm the reviewed live route, target, role, or upload package matches the version lock.
- Paid membership, paid drops, store checkout, shipping, refunds, cancellations, or creator payment flows would go live without reviewed purchase or membership terms.

### No-Secret Evidence Examples

- Approval email dated YYYY-MM-DD without quoted secrets or private URLs.
- Internal approval record ID without a private link.
- Signed reviewer note dated YYYY-MM-DD with only public route, version, and decision metadata.
- Commerce terms not-triggered note dated YYYY-MM-DD.
- Legal trigger ticket ID without private payment provider details.

### Next Action

Add Purchase/Membership terms before commerce, paid membership, paid drops, shipping, refunds, or cancellations go live.

### Verification

`Review commerce flow and rerun legal/release QA.`
