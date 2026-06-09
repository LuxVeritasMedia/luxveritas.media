import {
  buildIntegrationPayload,
  integrationBaseHeaders,
  integrationContractVersion,
  integrationEventType,
  integrationIdempotencyKey
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
  consent_email: true,
  consent_sms: false,
  message: "Integration contract QA"
};

const payload = buildIntegrationPayload(sample, submissionId, { receivedAt });
const headers = integrationBaseHeaders(submissionId);
const expectedIdempotencyKey = `luxveritas:form_submission:${submissionId}`;

function expectEqual(actual, expected, label) {
  if (actual !== expected) issues.push(`${label}: expected ${expected}, received ${actual}`);
}

expectEqual(integrationContractVersion, "luxveritas.form_submission.v1", "contract version");
expectEqual(integrationEventType, "form.submission.received", "event type");
expectEqual(integrationIdempotencyKey(submissionId), expectedIdempotencyKey, "idempotency helper");
expectEqual(payload.schemaVersion, integrationContractVersion, "payload schemaVersion");
expectEqual(payload.eventType, integrationEventType, "payload eventType");
expectEqual(payload.idempotencyKey, expectedIdempotencyKey, "payload idempotencyKey");
expectEqual(payload.replaySafe, true, "payload replaySafe");
expectEqual(payload.submissionId, submissionId, "payload submissionId");
expectEqual(payload.receiptId, "LV-CONTRACT-QA", "payload receiptId");
expectEqual(payload.receivedAt, receivedAt, "payload receivedAt");
expectEqual(payload.sourcePage, "/membership.html", "payload sourcePage");
expectEqual(payload.routing.queue, "membership_waitlist", "payload routing queue");
expectEqual(payload.routing.priority, "standard", "payload routing priority");
expectEqual(payload.contact.email, "qa@luxveritas.media", "payload contact email");
expectEqual(payload.consent.email, true, "payload email consent");
expectEqual(payload.consent.sms, false, "payload sms consent");
expectEqual(payload.submission.id, submissionId, "payload nested submission id");
expectEqual(payload.submission.receiptId, "LV-CONTRACT-QA", "payload nested receipt");
expectEqual(headers["X-Lux-Event"], integrationContractVersion, "header X-Lux-Event");
expectEqual(headers["X-Lux-Idempotency-Key"], expectedIdempotencyKey, "header idempotency key");
expectEqual(headers["User-Agent"], "LuxVeritas-FormIntegration/1.0", "header user agent");

if (!payload.message || !payload.formType || !payload.tag) {
  issues.push("payload: missing message, formType, or tag");
}

if (issues.length) {
  console.error(`Integration contract QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Integration contract QA passed.");
