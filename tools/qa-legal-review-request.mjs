import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const issues = [];

function issue(message) {
  issues.push(message);
}

function secretShape(value) {
  return /re_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}/.test(value);
}

const [markdownResult, jsonResult, legalReviewRaw, publicTermsRaw, pilotEvidenceRaw] = await Promise.all([
  execFileAsync(process.execPath, ["tools/export-legal-review-request.mjs"], {
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4
  }),
  execFileAsync(process.execPath, ["tools/export-legal-review-request.mjs"], {
    env: { ...process.env, LUX_LEGAL_PACKET_FORMAT: "json" },
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4
  }),
  readFile("data/lux-legal-review.json", "utf8"),
  readFile("data/lux-public-terms.json", "utf8"),
  readFile("data/lux-pilot-write-evidence.json", "utf8")
]);

const markdown = markdownResult.stdout;
const jsonRaw = jsonResult.stdout;
const legalReview = JSON.parse(legalReviewRaw);
const publicTerms = JSON.parse(publicTermsRaw);
const pilotEvidence = JSON.parse(pilotEvidenceRaw);

if (secretShape(markdown) || secretShape(jsonRaw)) {
  issue("legal review request appears to contain secret-shaped data");
}

for (const marker of [
  "# Lux Veritas Legal Review Request",
  "This is not legal approval",
  "https://luxveritas.media",
  "Public terms bundle",
  "Current Technical Evidence",
  "Pilot write evidence",
  "data/lux-pilot-write-evidence.json",
  "Review Routes",
  "Privacy sections:",
  "Terms sections:",
  "Current Launch Blockers",
  "Reviewer Checklist",
  "Reviewer Decision Intake",
  "Required decision values: approved, needs_changes, blocked",
  "Version lock:",
  "Do not approve if:",
  "No-secret evidence examples:",
  "Approval Commands",
  "LUX_LEGAL_SYNC_LAUNCH=1",
  "LUX_LEGAL_EVIDENCE",
  "LUX_LEGAL_REVIEW_ITEM=privacy",
  "LUX_LEGAL_REVIEW_ITEM=terms",
  "node tools/qa-release-readiness.mjs"
]) {
  if (!markdown.includes(marker)) issue(`markdown request missing marker: ${marker}`);
}

for (const value of [
  publicTerms.version,
  publicTerms.privacyVersion,
  publicTerms.termsVersion,
  publicTerms.submissionTermsVersion
]) {
  if (!value || !jsonRaw.includes(value)) issue(`JSON request missing public terms value: ${value || "missing"}`);
}

let packet = null;
try {
  packet = JSON.parse(jsonRaw);
} catch (error) {
  issue(`legal review request JSON is invalid: ${error?.message || String(error)}`);
}

