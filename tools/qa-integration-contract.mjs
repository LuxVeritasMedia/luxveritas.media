import {
  buildIntegrationPayload,
  defaultIntegrationTarget,
  integrationBaseHeaders,
  integrationContractVersion,
  integrationEventType,
  integrationIdempotencyKey,
  integrationSignature,
  normalizeIntegrationTarget,
  verifyIntegrationSignature
} from "../functions/integration-contract.js";

const issues = [];
const submissionId = "sub_contract_001";
const receivedAt = "2026-06-09T12:00:00.000Z";
const sample = {
  client_submission_id: "LV-CONTRACT-QA",
  name: "Lux Contract QA",
  email: "qa@luxveritas.media",
  phone: "+15555550123",
  role_path: "Member",
  access_path: "member",
  portal_role_target: "member",
  inquiry_type: "Membership",
  inquiry_key: "membership",
  routing_queue: "membership_waitlist",
  routing_label: "Membership Waitlist",
  routing_priority: "standard",
  routing_next_action: "Send first-access follow-up",
  routing_sla: "3 business days",
  formType: "fan",
  tag: "membership-waitlist",
  source: "luxveritas.media",
  source_page: "/membership.html",
  public_terms_version: "2026-06-09-public-capture",
  privacy_version: "privacy-draft-2026-06-09",
  terms_version: "terms-draft-2026-06-09",
  submission_terms_version: "submission-draft-2026-06-09",
  consent_email: true,
  consent_sms: false,
  message: "Integration contract QA"
};

const integrationTarget = normalizeIntegrationTarget("Private Workflow");
const payload = buildIntegrationPayload(sample, submissionId, { receivedAt, integrationTarget });
const headers = integrationBaseHeaders(submissionId, { integrationTarget });
const defaultHeaders = integrationBaseHeaders(submissionId);
const expectedIdempotencyKey = `luxveritas:form_submission:${submissionId}`;
const body = JSON.stringify(payload);
const signingSecret = "qa-private-handoff-secret";
const signature = integrationSignature(body, signingSecret);
const badSignature = `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`;

function expectEqual(actual, expected, label) {
  if (actual !== expected) issues.push(`${label}: expected ${expected}, received ${actual}`);
}

expectEqual(integrationContractVersion, "luxveritas.form_submission.v1", "contract version");
expectEqual(integrationEventType, "form.submission.received", "event type");
expectEqual(defaultIntegrationTarget, "unconfigured", "default integration target");
expectEqual(integrationIdempotencyKey(submissionId), expectedIdempotencyKey, "idempotency helper");
expectEqual(integrationTarget, "private_workflow", "normalized integration target");
expectEqual(payload.schemaVersion, integrationContractVersion, "payload schemaVersion");
expectEqual(payload.eventType, integrationEventType, "payload eventType");
expectEqual(payload.idempotencyKey, expectedIdempotencyKey, "payload idempotencyKey");
expectEqual(payload.replaySafe, true, "payload replaySafe");
expectEqual(payload.integrationTarget, "private_workflow", "payload integration target");
expectEqual(payload.receiver.target, "private_workflow", "payload receiver target");
expectEqual(payload.receiver.contractVersion, integrationContractVersion, "payload receiver contract version");
expectEqual(payload.submissionId, submissionId, "payload submissionId");
expectEqual(payload.receiptId, "LV-CONTRACT-QA", "payload receiptId");
expectEqual(payload.receivedAt, receivedAt, "payload receivedAt");
expectEqual(payload.sourcePage, "/membership.html", "payload sourcePage");
expectEqual(payload.routing.queue, "membership_waitlist", "payload routing queue");
expectEqual(payload.routing.priority, "standard", "payload routing priority");
expectEqual(payload.contact.email, "qa@luxveritas.media", "payload contact email");
expectEqual(payload.consent.email, true, "payload email consent");
expectEqual(payload.consent.sms, false, "payload sms consent");
expectEqual(payload.legal.publicTermsVersion, "2026-06-09-public-capture", "payload public terms version");
expectEqual(payload.legal.privacyVersion, "privacy-draft-2026-06-09", "payload privacy version");
expectEqual(payload.legal.termsVersion, "terms-draft-2026-06-09", "payload terms version");
expectEqual(payload.legal.submissionTermsVersion, "submission-draft-2026-06-09", "payload submission terms version");
expectEqual(payload.submission.id, submissionId, "payload nested submission id");
expectEqual(payload.submission.receiptId, "LV-CONTRACT-QA", "payload nested receipt");
expectEqual(headers["X-Lux-Event"], integrationContractVersion, "header X-Lux-Event");
expectEqual(headers["X-Lux-Idempotency-Key"], expectedIdempotencyKey, "header idempotency key");
expectEqual(headers["X-Lux-Target"], "private_workflow", "header target");
expectEqual(defaultHeaders["X-Lux-Target"], "unconfigured", "default header target");
expectEqual(headers["User-Agent"], "LuxVeritas-FormIntegration/1.0", "header user agent");
expectEqual(/^[a-f0-9]{64}$/.test(signature), true, "signature shape");
expectEqual(verifyIntegrationSignature(body, signingSecret, signature), true, "signature verification");
expectEqual(verifyIntegrationSignature(body, signingSecret, badSignature), false, "signature rejection");

if (!payload.message || !payload.formType || !payload.tag) {
  issues.push("payload: missing message, formType, or tag");
}

if (issues.length) {
  console.error(`Integration contract QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Integration contract QA passed.");
