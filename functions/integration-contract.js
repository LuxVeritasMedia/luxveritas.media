export const integrationContractVersion = "luxveritas.form_submission.v1";
export const integrationEventType = "form.submission.received";

export function integrationIdempotencyKey(id) {
  return `luxveritas:form_submission:${id}`;
}

export function buildIntegrationPayload(payload, id, options = {}) {
  const receiptId = payload.client_submission_id || id;
  const sourcePage = payload.source_page || "";
  const receivedAt = options.receivedAt || new Date().toISOString();

  return {
    schemaVersion: integrationContractVersion,
    eventType: integrationEventType,
    idempotencyKey: integrationIdempotencyKey(id),
    replaySafe: true,
    submissionId: id,
    receiptId,
    receivedAt,
    source: payload.source || "luxveritas.media",
    sourcePage,
    formType: payload.formType || "",
    tag: payload.tag || "",
    inquiryType: payload.inquiry_type || "",
    inquiryKey: payload.inquiry_key || "",
    rolePath: payload.role_path || "",
    accessPath: payload.access_path || "",
    portalRoleTarget: payload.portal_role_target || "",
    routing: {
      queue: payload.routing_queue || "",
      label: payload.routing_label || "",
      priority: payload.routing_priority || "",
      nextAction: payload.routing_next_action || "",
      sla: payload.routing_sla || ""
    },
    contact: {
      name: payload.name,
      email: payload.email,
      phone: payload.phone
    },
    consent: {
      email: Boolean(payload.consent_email),
      sms: Boolean(payload.consent_sms)
    },
    legal: {
      publicTermsVersion: payload.public_terms_version || "",
      privacyVersion: payload.privacy_version || "",
      termsVersion: payload.terms_version || "",
      submissionTermsVersion: payload.submission_terms_version || ""
    },
    submission: {
      id,
      receiptId,
      sourcePage,
      formType: payload.formType || "",
      tag: payload.tag || "",
      receivedAt
    },
    message: payload.message
  };
}

export function integrationBaseHeaders(id) {
  return {
    "Content-Type": "application/json",
    "User-Agent": "LuxVeritas-FormIntegration/1.0",
    "X-Lux-Event": integrationContractVersion,
    "X-Lux-Idempotency-Key": integrationIdempotencyKey(id)
  };
}