if (packet) {
  if (packet.schemaVersion !== "luxveritas.legal_review_request.v1") issue("legal review request schemaVersion mismatch");
  if (packet.project !== "LuxVeritas.media") issue("legal review request project mismatch");
  if (packet.liveUrl !== "https://luxveritas.media") issue("legal review request liveUrl mismatch");
  if (!packet.assetVersion) issue("legal review request assetVersion missing");
  if (packet.pilotWriteEvidence?.evidenceFile !== "data/lux-pilot-write-evidence.json") {
    issue("legal review request pilot evidence file mismatch");
  }
  if (packet.pilotWriteEvidence?.qaRunId !== pilotEvidence.qaRunId) {
    issue("legal review request pilot qaRunId mismatch");
  }
  if (packet.pilotWriteEvidence?.result !== pilotEvidence.result) {
    issue("legal review request pilot result mismatch");
  }
  if (packet.pilotWriteEvidence?.assetVersion !== pilotEvidence.assetVersion) {
    issue("legal review request pilot assetVersion mismatch");
  }
  if (packet.pilotWriteEvidence?.inboxDeliveryRequired !== pilotEvidence.writeEvidence?.inboxDeliveryRequired) {
    issue("legal review request pilot inbox delivery mismatch");
  }
  if (!markdown.includes(pilotEvidence.qaRunId)) {
    issue("markdown request missing pilot qaRunId");
  }
  if (!Array.isArray(packet.reviewerChecklist) || packet.reviewerChecklist.length < 5) {
    issue("legal review request checklist is incomplete");
  }
  if (packet.reviewerDecisionIntake?.purpose !== "Reviewer fills this out outside the public repo before any approval command is run.") {
    issue("legal review request decision intake purpose mismatch");
  }
  for (const decision of ["approved", "needs_changes", "blocked"]) {
    if (!packet.reviewerDecisionIntake?.requiredDecisionValues?.includes(decision)) {
      issue(`legal review request decision intake missing decision value: ${decision}`);
    }
  }
  for (const field of ["reviewerName", "reviewedAt", "decision", "privacyVersion", "termsVersion", "submissionTermsVersion", "evidenceReference", "conditionsOrChanges"]) {
    if (!packet.reviewerDecisionIntake?.requiredFields?.includes(field)) {
      issue(`legal review request decision intake missing field: ${field}`);
    }
  }
  if (packet.reviewerDecisionIntake?.versionLock?.privacyVersion !== publicTerms.privacyVersion) {
    issue("legal review request decision intake privacy version mismatch");
  }
  if (packet.reviewerDecisionIntake?.versionLock?.termsVersion !== publicTerms.termsVersion) {
    issue("legal review request decision intake terms version mismatch");
  }
  if (packet.reviewerDecisionIntake?.versionLock?.submissionTermsVersion !== publicTerms.submissionTermsVersion) {
    issue("legal review request decision intake submission terms version mismatch");
  }
  if (packet.reviewerDecisionIntake?.versionLock?.pilotQaRunId !== pilotEvidence.qaRunId) {
    issue("legal review request decision intake pilot QA run mismatch");
  }
  for (const guard of [
    "The live Privacy or Terms route differs from the reviewed draft.",
    "Any approval evidence includes secrets, private URLs, credentials, account IDs, or non-public contract terms."
  ]) {
    if (!packet.reviewerDecisionIntake?.blockApprovalIf?.includes(guard)) {
      issue(`legal review request decision intake missing approval blocker: ${guard}`);
    }
  }
  if (!packet.reviewerDecisionIntake?.noSecretEvidenceExamples?.some((item) => /Legal review email dated YYYY-MM-DD/.test(item))) {
    issue("legal review request decision intake missing no-secret evidence example");
  }
  for (const id of ["privacy", "terms"]) {
    const manifestItem = legalReview.items.find((item) => item.id === id);
    const requestItem = packet.legal?.[id];
    if (!manifestItem) {
      issue(`legal review manifest missing item ${id}`);
      continue;
    }
    if (!requestItem) {
      issue(`legal review request missing item ${id}`);
      continue;
    }
    if (requestItem.route !== manifestItem.route) issue(`${id} route mismatch`);
    if (requestItem.version !== manifestItem.version) issue(`${id} version mismatch`);
    if (requestItem.status !== manifestItem.status) issue(`${id} status mismatch`);
    if (!requestItem.liveUrl?.startsWith("https://luxveritas.media/")) issue(`${id} live URL missing`);
    if (!requestItem.page?.noPlaceholderLanguage) issue(`${id} page proof still reports placeholder language`);
    if (!Array.isArray(requestItem.page?.sections) || requestItem.page.sections.length < 8) {
      issue(`${id} page proof sections are incomplete`);
    }
  }
  const privacySections = new Set(packet.legal?.privacy?.page?.sections || []);
  const termsSections = new Set(packet.legal?.terms?.page?.sections || []);
  for (const section of ["Data Collected", "Email and SMS Consent", "Analytics", "Purchases", "Events", "Submissions and User Content", "Memberships and Community", "Creator Participation and Licensing", "Contact"]) {
    if (!privacySections.has(section)) issue(`privacy page proof missing section: ${section}`);
  }
  for (const section of ["Site Use", "Submissions", "User Content", "Memberships and Creator Participation", "Events", "Purchases", "Refunds and Cancellations", "Licensing and Partnerships", "Intellectual Property", "Contact"]) {
    if (!termsSections.has(section)) issue(`terms page proof missing section: ${section}`);
  }
  for (const id of ["privacy_review", "terms_review"]) {
    if (!packet.blockedLaunchGates?.some((gate) => gate.id === id)) {
      issue(`legal review request missing active blocker ${id}`);
    }
  }
  for (const command of [
    "LUX_LEGAL_SYNC_LAUNCH=1 LUX_LEGAL_EVIDENCE=\"Legal review packet YYYY-MM-DD\" LUX_LEGAL_REVIEW_ITEM=privacy LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY=\"Reviewer Name\" node tools/set-legal-review-status.mjs",
    "LUX_LEGAL_SYNC_LAUNCH=1 LUX_LEGAL_EVIDENCE=\"Legal review packet YYYY-MM-DD\" LUX_LEGAL_REVIEW_ITEM=terms LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY=\"Reviewer Name\" node tools/set-legal-review-status.mjs",
    "node tools/build-static.mjs",
    "node tools/prepare-hosting.mjs",
    "node tools/qa-release-readiness.mjs"
  ]) {
    if (!packet.approvalCommands?.includes(command)) issue(`legal review request missing approval command: ${command}`);
  }
}

if (/approved legal conclusion|guaranteed compliant/i.test(`${markdown}\n${jsonRaw}`)) {
  issue("legal review request should not claim legal approval or compliance");
}

if (issues.length) {
  console.error(`Legal review request QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Legal review request QA passed.");
