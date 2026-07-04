import { readFile } from "node:fs/promises";

const jsonMode = process.env.LUX_OPEN_APPROVALS_JSON === "1";
const issues = [];
const identifiedDeployServiceAccount = "github-actions-firebase@lux-veritas-media.iam.gserviceaccount.com";
const targetServiceAccount = "lux-veritas-media@appspot.gserviceaccount.com";

function todoOpen(todo, marker) {
  return todo.split("\n").some((line) => line.includes("- [ ]") && line.includes(marker));
}

function legalItem(legalReview, id) {
  const item = Array.isArray(legalReview.items)
    ? legalReview.items.find((entry) => entry.id === id)
    : null;
  return {
    id,
    route: item?.route || "",
    status: item?.status || "missing",
    version: item?.version || "",
    reviewedAt: item?.reviewedAt || "",
    reviewedBy: item?.reviewedBy || "",
    notes: item?.notes || ""
  };
}

function gateById(launch, id) {
  return (Array.isArray(launch.gates) ? launch.gates : []).find((gate) => gate.id === id) || null;
}

function closeoutById(closeout, id) {
  return (Array.isArray(closeout.items) ? closeout.items : []).find((item) => item.id === id) || null;
}

function uniqueList(values) {
  return [...new Set(values.filter(Boolean))];
}

function decisionIntake({
  approvalId,
  purpose,
  requiredFields = [],
  versionLock = {},
  blockApprovalIf = [],
  noSecretEvidenceExamples = []
}) {
  return {
    approvalId,
    purpose,
    requiredDecisionValues: ["approved", "needs_changes", "blocked"],
    requiredFields: uniqueList([
      "approvalId",
      "reviewerName",
      "reviewedAt",
      "decision",
      "evidenceReference",
      "conditionsOrChanges",
      ...requiredFields
    ]),
    versionLock,
    blockApprovalIf: uniqueList([
      "The approval record would include secrets, API keys, private URLs, provider account IDs, private report exports, legal advice, contract terms, or non-public operational details.",
      "The decision owner cannot confirm the reviewed live route, target, role, or upload package matches the version lock.",
      ...blockApprovalIf
    ]),
    noSecretEvidenceExamples: uniqueList([
      "Approval email dated YYYY-MM-DD without quoted secrets or private URLs.",
      "Internal approval record ID without a private link.",
      "Signed reviewer note dated YYYY-MM-DD with only public route, version, and decision metadata.",
      ...noSecretEvidenceExamples
    ])
  };
}

