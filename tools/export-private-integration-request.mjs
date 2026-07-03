import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  buildIntegrationPayload,
  integrationBaseHeaders,
  integrationSignature,
  integrationContractVersion,
  integrationEventType
} from "../functions/integration-contract.js";

const format = process.env.LUX_PRIVATE_INTEGRATION_PACKET_FORMAT === "json" ? "json" : "markdown";
const outPath = process.env.LUX_PRIVATE_INTEGRATION_PACKET_OUT || "";

function secretShape(value) {
  return /\bre_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|FORM_INTEGRATION_URL=https:\/\/\S+/i.test(value);
}

const [
  profilesRaw,
  fieldMapRaw,
  workflowMatrixRaw,
  workflowSelectionRaw,
  pilotEvidenceRaw,
  launchRaw,
  closeoutRaw,
  buildRaw,
  publicTermsRaw
] = await Promise.all([
  readFile("docs/private-integration-profiles.json", "utf8"),
  readFile("docs/private-integration-field-map.json", "utf8"),
  readFile("docs/private-workflow-matrix.json", "utf8"),
  readFile("docs/private-workflow-selection.json", "utf8"),
  readFile("data/lux-pilot-write-evidence.json", "utf8"),
  readFile("data/lux-launch-readiness.json", "utf8"),
  readFile("data/lux-launch-closeout.json", "utf8"),
  readFile("data/lux-build-manifest.json", "utf8"),
  readFile("data/lux-public-terms.json", "utf8")
]);

if (secretShape(`${profilesRaw}\n${fieldMapRaw}\n${workflowMatrixRaw}\n${workflowSelectionRaw}\n${pilotEvidenceRaw}\n${launchRaw}\n${closeoutRaw}\n${buildRaw}\n${publicTermsRaw}`)) {
  console.error("Private integration request input appears to contain secret-shaped data.");
  process.exit(1);
}

const registry = JSON.parse(profilesRaw);
const fieldMap = JSON.parse(fieldMapRaw);
const workflowMatrix = JSON.parse(workflowMatrixRaw);
const workflowSelection = JSON.parse(workflowSelectionRaw);
const pilotEvidence = JSON.parse(pilotEvidenceRaw);
const launch = JSON.parse(launchRaw);
const closeout = JSON.parse(closeoutRaw);
const build = JSON.parse(buildRaw);
const publicTerms = JSON.parse(publicTermsRaw);
const profiles = Array.isArray(registry.profiles) ? registry.profiles : [];
const activeProfiles = profiles.filter((profile) => profile.status !== "future");
const futureProfiles = profiles.filter((profile) => profile.status === "future");
const fieldMapProfiles = Array.isArray(fieldMap.profiles) ? fieldMap.profiles : [];
const recommendedTarget = workflowSelection.recommendedFirstExternalTarget || "";
const recommendedProfile = profiles.find((profile) => profile.id === recommendedTarget) || null;
const recommendedMapping = fieldMapProfiles.find((profile) => profile.id === recommendedTarget) || null;
const recommendedActivation = Array.isArray(workflowSelection.recommendedActivationOrder)
  ? workflowSelection.recommendedActivationOrder.find((item) => item.profile === recommendedTarget)
  : null;
const privateHandoffGate = (Array.isArray(launch.gates) ? launch.gates : [])
  .find((gate) => gate.id === "private_handoff");
