import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const format = process.env.LUX_FUNCTIONS_IAM_PACKET_FORMAT === "json" ? "json" : "markdown";
const outPath = process.env.LUX_FUNCTIONS_IAM_PACKET_OUT || "";
const repo = "LuxVeritasMedia/luxveritas.media";
const project = "lux-veritas-media";
const workflow = "firebase-functions-manual.yml";
const targetServiceAccount = "lux-veritas-media@appspot.gserviceaccount.com";
const identifiedDeployServiceAccount = "github-actions-firebase@lux-veritas-media.iam.gserviceaccount.com";
const identifiedProviderPrincipal = "principalSet://iam.googleapis.com/projects/795940577664/locations/global/workloadIdentityPools/github-actions-pool/attribute.repository/LuxVeritasMedia/luxveritas.media";
const identifiedProviderCondition = "assertion.repository == 'LuxVeritasMedia/luxveritas.media' && assertion.ref == 'refs/heads/main'";
const principalSecretName = "GCP_SERVICE_ACCOUNT";
const providerSecretName = "GCP_WORKLOAD_IDENTITY_PROVIDER";
const requiredRole = "roles/iam.serviceAccountUser";
const requiredPermission = "iam.serviceAccounts.ActAs";
const repairDoc = "docs/functions-deploy-iam-repair.md";
const cloudSdkPython = "/Users/frederickparent/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const gcloudPath = ".codex-tools/google-cloud-sdk/bin/gcloud";
const exactApprovalLanguage = `I approve granting ${requiredRole} on ${targetServiceAccount} to ${identifiedDeployServiceAccount} for the ${repo} manual Firebase Functions deploy workflow.`;

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

function latestKnownRun(doc) {
  const url = doc.match(/https:\/\/github\.com\/LuxVeritasMedia\/luxveritas\.media\/actions\/runs\/(\d+)/)?.[0] || "";
  return {
    url,
    id: url.match(/\/runs\/(\d+)/)?.[1] || "",
    source: url ? repairDoc : "not_recorded"
  };
}

const [workflowSource, repairSource, buildRaw, handoff, runbook, todo] = await Promise.all([
  readFile(".github/workflows/firebase-functions-manual.yml", "utf8"),
  readFile(repairDoc, "utf8"),
  readFile("data/lux-build-manifest.json", "utf8"),
  readFile("docs/production-release-handoff.md", "utf8"),
  readFile("docs/final-launch-runbook.md", "utf8"),
  readFile("TODO.md", "utf8")
]);

const inputText = `${workflowSource}\n${repairSource}\n${buildRaw}\n${handoff}\n${runbook}\n${todo}`;
if (secretShape(inputText)) {
  console.error("Functions IAM repair packet input appears to contain secret-shaped values. Refusing to export.");
  process.exit(1);
}

