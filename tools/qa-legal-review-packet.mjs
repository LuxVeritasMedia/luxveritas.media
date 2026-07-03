import { readFile } from "node:fs/promises";

const issues = [];

function issue(message) {
  issues.push(message);
}

const [packet, legalReviewRaw, publicTermsRaw, pilotEvidenceRaw] = await Promise.all([
  readFile("docs/legal-review-packet.md", "utf8"),
  readFile("data/lux-legal-review.json", "utf8"),
  readFile("data/lux-public-terms.json", "utf8"),
  readFile("data/lux-pilot-write-evidence.json", "utf8")
]);

const legalReview = JSON.parse(legalReviewRaw);
const publicTerms = JSON.parse(publicTermsRaw);
const pilotEvidence = JSON.parse(pilotEvidenceRaw);
const legalItems = new Map((legalReview.items || []).map((item) => [item.id, item]));

for (const marker of [
  "This packet is for Privacy and Terms review before public launch. It is not legal approval.",
  "/legal/privacy.html",
  "/legal/terms.html",
  "/submissions.html",
  "data/lux-public-terms.json",
  "data/lux-legal-review.json",
  "tools/build-static.mjs",
  "Current Technical Evidence",
  "data/lux-pilot-write-evidence.json",
  "Remaining public-launch blockers",
  "Privacy Checklist",
  "Terms Checklist",
  "Approval Commands",
  "Acceptance",
  "node tools/export-legal-review-request.mjs",
  "node tools/qa-legal-review-request.mjs",
  "LUX_LEGAL_SYNC_LAUNCH=1",
  "LUX_LEGAL_EVIDENCE",
  "LUX_LEGAL_REVIEW_ITEM=privacy",
  "LUX_LEGAL_REVIEW_ITEM=terms",
  "data/lux-launch-readiness.json",
  "data/lux-launch-closeout.json",
  "node tools/qa-release-readiness.mjs"
]) {
  if (!packet.includes(marker)) issue(`docs/legal-review-packet.md missing marker: ${marker}`);
}

for (const field of ["version", "privacyVersion", "termsVersion", "submissionTermsVersion"]) {
  const value = publicTerms[field];
  if (!value || !packet.includes(value)) {
    issue(`docs/legal-review-packet.md missing public terms value: ${field}`);
  }
}

for (const value of [
  pilotEvidence.assetVersion,
  pilotEvidence.qaRunId,
  pilotEvidence.updatedAt,
  pilotEvidence.result,
  String(pilotEvidence.writeEvidence?.formCaptureIntents),
  String(pilotEvidence.writeEvidence?.eventWrites)
]) {
  if (!value || !packet.includes(value)) {
    issue(`docs/legal-review-packet.md missing pilot evidence value: ${value || "missing"}`);
  }
}

if (!packet.includes(`- pilotQaRunId: \`${pilotEvidence.qaRunId}\``)) {
  issue("docs/legal-review-packet.md reviewer decision intake must lock the current pilot QA run ID");
}

for (const id of ["privacy", "terms"]) {
  const item = legalItems.get(id);
  if (!item) {
    issue(`data/lux-legal-review.json missing item: ${id}`);
    continue;
  }
  if (!packet.includes(item.route)) issue(`docs/legal-review-packet.md missing route for ${id}: ${item.route}`);
  if (!packet.includes(item.version)) issue(`docs/legal-review-packet.md missing version for ${id}: ${item.version}`);
}

for (const marker of [
  "data collected",
  "email and SMS consent",
  "analytics",
  "purchases",
  "events",
  "submissions",
  "user content",
  "memberships",
  "creator participation",
  "licensing",
  "refunds",
  "contact path"
]) {
  if (!packet.toLowerCase().includes(marker.toLowerCase())) {
    issue(`docs/legal-review-packet.md missing checklist concept: ${marker}`);
  }
}

if (/re_[A-Za-z0-9_-]{8,}/.test(packet)) {
  issue("docs/legal-review-packet.md appears to contain a real provider key");
}

if (/approved legal conclusion|guaranteed compliant/i.test(packet)) {
  issue("docs/legal-review-packet.md should not claim legal approval or compliance");
}

if (issues.length) {
  console.error(`Legal review packet QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Legal review packet QA passed.");