const requiredSecrets = [...new Set(profiles.flatMap((profile) => profile.requiredSecrets || []))].sort();
const sampleSubmissionId = "sample-submission-id";
const sampleReceivedAt = "2026-06-30T00:00:00.000Z";
const samplePayload = buildIntegrationPayload({
  client_submission_id: "sample-receipt-id",
  source: "luxveritas.media",
  source_page: "/membership.html",
  formType: "membership",
  tag: "membership_waitlist",
  inquiry_type: "membership",
  inquiry_key: "membership",
  interest_paths: ["music", "events", "drops", "community"],
  role_path: "member",
  access_path: "first_access",
  portal_role_target: "member",
  routing_queue: "membership_waitlist",
  routing_label: "Membership Waitlist",
  routing_priority: "standard",
  routing_next_action: "send_first_access_follow_up",
  routing_sla: "3 business days",
  name: "Sample Reviewer",
  email: "integration-review@example.com",
  phone: "",
  consent_email: true,
  consent_sms: false,
  public_terms_version: "2026-07-03-public-capture",
  privacy_version: "privacy-draft-2026-07-03",
  terms_version: "terms-draft-2026-06-09",
  submission_terms_version: "submission-draft-2026-06-09",
  message: "Sample private handoff payload for receiver implementation."
}, sampleSubmissionId, {
  receivedAt: sampleReceivedAt,
  integrationTarget: recommendedTarget || "google_workspace"
});
const sampleBody = JSON.stringify(samplePayload);
const sampleHeaders = {
  ...integrationBaseHeaders(sampleSubmissionId, { integrationTarget: recommendedTarget || "google_workspace" }),
  "X-Lux-Signature": integrationSignature(sampleBody, "sample-shared-secret-not-production")
};

function fieldBuckets(profile = {}) {
  return Object.fromEntries(
    Object.entries(profile)
      .filter(([key, value]) => key.endsWith("Fields") && Array.isArray(value))
      .map(([key, value]) => [key, value])
  );
}

function mappedProfile(profile) {
  const mapping = fieldMapProfiles.find((item) => item.id === profile.id) || {};
  return {
    id: profile.id,
    label: profile.label,
    destinationType: mapping.destinationType || "",
    primaryRecord: mapping.primaryRecord || "",
    actions: mapping.actions || [],
    fieldBuckets: fieldBuckets(mapping),
    notes: mapping.notes || ""
  };
}