const build = JSON.parse(buildRaw);
const run = latestKnownRun(repairSource);
const packet = {
  schemaVersion: "luxveritas.functions_iam_repair_request.v1",
  generatedAt: new Date().toISOString(),
  purpose: "No-secret repair request for the remaining GitHub manual Firebase Functions deployment IAM blocker.",
  project,
  githubRepo: repo,
  workflow,
  assetVersion: build.assetVersion || build.version || "",
  blocker: {
    status: "external_iam_grant_required",
    requiredPermission,
    requiredRole,
    targetServiceAccount,
    principalSecretName,
    providerSecretName,
    identifiedPrincipal: {
      status: "identified_pending_explicit_project_owner_approval",
      serviceAccount: identifiedDeployServiceAccount,
      evidence: [
        "Read-only Google Cloud IAM inspection found this account has the Workload Identity User binding for LuxVeritasMedia/luxveritas.media.",
        `Provider principal: ${identifiedProviderPrincipal}`,
        `Provider condition: ${identifiedProviderCondition}`,
        "Project IAM shows this account currently has Firebase viewer/hosting permissions."
      ],
      exactApprovalLanguage
    },
    latestKnownFailedRun: run,
    failureShape: `manual Functions deploy lacks ${requiredPermission} on ${targetServiceAccount}`
  },
  knownFacts: [
    "GitHub Actions uses Workload Identity, not a committed service-account key.",
    "GitHub secret values cannot be read back after creation.",
    `Read-only IAM inspection identified ${identifiedDeployServiceAccount} as the active GitHub Workload Identity service account for this repo.`,
    "Security approval is required before any agent, local command, or GitHub workflow mutates Google Cloud IAM.",
    `The principal value is stored as GitHub secret ${principalSecretName}.`,
    `The Workload Identity provider value is stored as GitHub secret ${providerSecretName}.`,
    "The public site, form relay, inbox delivery, private handoff, and operator reporting are live; this blocker is automation hardening for future Functions deploys."
  ],
  cloudConsole: {
    url: `https://console.cloud.google.com/iam-admin/serviceaccounts/details/${targetServiceAccount}/permissions?project=${project}`,
    steps: [
      "Open the target service account permissions page.",
      "Choose Grant access.",
      `Principal: ${identifiedDeployServiceAccount}.`,
      "Role: Service Account User.",
      "Save."
    ]
  },
  unknownPrincipalRecovery: {
    status: "identified_principal_ready_for_explicit_approval",
    rule: "Use the identified principal above unless the GitHub secret is intentionally rotated; do not guess a new deploy service account principal.",
    steps: [
      `Confirm ${identifiedDeployServiceAccount} remains the approved GitHub deploy service account.`,
      "If it is not approved, have the project owner choose or create a new GitHub deploy service account without creating a JSON key.",
      "Confirm the approved service account is allowed to impersonate through the existing Workload Identity provider.",
      `Replace GitHub Actions secret ${principalSecretName} with the approved service account email.`,
      `Grant ${requiredRole} on ${targetServiceAccount} to the approved deploy service account.`,
      `Rerun ${workflow} and node tools/qa-functions-deploy-readiness.mjs.`
    ],
    githubSecretRotationTemplate: `printf '%s' 'APPROVED_DEPLOY_SERVICE_ACCOUNT_EMAIL' | gh secret set ${principalSecretName} --repo ${repo}`,
    keyPolicy: "Do not create, download, upload, paste, or commit service-account JSON keys."
  },
  gcloudTemplate: [
    `CLOUDSDK_PYTHON=${cloudSdkPython} \\`,
    `  ${gcloudPath} iam service-accounts add-iam-policy-binding \\`,
    `  ${targetServiceAccount} \\`,
    `  --project=${project} \\`,
    `  --member=\"serviceAccount:${identifiedDeployServiceAccount}\" \\`,
    `  --role=\"${requiredRole}\"`
  ].join("\n"),
  exactApprovalLanguage,
  verificationCommands: [
    `.codex-tools/gh-local/bin/gh workflow run ${workflow} --repo ${repo}`,
    "node tools/qa-functions-deploy-readiness.mjs",
    "node tools/qa-provider-readiness.mjs",
    "node tools/qa-live-site.mjs"
  ],
  successCriteria: [
    "Latest manual Functions deploy completes successfully.",
    "Functions deploy readiness reports 0 deploy blockers.",
    "Cloud Run public relay access remains intact after deploy.",
    "Live site, inbox delivery, private handoff, and operator report QA still pass."
  ],
  doNotInclude: [
    "Do not paste service-account JSON keys into chat, docs, GitHub, or this repo.",
    "Do not commit receiver URLs, tokens, provider account IDs, private keys, or workflow destinations.",
    "Do not add a self-repair IAM workflow or run IAM mutation commands without explicit project-owner approval.",
    "Do not expose the actual GitHub secret values in public docs or screenshots."
  ]
};

function markdown(value) {
  return `# Lux Veritas Functions IAM Repair Request

Generated: ${value.generatedAt}

Purpose: ${value.purpose}

## Target

- Project: ${value.project}
- GitHub repo: ${value.githubRepo}
- Workflow: ${value.workflow}
- Current asset version: ${value.assetVersion}
- Target service account: ${value.blocker.targetServiceAccount}
- Required role: ${value.blocker.requiredRole}
- Required permission: ${value.blocker.requiredPermission}
- Principal source: GitHub Actions secret \`${value.blocker.principalSecretName}\`
- Workload provider source: GitHub Actions secret \`${value.blocker.providerSecretName}\`
- Identified principal: ${value.blocker.identifiedPrincipal.serviceAccount}
- Principal status: ${value.blocker.identifiedPrincipal.status}
- Latest known failed run: ${value.blocker.latestKnownFailedRun.url || "Not recorded"}

## Known Facts

${value.knownFacts.map((item) => `- ${item}`).join("\n")}

## Identified Principal Evidence

${value.blocker.identifiedPrincipal.evidence.map((item) => `- ${item}`).join("\n")}

## Exact Approval Language

\`\`\`text
${value.exactApprovalLanguage}
\`\`\`

## Cloud Console Repair

Open:

\`\`\`text
${value.cloudConsole.url}
\`\`\`

${value.cloudConsole.steps.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## Unknown Principal Recovery

- Status: ${value.unknownPrincipalRecovery.status}
- Rule: ${value.unknownPrincipalRecovery.rule}

${value.unknownPrincipalRecovery.steps.map((item, index) => `${index + 1}. ${item}`).join("\n")}

GitHub secret rotation template:

\`\`\`bash
${value.unknownPrincipalRecovery.githubSecretRotationTemplate}
\`\`\`

Key policy: ${value.unknownPrincipalRecovery.keyPolicy}

## gcloud Template

\`\`\`bash
${value.gcloudTemplate}
\`\`\`

## Verify

\`\`\`bash
${value.verificationCommands.join("\n")}
\`\`\`

## Success Criteria

${value.successCriteria.map((item) => `- ${item}`).join("\n")}

## Do Not Include

${value.doNotInclude.map((item) => `- ${item}`).join("\n")}
`;
}

const output = format === "json" ? `${JSON.stringify(packet, null, 2)}\n` : markdown(packet);
if (secretShape(output)) {
  console.error("Functions IAM repair packet output appears to contain secret-shaped values. Refusing to export.");
  process.exit(1);
}

if (outPath) {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, output);
  console.log(`Wrote Functions IAM repair request to ${outPath}`);
} else {
  process.stdout.write(output);
}
