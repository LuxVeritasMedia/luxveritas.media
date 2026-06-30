import { readFile } from "node:fs/promises";

const jsonMode = process.env.LUX_OPEN_APPROVALS_JSON === "1";
const issues = [];

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

function approval({ id, label, category, status, blocksPublicLaunch, owner, source, nextAction, verification, notes = [] }) {
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
    notes
  };
}

function secretShape(value) {
  return /\bre_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{16,}|serviceAccount:[^<\s]+@[^<\s]+\.iam\.gserviceaccount\.com/i.test(value);
}

const [
  launchRaw,
  closeoutRaw,
  legalRaw,
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
  ].filter(Boolean)
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
  ].filter(Boolean)
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
    nextAction: "Approve and grant roles/iam.serviceAccountUser on lux-veritas-media@appspot.gserviceaccount.com to the GitHub deploy service account, then rerun the manual Functions workflow.",
    verification: "node tools/qa-functions-deploy-readiness.mjs",
    notes: [
      "Live Functions are deployed; this hardens future manual Functions deploy automation.",
      "Do not mutate IAM without explicit project-owner approval."
    ]
  }));
}

if (todoOpen(todo, "Configure approved external CRM/Google workflow target")) {
  approvals.push(approval({
    id: "external_workflow_target",
    label: "External Workflow Target",
    category: "private_workflow",
    status: workflowSelection.selectionStatus || "approval_required",
    blocksPublicLaunch: false,
    owner: "Private workflow owner",
    source: "docs/private-workflow-selection.json",
    nextAction: "Approve the receiver owner, receiver location, signing material, replay owner, and rollback owner before activating the first external target.",
    verification: "node tools/qa-private-workflow-selection.mjs && LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1 LUX_PRIVATE_INTEGRATION_ACTIVATION_DRY_RUN=1 ... node tools/activate-private-integration.mjs",
    notes: [
      `current=${workflowSelection.currentPrimaryTarget || "unknown"}`,
      `recommended=${workflowSelection.recommendedFirstExternalTarget || "unknown"}`,
      workflowSelection.selectionRule || ""
    ].filter(Boolean)
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
    nextAction: "Review and upload seed/binder docs to Drive or a private internal repo; keep them out of public GitHub and deploy artifacts.",
    verification: "node tools/qa-private-upload-manifest.mjs && node tools/qa-product-boundary.mjs",
    notes: [
      `folder=${privateUploadManifest.recommendedFolderName || "unknown"}`,
      `target=${privateUploadManifest.shareTarget || "unknown"}`,
      "Do not upload secrets, local caches, source zips, or internal-only seed materials into public repo paths."
    ]
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
    notes: ["Not required while events remain request-access only."]
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
    notes: ["Not required while store and membership remain waitlist-only."]
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