const packet = {
  schemaVersion: "luxveritas.private_integration_request.v1",
  generatedAt: new Date().toISOString(),
  purpose: "No-secret private handoff activation request for approved CRM, Google Workspace, CodexOps, or internal workflow targets.",
  project: "LuxVeritas.media",
  liveUrl: "https://luxveritas.media",
  firebaseProject: "lux-veritas-media",
  githubRepo: "LuxVeritasMedia/luxveritas.media",
  assetVersion: build.assetVersion || build.version || "",
  registry: {
    schemaVersion: registry.schemaVersion || "",
    purpose: registry.purpose || "",
    profileCount: profiles.length
  },
  handoffGate: privateHandoffGate ? {
    status: privateHandoffGate.status,
    nextAction: privateHandoffGate.nextAction,
    verification: privateHandoffGate.verification
  } : null,
  pilotEvidence: {
    source: "data/lux-pilot-write-evidence.json",
    updatedAt: pilotEvidence.updatedAt || "",
    result: pilotEvidence.result || "",
    qaRunId: pilotEvidence.qaRunId || "",
    assetVersion: pilotEvidence.assetVersion || "",
    formCaptureIntents: pilotEvidence.writeEvidence?.formCaptureIntents ?? null,
    eventWrites: pilotEvidence.writeEvidence?.eventWrites ?? null,
    inboxDeliveryRequired: pilotEvidence.writeEvidence?.inboxDeliveryRequired === true,
    operatorReportVerified: pilotEvidence.writeEvidence?.operatorReportVerified === true,
    postWriteReconciliation: pilotEvidence.writeEvidence?.postWriteReconciliation === true
  },
  contract: {
    schemaVersion: integrationContractVersion,
    eventType: integrationEventType,
    replaySafe: true,
    idempotencyKeyShape: "luxveritas:form_submission:<submissionId>",
    headers: [
      "X-Lux-Event",
      "X-Lux-Idempotency-Key",
      "X-Lux-Target",
      "X-Lux-Signature"
    ]
  },
  receiverImplementation: {
    method: "POST",
    contentType: "application/json",
    timeoutMs: 6000,
    expectedSuccess: "Any 2xx response marks the private handoff delivered.",
    expectedFailure: "Non-2xx, timeout, or request errors keep the record replayable from protected operator reporting.",
    idempotency: "Receiver should dedupe by X-Lux-Idempotency-Key and payload.idempotencyKey.",
    signature: "When a signing secret is configured, verify X-Lux-Signature as HMAC-SHA256 over the raw request body.",
    sampleSigningSecret: "sample-shared-secret-not-production",
    sampleHeaders,
    samplePayload
  },
  fieldMap: {
    schemaVersion: fieldMap.schemaVersion || "",
    purpose: fieldMap.purpose || "",
    contract: fieldMap.contract || "",
    eventType: fieldMap.eventType || "",
    requiredPayloadPaths: fieldMap.requiredPayloadPaths || [],
    profileMappings: profiles.map(mappedProfile)
  },
  workflowMatrix: {
    schemaVersion: workflowMatrix.schemaVersion || "",
    contract: workflowMatrix.contract || "",
    eventType: workflowMatrix.eventType || "",
    currentPrimaryProfile: workflowMatrix.currentPrimaryProfile || "",
    publicExposure: workflowMatrix.publicExposure || "",
    queueCount: Array.isArray(workflowMatrix.queues) ? workflowMatrix.queues.length : 0,
    queues: Array.isArray(workflowMatrix.queues)
      ? workflowMatrix.queues.map((queue) => ({
        id: queue.id,
        label: queue.label,
        owner: queue.owner,
        priority: queue.priority,
        sla: queue.sla,
        currentProfile: queue.currentProfile,
        approvedNextProfiles: queue.approvedNextProfiles || [],
        actions: queue.actions || [],
        acceptance: queue.acceptance || []
      }))
      : []
  },
  workflowSelection: {
    schemaVersion: workflowSelection.schemaVersion || "",
    selectionStatus: workflowSelection.selectionStatus || "",
    currentPrimaryTarget: workflowSelection.currentPrimaryTarget || "",
    recommendedFirstExternalTarget: workflowSelection.recommendedFirstExternalTarget || "",
    recommendationRationale: workflowSelection.recommendationRationale || "",
    recommendedFirstExternalApproval: workflowSelection.recommendedFirstExternalApproval || null,
    recommendedActivationOrder: Array.isArray(workflowSelection.recommendedActivationOrder)
      ? workflowSelection.recommendedActivationOrder.map((item) => ({
        rank: item.rank,
        profile: item.profile,
        decision: item.decision,
        queueCoverage: item.queueCoverage || [],
        primaryJob: item.primaryJob,
        approvalRequired: item.approvalRequired === true
      }))
      : [],
    approvalChecklist: workflowSelection.approvalChecklist || [],
    approvalDecisionIntake: workflowSelection.approvalDecisionIntake || null,
    doNotDo: workflowSelection.doNotDo || []
  },
  approvalDecisionIntake: {
    purpose: workflowSelection.approvalDecisionIntake?.purpose || "",
    requiredDecisionValues: workflowSelection.approvalDecisionIntake?.requiredDecisionValues || [],
    requiredFields: workflowSelection.approvalDecisionIntake?.requiredFields || [],
    versionLock: {
      selectionSchemaVersion: workflowSelection.schemaVersion || "",
      recommendedTarget: recommendedTarget || "",
      currentPrimaryTarget: workflowSelection.currentPrimaryTarget || "",
      assetVersion: build.assetVersion || build.version || "",
      pilotQaRunId: pilotEvidence.qaRunId || "",
      publicTermsVersion: publicTerms.version || "",
      privacyVersion: publicTerms.privacyVersion || "",
      termsVersion: publicTerms.termsVersion || "",
      submissionTermsVersion: publicTerms.submissionTermsVersion || ""
    },
    blockApprovalIf: workflowSelection.approvalDecisionIntake?.blockApprovalIf || [],
    noSecretEvidenceExamples: workflowSelection.approvalDecisionIntake?.noSecretEvidenceExamples || []
  },
  recommendedExternalActivation: recommendedProfile ? {
    target: recommendedProfile.id,
    label: recommendedProfile.label,
    status: recommendedProfile.status,
    providerClass: recommendedProfile.providerClass,
    targetSecretValue: recommendedProfile.targetSecretValue,
    approvalLanguage: workflowSelection.recommendedFirstExternalApproval?.approvalLanguage || "",
    approvalScope: workflowSelection.recommendedFirstExternalApproval?.approvalScope || [],
    approvalEvidence: workflowSelection.recommendedFirstExternalApproval?.approvalEvidence || [],
    dryRunEvidence: workflowSelection.recommendedFirstExternalApproval?.dryRunEvidence || [],
    postActivationEvidence: workflowSelection.recommendedFirstExternalApproval?.postActivationEvidence || [],
    approvalRequired: recommendedProfile.status === "future",
    queueCoverage: recommendedActivation?.queueCoverage || [],
    primaryJob: recommendedActivation?.primaryJob || "",
    destinationType: recommendedMapping?.destinationType || "",
    primaryRecord: recommendedMapping?.primaryRecord || "",
    allowedActions: recommendedProfile.allowedActions || [],
    requiredApprovalFields: [
      "workflow owner",
      "receiver owner",
      "receiver location approved outside this repo",
      "signing secret approved outside this repo",
      "replay owner",
      "rollback owner",
      "retention expectation",
      "legal-version evidence owner"
    ],
    dryRunCommand: `LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1 LUX_PRIVATE_INTEGRATION_ACTIVATION_DRY_RUN=1 LUX_FORM_INTEGRATION_URL='https://approved-${recommendedProfile.id.replace(/_/g, "-")}-receiver.example/intake' LUX_FORM_INTEGRATION_SIGNING_SECRET='approved-shared-secret' LUX_FORM_INTEGRATION_TARGET='${recommendedProfile.targetSecretValue}' node tools/activate-private-integration.mjs`,
    activationCommand: `LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1 LUX_FORM_INTEGRATION_URL='https://approved-${recommendedProfile.id.replace(/_/g, "-")}-receiver.example/intake' LUX_FORM_INTEGRATION_SIGNING_SECRET='approved-shared-secret' LUX_FORM_INTEGRATION_TARGET='${recommendedProfile.targetSecretValue}' node tools/activate-private-integration.mjs`,
    postActivationChecks: [
      "node tools/qa-provider-readiness.mjs",
      "node tools/qa-live-operator-report.mjs",
      "LUX_FORM_MATRIX_WRITE=1 LUX_EXPECT_EMAIL_SENT=1 node tools/qa-live-form-matrix.mjs",
      "LUX_PILOT_WRITE_TESTS=1 node tools/qa-pilot-write-gate.mjs"
    ],
    acceptance: [
      "Firebase handoff remains the rollback path until the external receiver proves live writes and replay.",
      "Provider readiness reports the recommended target active without printing destination values.",
      "The protected operator report shows the selected target and recent accepted handoffs.",
      "A live form matrix write reaches inbox delivery and the selected private handoff.",
      "No public route exposes the receiver URL, provider account data, field IDs, tokens, or workflow implementation details."
    ],
    rollback: [
      "Return FORM_INTEGRATION_TARGET to firebase_handoff.",
      "Restore the Firebase receiver URL and signing material through Firebase Secret Manager.",
      "Redeploy submitForm, reportActivity, and receivePrivateHandoff.",
      "Run provider readiness, live operator report QA, and one no-write live matrix check."
    ]
  } : null,
  requiredSecrets,
  approvedProfiles: activeProfiles.map((profile) => ({
    id: profile.id,
    label: profile.label,
    status: profile.status,
    providerClass: profile.providerClass,
    targetSecretValue: profile.targetSecretValue,
    allowedActions: profile.allowedActions || [],
    handoffContract: profile.handoffContract,
    notes: profile.notes
  })),
  futureProfiles: futureProfiles.map((profile) => ({
    id: profile.id,
    label: profile.label,
    providerClass: profile.providerClass,
    targetSecretValue: profile.targetSecretValue,
    approvalRequired: "Requires explicit human approval and LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1 before activation."
  })),
  activationCommands: [
    "LUX_PRIVATE_INTEGRATION_ACTIVATION_DRY_RUN=1 LUX_FORM_INTEGRATION_URL='https://approved-private-endpoint.example' LUX_FORM_INTEGRATION_SIGNING_SECRET='approved-shared-secret' LUX_FORM_INTEGRATION_TARGET='private_workflow' node tools/activate-private-integration.mjs",
    "LUX_FORM_INTEGRATION_URL='https://approved-private-endpoint.example' LUX_FORM_INTEGRATION_SIGNING_SECRET='approved-shared-secret' LUX_FORM_INTEGRATION_TARGET='private_workflow' node tools/activate-private-integration.mjs",
    "node tools/qa-provider-readiness.mjs",
    "node tools/qa-integrations.mjs",
    "node tools/qa-integration-contract.mjs",
    "node tools/qa-release-readiness.mjs"
  ],
  acceptance: [
    "Chosen target is one of docs/private-integration-profiles.json profile IDs.",
    "Provider URL and signing secret are stored only in Firebase Secret Manager, never in public files or client JavaScript.",
    "FORM_INTEGRATION_TARGET matches the chosen profile label.",
    "Provider readiness reports active private handoff configuration.",
    "Private report shows the chosen handoff target and can replay pending handoffs.",
    "Future profiles such as ghl_crm, google_workspace, and codex_ops are activated only after human approval."
  ],
  closeoutStatus: {
    updatedAt: closeout.updatedAt || "",
    items: Array.isArray(closeout.items)
      ? closeout.items.map((item) => ({
        id: item.id,
        label: item.label,
        status: item.status,
        owner: item.owner
      }))
      : []
  }
};

