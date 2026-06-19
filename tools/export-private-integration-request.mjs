import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const format = process.env.LUX_PRIVATE_INTEGRATION_PACKET_FORMAT === "json" ? "json" : "markdown";
const outPath = process.env.LUX_PRIVATE_INTEGRATION_PACKET_OUT || "";

function secretShape(value) {
  return /re_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|FORM_INTEGRATION_URL=https:\/\/\S+/i.test(value);
}

const [
  profilesRaw,
  launchRaw,
  closeoutRaw,
  buildRaw,
  contractJs
] = await Promise.all([
  readFile("docs/private-integration-profiles.json", "utf8"),
  readFile("data/lux-launch-readiness.json", "utf8"),
  readFile("data/lux-launch-closeout.json", "utf8"),
  readFile("data/lux-build-manifest.json", "utf8"),
  readFile("functions/integration-contract.js", "utf8")
]);

if (secretShape(`${profilesRaw}\n${launchRaw}\n${closeoutRaw}\n${buildRaw}`)) {
  console.error("Private integration request input appears to contain secret-shaped data.");
  process.exit(1);
}

const registry = JSON.parse(profilesRaw);
const launch = JSON.parse(launchRaw);
const closeout = JSON.parse(closeoutRaw);
const build = JSON.parse(buildRaw);
const profiles = Array.isArray(registry.profiles) ? registry.profiles : [];
const activeProfiles = profiles.filter((profile) => profile.status !== "future");
const futureProfiles = profiles.filter((profile) => profile.status === "future");
const privateHandoffGate = (Array.isArray(launch.gates) ? launch.gates : [])
  .find((gate) => gate.id === "private_handoff");
const integrationContractVersion = contractJs.match(/integrationContractVersion\s*=\s*"([^"]+)"/)?.[1] || "luxveritas.form_submission.v1";
const integrationEventType = contractJs.match(/integrationEventType\s*=\s*"([^"]+)"/)?.[1] || "form.submission.received";
const requiredSecrets = [...new Set(profiles.flatMap((profile) => profile.requiredSecrets || []))].sort();

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

## Contract

- Schema: ${packet.contract.schemaVersion}
- Event: ${packet.contract.eventType}
- Replay safe: ${packet.contract.replaySafe ? "yes" : "no"}
- Idempotency key: ${packet.contract.idempotencyKeyShape}
- Headers: ${packet.contract.headers.join(", ")}

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