function approval({ id, label, category, status, blocksPublicLaunch, owner, source, nextAction, verification, notes = [], decisionIntake: intake = null }) {
  return {
    id,
    label,
    category,
    status,
    blocksPublicLaunch,
    owner,
    source,
    nextAction,
    verification,
    notes,
    decisionIntake: intake
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function secretShape(value) {
  let checked = value;
  for (const allowed of [
    identifiedDeployServiceAccount,
    `serviceAccount:${identifiedDeployServiceAccount}`,
    targetServiceAccount,
    `serviceAccount:${targetServiceAccount}`
  ]) {
    checked = checked.replace(new RegExp(escapeRegex(allowed), "g"), "KNOWN_NON_SECRET_IAM_PRINCIPAL");
  }
  return /\bre_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{16,}|serviceAccount:[^<\s]+@[^<\s]+\.iam\.gserviceaccount\.com/i.test(checked);
}

const [
  launchRaw,
  closeoutRaw,
  legalRaw,
  publicTermsRaw,
  phaseRaw,
  workflowSelectionRaw,
  privateUploadManifestRaw,
  pilotEvidenceRaw,
  todo,
  functionsRepairDoc,
  legalPacketDoc
] = await Promise.all([
  readFile("data/lux-launch-readiness.json", "utf8"),
  readFile("data/lux-launch-closeout.json", "utf8"),
  readFile("data/lux-legal-review.json", "utf8"),
  readFile("data/lux-public-terms.json", "utf8"),
  readFile("data/lux-phase-status.json", "utf8"),
  readFile("docs/private-workflow-selection.json", "utf8"),
  readFile("docs/private-upload-manifest.json", "utf8"),
  readFile("data/lux-pilot-write-evidence.json", "utf8"),
  readFile("TODO.md", "utf8"),
  readFile("docs/functions-deploy-iam-repair.md", "utf8"),
  readFile("docs/legal-review-packet.md", "utf8")
]);

const inputText = [
  launchRaw,
  closeoutRaw,
  legalRaw,
  publicTermsRaw,
  phaseRaw,
  workflowSelectionRaw,
  privateUploadManifestRaw,
  pilotEvidenceRaw,
  todo,
  functionsRepairDoc,
  legalPacketDoc
].join("\n");

if (secretShape(inputText)) {
  console.error("Open approvals input appears to contain secret-shaped data.");
  process.exit(1);
}

const launch = JSON.parse(launchRaw);
const closeout = JSON.parse(closeoutRaw);
const legalReview = JSON.parse(legalRaw);
const publicTerms = JSON.parse(publicTermsRaw);
const phaseStatus = JSON.parse(phaseRaw);
const workflowSelection = JSON.parse(workflowSelectionRaw);
const privateUploadManifest = JSON.parse(privateUploadManifestRaw);
const pilotEvidence = JSON.parse(pilotEvidenceRaw);

const privacyGate = gateById(launch, "privacy_review");
const termsGate = gateById(launch, "terms_review");
const privacyCloseout = closeoutById(closeout, "privacy_review");
const termsCloseout = closeoutById(closeout, "terms_review");
const privacy = legalItem(legalReview, "privacy");
const terms = legalItem(legalReview, "terms");

const approvals = [];

approvals.push(approval({
  id: "privacy_review",
  label: "Privacy Review",
  category: "legal",
  status: privacy.status === "approved" ? "approved" : "open",
  blocksPublicLaunch: privacy.status !== "approved",
  owner: privacyGate?.owner || privacyCloseout?.owner || "Legal/business reviewer",
  source: "data/lux-legal-review.json",
  nextAction: privacyGate?.nextAction || "Complete legal review of the Privacy page before full public launch.",
  verification: "LUX_LEGAL_SYNC_LAUNCH=1 ... LUX_LEGAL_REVIEW_ITEM=privacy ... node tools/set-legal-review-status.mjs && node tools/qa-release-readiness.mjs",
  notes: [
    privacy.route,
    privacy.version,
    privacyCloseout?.status ? `closeout=${privacyCloseout.status}` : ""
  ].filter(Boolean),
  decisionIntake: decisionIntake({
    approvalId: "privacy_review",
    purpose: "Record the Privacy review decision outside the public repo before marking the launch gate approved.",
    requiredFields: ["route", "legalVersion", "publicTermsVersion", "privacyVersion", "reviewScope"],
    versionLock: {
      route: privacy.route,
      legalVersion: privacy.version,
      publicTermsVersion: publicTerms.version || "",
      privacyVersion: publicTerms.privacyVersion || "",
      assetVersion: pilotEvidence.assetVersion || "",
      pilotQaRunId: pilotEvidence.qaRunId || ""
    },
    blockApprovalIf: [
      "The live Privacy page differs from the reviewed route and version.",
      "The reviewer cannot confirm actual practices for data collection, email or SMS consent, analytics, submissions, memberships, events, purchases, creator participation, storage, retention, deletion, service providers, and contact paths."
    ],
    noSecretEvidenceExamples: [
      "Legal review packet approval for privacy-draft-2026-07-03 dated YYYY-MM-DD.",
      "Business approval note naming /legal/privacy.html and privacy version only."
    ]
  })
}));

approvals.push(approval({
  id: "terms_review",
  label: "Terms Review",
  category: "legal",
  status: terms.status === "approved" ? "approved" : "open",
  blocksPublicLaunch: terms.status !== "approved",
  owner: termsGate?.owner || termsCloseout?.owner || "Legal/business reviewer",
  source: "data/lux-legal-review.json",
  nextAction: termsGate?.nextAction || "Complete legal review of the Terms page before full public launch.",
  verification: "LUX_LEGAL_SYNC_LAUNCH=1 ... LUX_LEGAL_REVIEW_ITEM=terms ... node tools/set-legal-review-status.mjs && node tools/qa-release-readiness.mjs",
  notes: [
    terms.route,
    terms.version,
    termsCloseout?.status ? `closeout=${termsCloseout.status}` : ""
  ].filter(Boolean),
  decisionIntake: decisionIntake({
    approvalId: "terms_review",
    purpose: "Record the Terms review decision outside the public repo before marking the launch gate approved.",
    requiredFields: ["route", "legalVersion", "publicTermsVersion", "termsVersion", "submissionTermsVersion", "reviewScope"],
    versionLock: {
      route: terms.route,
      legalVersion: terms.version,
      publicTermsVersion: publicTerms.version || "",
      termsVersion: publicTerms.termsVersion || "",
      submissionTermsVersion: publicTerms.submissionTermsVersion || "",
      assetVersion: pilotEvidence.assetVersion || "",
      pilotQaRunId: pilotEvidence.qaRunId || ""
    },
    blockApprovalIf: [
      "The live Terms page differs from the reviewed route and version.",
      "The reviewer cannot confirm actual practices for submissions, user content, memberships, creator participation, events, licensing, purchases, refunds, cancellations, community access, and contact paths."
    ],
    noSecretEvidenceExamples: [
      "Legal review packet approval for terms-draft-2026-06-09 dated YYYY-MM-DD.",
      "Business approval note naming /legal/terms.html and terms version only."
    ]
  })
}));

if (todoOpen(todo, "iam.serviceAccounts.ActAs")) {
  approvals.push(approval({
    id: "functions_deploy_iam",
    label: "Functions Deploy IAM",
    category: "automation",
    status: "approval_required",
    blocksPublicLaunch: false,
    owner: "Google Cloud project owner",
    source: "docs/functions-deploy-iam-repair.md",
    nextAction: "Approve and grant roles/iam.serviceAccountUser on lux-veritas-media@appspot.gserviceaccount.com to github-actions-firebase@lux-veritas-media.iam.gserviceaccount.com, then rerun the manual Functions workflow.",
    verification: "node tools/qa-functions-deploy-readiness.mjs",
    notes: [
      "Live Functions are deployed; this hardens future manual Functions deploy automation.",
      "Do not mutate IAM without explicit project-owner approval."
    ],
    decisionIntake: decisionIntake({
      approvalId: "functions_deploy_iam",
      purpose: "Record the Google Cloud project-owner approval outside the public repo before changing IAM for manual Functions deploy automation.",
      requiredFields: ["projectOwner", "deployServiceAccount", "runtimeServiceAccount", "iamRole", "manualWorkflowEvidence"],
      versionLock: {
        firebaseProject: "lux-veritas-media",
        deployServiceAccount: identifiedDeployServiceAccount,
        runtimeServiceAccount: targetServiceAccount,
        iamRole: "roles/iam.serviceAccountUser",
        verificationCommand: "node tools/qa-functions-deploy-readiness.mjs"
      },
      blockApprovalIf: [
        "The project owner has not explicitly approved the IAM mutation.",
        "The approval would create or download a service account key.",
        "The approval would grant broader roles than Service Account User on the runtime service account."
      ],
      noSecretEvidenceExamples: [
        "Google Cloud IAM change ticket ID without private console URL.",
        "Project-owner approval note naming the deploy and runtime service accounts only."
      ]
    })
  }));
}

if (todoOpen(todo, "google_workspace")) {
  approvals.push(approval({
    id: "external_workflow_target",
    label: "External Workflow Target",
    category: "private_workflow",
    status: workflowSelection.selectionStatus || "approval_required",
    blocksPublicLaunch: false,
    owner: "Private workflow owner",
    source: "docs/private-workflow-selection.json",
    nextAction: "Approve google_workspace as the first external private workflow target, including receiver owner, receiver location, signing material, replay owner, rollback owner, retention expectations, and legal-version evidence owner; keep firebase_handoff as rollback until live write, replay, and operator-report checks pass.",
    verification: "node tools/qa-private-workflow-selection.mjs && LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1 LUX_PRIVATE_INTEGRATION_ACTIVATION_DRY_RUN=1 ... node tools/activate-private-integration.mjs",
    notes: [
      `current=${workflowSelection.currentPrimaryTarget || "unknown"}`,
      `recommended=${workflowSelection.recommendedFirstExternalTarget || "unknown"}`,
      workflowSelection.recommendedFirstExternalApproval?.status || "",
      workflowSelection.selectionRule || ""
    ].filter(Boolean),
    decisionIntake: decisionIntake({
      approvalId: "external_workflow_target",
      purpose: workflowSelection.approvalDecisionIntake?.purpose || "Record the private workflow target decision outside the public repo before activation.",
      requiredFields: workflowSelection.approvalDecisionIntake?.requiredFields || [
        "workflowOwner",
        "receiverOwner",
        "receiverLocationEvidence",
        "signingMaterialEvidence",
        "replayOwner",
        "rollbackOwner",
        "retentionExpectation",
        "legalVersionEvidenceOwner"
      ],
      versionLock: {
        selectionSchemaVersion: workflowSelection.schemaVersion || "",
        recommendedTarget: workflowSelection.recommendedFirstExternalTarget || "",
        currentPrimaryTarget: workflowSelection.currentPrimaryTarget || "",
        firstExternalApprovalStatus: workflowSelection.recommendedFirstExternalApproval?.status || "",
        pilotQaRunId: pilotEvidence.qaRunId || "",
        assetVersion: pilotEvidence.assetVersion || ""
      },
      blockApprovalIf: workflowSelection.approvalDecisionIntake?.blockApprovalIf || [
        "Receiver location, signing material, or target identity would be stored in the public repo."
      ],
      noSecretEvidenceExamples: workflowSelection.approvalDecisionIntake?.noSecretEvidenceExamples || [
        "Private workflow approval note dated YYYY-MM-DD."
      ]
    })
  }));
}

if (todoOpen(todo, "Review and upload seed/binder docs")) {
  approvals.push(approval({
    id: "seed_binder_private_upload",
    label: "Seed/Binder Private Upload",
    category: "internal_docs",
    status: privateUploadManifest.uploadStatus || "operator_review_required",
    blocksPublicLaunch: false,
    owner: "Internal operations owner",
    source: "docs/private-upload-manifest.json",
    nextAction: `Approve uploading the curated Lux Veritas Website Build package to the private ${privateUploadManifest.recommendedFolderName || "website build"} folder for Arie/collaborator access; exclude source zips, local caches, secrets, internal ecosystem seed/binder materials, and internal app folders.`,
    verification: "node tools/qa-private-upload-manifest.mjs && node tools/qa-product-boundary.mjs",
    notes: [
      `folder=${privateUploadManifest.recommendedFolderName || "unknown"}`,
      `target=${privateUploadManifest.shareTarget || "unknown"}`,
      privateUploadManifest.recommendedUploadApproval?.status || "",
      "Do not upload secrets, local caches, source zips, or internal-only seed materials into public repo paths."
    ],
    decisionIntake: decisionIntake({
      approvalId: "seed_binder_private_upload",
      purpose: "Record private upload approval outside the public repo before sharing the curated collaborator package.",
      requiredFields: ["operationsOwner", "folderName", "shareTarget", "uploadPackageEvidence", "exclusionEvidence"],
      versionLock: {
        manifest: "docs/private-upload-manifest.json",
        recommendedFolderName: privateUploadManifest.recommendedFolderName || "",
        shareTarget: privateUploadManifest.shareTarget || "",
        approvalStatus: privateUploadManifest.recommendedUploadApproval?.status || ""
      },
      blockApprovalIf: [
        "The upload set includes source zip archives, local caches, secrets, private keys, internal-only seed materials, or internal app folders.",
        "The destination is a public repo, public Drive folder, or unaudited share target.",
        "The uploader cannot confirm the package matches docs/upload-checklist.md and docs/private-upload-manifest.json."
      ],
      noSecretEvidenceExamples: [
        "Private Drive folder creation note with folder name only.",
        "Upload checklist signoff dated YYYY-MM-DD without private links."
      ]
    })
  }));
}

if (todoOpen(todo, "Add Event Terms")) {
  approvals.push(approval({
    id: "event_terms",
    label: "Event Terms",
    category: "conditional_legal",
    status: "conditional",
    blocksPublicLaunch: false,
    owner: "Legal/business reviewer",
    source: "TODO.md",
    nextAction: "Add Event Terms before ticketing, paid events, or public RSVP goes live.",
    verification: "Review event flow and rerun legal/release QA.",
    notes: ["Not required while events remain request-access only."],
    decisionIntake: decisionIntake({
      approvalId: "event_terms",
      purpose: "Record the event-terms trigger decision outside the public repo before ticketing, paid events, or public RSVP goes live.",
      requiredFields: ["trigger", "eventFlowOwner", "legalOwner", "goLiveScope"],
      versionLock: {
        currentPublicEventMode: "request_access_only",
        source: "TODO.md"
      },
      blockApprovalIf: [
        "Ticketing, paid events, public RSVP, exact private locations, pricing, guest lists, or private performance details would go live without reviewed event terms."
      ],
      noSecretEvidenceExamples: [
        "Event terms not-triggered note dated YYYY-MM-DD.",
        "Legal trigger ticket ID without private event details."
      ]
    })
  }));
}

if (todoOpen(todo, "Add Purchase/Membership terms")) {
  approvals.push(approval({
    id: "purchase_membership_terms",
    label: "Purchase/Membership Terms",
    category: "conditional_legal",
    status: "conditional",
    blocksPublicLaunch: false,
    owner: "Legal/business reviewer",
    source: "TODO.md",
    nextAction: "Add Purchase/Membership terms before commerce, paid membership, paid drops, shipping, refunds, or cancellations go live.",
    verification: "Review commerce flow and rerun legal/release QA.",
    notes: ["Not required while store and membership remain waitlist-only."],
    decisionIntake: decisionIntake({
      approvalId: "purchase_membership_terms",
      purpose: "Record the commerce and paid-membership terms trigger decision outside the public repo before payments, shipping, refunds, or paid access go live.",
      requiredFields: ["trigger", "commerceOwner", "legalOwner", "goLiveScope"],
      versionLock: {
        currentPublicCommerceMode: "waitlist_only",
        source: "TODO.md"
      },
      blockApprovalIf: [
        "Paid membership, paid drops, store checkout, shipping, refunds, cancellations, or creator payment flows would go live without reviewed purchase or membership terms."
      ],
      noSecretEvidenceExamples: [
        "Commerce terms not-triggered note dated YYYY-MM-DD.",
        "Legal trigger ticket ID without private payment provider details."
      ]
    })
  }));
}

for (const id of ["privacy_review", "terms_review"]) {
  if (!approvals.some((item) => item.id === id)) issues.push(`missing required legal approval ${id}`);
}

const publicLaunchBlockers = approvals.filter((item) => item.blocksPublicLaunch);
const report = {
  schemaVersion: "luxveritas.open_approvals_report.v1",
  generatedAt: new Date().toISOString(),
  project: "LuxVeritas.media",
  liveUrl: "https://luxveritas.media",
  decision: publicLaunchBlockers.length ? "external_approvals_pending" : "ready_for_final_release_gate",
  phase: phaseStatus.currentPhase || null,
  pilotEvidence: {
    result: pilotEvidence.result || "",
    qaRunId: pilotEvidence.qaRunId || "",
    updatedAt: pilotEvidence.updatedAt || "",
    formCaptureIntents: pilotEvidence.writeEvidence?.formCaptureIntents || 0,
    eventWrites: pilotEvidence.writeEvidence?.eventWrites || 0
  },
  counts: {
    totalOpenOrConditional: approvals.filter((item) => item.status !== "approved").length,
    publicLaunchBlockers: publicLaunchBlockers.length,
    approvals: approvals.length
  },
  approvals
};

const output = JSON.stringify(report, null, 2);
if (secretShape(output)) {
  console.error("Open approvals output appears to contain secret-shaped data.");
  process.exit(1);
}

if (issues.length) {
  console.error(`Open approvals report failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

if (jsonMode) {
  console.log(output);
} else {
  console.log("Lux Veritas open approvals report");
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Decision: ${report.decision}`);
  console.log(`Pilot evidence: ${report.pilotEvidence.result} run=${report.pilotEvidence.qaRunId} forms=${report.pilotEvidence.formCaptureIntents} events=${report.pilotEvidence.eventWrites}`);
  console.log(`Open/conditional approvals: ${report.counts.totalOpenOrConditional}`);
  console.log(`Public launch blockers: ${report.counts.publicLaunchBlockers}`);
  console.log("");
  for (const item of report.approvals) {
    console.log(`- ${item.label} [${item.category}] ${item.status}${item.blocksPublicLaunch ? " - blocks public launch" : ""}`);
    console.log(`  Owner: ${item.owner}`);
    console.log(`  Source: ${item.source}`);
    console.log(`  Next: ${item.nextAction}`);
    console.log(`  Verify: ${item.verification}`);
  }
}