let rendered = "";
if (format === "json") {
  rendered = `${JSON.stringify(packet, null, 2)}\n`;
} else {
  const profileRows = packet.approvedProfiles
    .map((profile) => `- ${profile.id}: ${profile.label} (${profile.status}) - ${profile.notes}`)
    .join("\n");
  const futureRows = packet.futureProfiles
    .map((profile) => `- ${profile.id}: ${profile.label} - ${profile.approvalRequired}`)
    .join("\n");
  const mappingRows = packet.fieldMap.profileMappings
    .map((profile) => {
      const bucketList = Object.entries(profile.fieldBuckets)
        .map(([key, value]) => `${key}: ${value.join(", ")}`)
        .join("; ");
      return `- ${profile.id}: ${profile.destinationType} -> ${profile.primaryRecord}; actions: ${profile.actions.join(", ")}; fields: ${bucketList}`;
    })
    .join("\n");
  const workflowRows = packet.workflowMatrix.queues
    .map((queue) => `- ${queue.id}: ${queue.owner}; SLA ${queue.sla}; current ${queue.currentProfile}; next ${queue.approvedNextProfiles.join(", ")}; actions: ${queue.actions.join(", ")}`)
    .join("\n");

  rendered = `# Lux Veritas Private Integration Activation Request

Generated: ${packet.generatedAt}

Purpose: ${packet.purpose}

Project: ${packet.project}
Live URL: ${packet.liveUrl}
Asset version: ${packet.assetVersion}

## Current Handoff Gate

- Status: ${packet.handoffGate?.status || "missing"}
- Next action: ${packet.handoffGate?.nextAction || "missing"}
- Verification: ${packet.handoffGate?.verification || "missing"}

## Current Pilot Evidence

- Source: ${packet.pilotEvidence.source}
- Result: ${packet.pilotEvidence.result}
- QA run ID: ${packet.pilotEvidence.qaRunId}
- Asset version: ${packet.pilotEvidence.assetVersion}
- Updated: ${packet.pilotEvidence.updatedAt}
- Live capture intents: ${packet.pilotEvidence.formCaptureIntents}
- Live event writes: ${packet.pilotEvidence.eventWrites}
- Inbox delivery required: ${packet.pilotEvidence.inboxDeliveryRequired ? "yes" : "no"}
- Operator report verified: ${packet.pilotEvidence.operatorReportVerified ? "yes" : "no"}
- Post-write reconciliation: ${packet.pilotEvidence.postWriteReconciliation ? "yes" : "no"}

## Contract

- Schema: ${packet.contract.schemaVersion}
- Event: ${packet.contract.eventType}
- Replay safe: ${packet.contract.replaySafe ? "yes" : "no"}
- Idempotency key: ${packet.contract.idempotencyKeyShape}
- Headers: ${packet.contract.headers.join(", ")}

## Receiver Implementation Sample

- Method: ${packet.receiverImplementation.method}
- Content type: ${packet.receiverImplementation.contentType}
- Timeout: ${packet.receiverImplementation.timeoutMs}ms
- Success: ${packet.receiverImplementation.expectedSuccess}
- Failure: ${packet.receiverImplementation.expectedFailure}
- Idempotency: ${packet.receiverImplementation.idempotency}
- Signature: ${packet.receiverImplementation.signature}
- Sample signing secret: ${packet.receiverImplementation.sampleSigningSecret}

Sample headers:

\`\`\`json
${JSON.stringify(packet.receiverImplementation.sampleHeaders, null, 2)}
\`\`\`

Sample payload:

\`\`\`json
${JSON.stringify(packet.receiverImplementation.samplePayload, null, 2)}
\`\`\`

## Downstream Field Map

- Schema: ${packet.fieldMap.schemaVersion}
- Contract: ${packet.fieldMap.contract}
- Event: ${packet.fieldMap.eventType}
- Required payload paths: ${packet.fieldMap.requiredPayloadPaths.join(", ")}

${mappingRows || "- None"}

## Downstream Workflow Matrix

- Schema: ${packet.workflowMatrix.schemaVersion}
- Current primary profile: ${packet.workflowMatrix.currentPrimaryProfile}
- Public exposure: ${packet.workflowMatrix.publicExposure}
- Queue count: ${packet.workflowMatrix.queueCount}

${workflowRows || "- None"}

## Private Workflow Selection

- Schema: ${packet.workflowSelection.schemaVersion}
- Status: ${packet.workflowSelection.selectionStatus}
- Current primary target: ${packet.workflowSelection.currentPrimaryTarget}
- Recommended first external target: ${packet.workflowSelection.recommendedFirstExternalTarget}
- Rationale: ${packet.workflowSelection.recommendationRationale}

${packet.workflowSelection.recommendedActivationOrder.map((item) => `- ${item.rank}. ${item.profile}: ${item.decision}; queues: ${item.queueCoverage.join(", ")}; job: ${item.primaryJob}; approval required: ${item.approvalRequired ? "yes" : "no"}`).join("\n") || "- None"}

## Exact First External Approval

- Status: ${packet.workflowSelection.recommendedFirstExternalApproval?.status || "missing"}
- Target: ${packet.workflowSelection.recommendedFirstExternalApproval?.target || "missing"}
- Target secret value: ${packet.workflowSelection.recommendedFirstExternalApproval?.targetSecretValue || "missing"}

\`\`\`text
${packet.workflowSelection.recommendedFirstExternalApproval?.approvalLanguage || "missing"}
\`\`\`

Approval scope:

${packet.workflowSelection.recommendedFirstExternalApproval?.approvalScope?.map((item) => `- ${item}`).join("\n") || "- None"}

Private values required outside this repo:

${packet.workflowSelection.recommendedFirstExternalApproval?.privateValuesRequiredOutsideRepo?.map((item) => `- ${item}`).join("\n") || "- None"}

Evidence before activation:

${packet.workflowSelection.recommendedFirstExternalApproval?.approvalEvidence?.map((item) => `- ${item}`).join("\n") || "- None"}

## Approval Decision Intake

Purpose: ${packet.approvalDecisionIntake.purpose || "missing"}

Required decision values: ${packet.approvalDecisionIntake.requiredDecisionValues.join(", ") || "missing"}

Required fields:

${packet.approvalDecisionIntake.requiredFields.map((item) => `- ${item}`).join("\n") || "- None"}

Version lock:

- Selection schema: ${packet.approvalDecisionIntake.versionLock.selectionSchemaVersion}
- Recommended target: ${packet.approvalDecisionIntake.versionLock.recommendedTarget}
- Current primary target: ${packet.approvalDecisionIntake.versionLock.currentPrimaryTarget}
- Asset version: ${packet.approvalDecisionIntake.versionLock.assetVersion}
- Pilot QA run ID: ${packet.approvalDecisionIntake.versionLock.pilotQaRunId}
- Public terms version: ${packet.approvalDecisionIntake.versionLock.publicTermsVersion}
- Privacy version: ${packet.approvalDecisionIntake.versionLock.privacyVersion}
- Terms version: ${packet.approvalDecisionIntake.versionLock.termsVersion}
- Submission terms version: ${packet.approvalDecisionIntake.versionLock.submissionTermsVersion}

Do not approve if:

${packet.approvalDecisionIntake.blockApprovalIf.map((item) => `- ${item}`).join("\n") || "- None"}

No-secret evidence examples:

${packet.approvalDecisionIntake.noSecretEvidenceExamples.map((item) => `- ${item}`).join("\n") || "- None"}

## Recommended First External Activation

- Target: ${packet.recommendedExternalActivation?.target || "missing"}
- Label: ${packet.recommendedExternalActivation?.label || "missing"}
- Status: ${packet.recommendedExternalActivation?.status || "missing"}
- Provider class: ${packet.recommendedExternalActivation?.providerClass || "missing"}
- Target secret value: ${packet.recommendedExternalActivation?.targetSecretValue || "missing"}
- Approval required: ${packet.recommendedExternalActivation?.approvalRequired ? "yes" : "no"}
- Queue coverage: ${packet.recommendedExternalActivation?.queueCoverage?.join(", ") || "missing"}
- Primary job: ${packet.recommendedExternalActivation?.primaryJob || "missing"}
- Required approval fields: ${packet.recommendedExternalActivation?.requiredApprovalFields?.join(", ") || "missing"}
- Exact approval: ${packet.recommendedExternalActivation?.approvalLanguage || "missing"}

Dry run:

\`\`\`bash
${packet.recommendedExternalActivation?.dryRunCommand || "missing"}
\`\`\`

Activation after approval:

\`\`\`bash
${packet.recommendedExternalActivation?.activationCommand || "missing"}
\`\`\`

Post-activation checks:

${packet.recommendedExternalActivation?.postActivationChecks?.map((item) => `- ${item}`).join("\n") || "- None"}

Target acceptance:

${packet.recommendedExternalActivation?.acceptance?.map((item) => `- ${item}`).join("\n") || "- None"}

Rollback:

${packet.recommendedExternalActivation?.rollback?.map((item) => `- ${item}`).join("\n") || "- None"}

## Required Firebase Secrets

${packet.requiredSecrets.map((secret) => `- ${secret}`).join("\n")}

## Active Or Ready Profiles

${profileRows || "- None"}

## Future Profiles

${futureRows || "- None"}

## Activation Commands

\`\`\`bash
${packet.activationCommands.join("\n")}
\`\`\`

## Acceptance

${packet.acceptance.map((item) => `- ${item}`).join("\n")}
`;
}

if (secretShape(rendered)) {
  console.error("Private integration request output appears to contain secret-shaped data.");
  process.exit(1);
}

if (outPath) {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, rendered);
}

process.stdout.write(rendered);
