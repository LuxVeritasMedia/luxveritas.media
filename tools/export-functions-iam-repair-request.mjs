import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const format = process.env.LUX_FUNCTIONS_IAM_PACKET_FORMAT === "json" ? "json" : "markdown";
const outPath = process.env.LUX_FUNCTIONS_IAM_PACKET_OUT || "";
const repo = "LuxVeritasMedia/luxveritas.media";
const project = "lux-veritas-media";
const workflow = "firebase-functions-manual.yml";
const targetServiceAccount = "lux-veritas-media@appspot.gserviceaccount.com";
const principalSecretName = "GCP_SERVICE_ACCOUNT";
const providerSecretName = "GCP_WORKLOAD_IDENTITY_PROVIDER";
const requiredRole = "roles/iam.serviceAccountUser";
const requiredPermission = "iam.serviceAccounts.ActAs";
const repairDoc = "docs/functions-deploy-iam-repair.md";

function secretShape(value) {
  return /\bre_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{16,}|serviceAccount:[^<\s]+@[^<\s]+\.iam\.gserviceaccount\.com/i.test(value);
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
    latestKnownFailedRun: run,
    failureShape: `manual Functions deploy lacks ${requiredPermission} on ${targetServiceAccount}`
  },
  knownFacts: [
    "GitHub Actions uses Workload Identity, not a committed service-account key.",
    "GitHub secret values cannot be read back after creation.",
    `The principal value is stored as GitHub secret ${principalSecretName}.`,
    `The Workload Identity provider value is stored as GitHub secret ${providerSecretName}.`,
    "The public site, form relay, inbox delivery, private handoff, and operator reporting are live; this blocker is automation hardening for future Functions deploys."
  ],
  cloudConsole: {
    url: `https://console.cloud.google.com/iam-admin/serviceaccounts/details/${targetServiceAccount}/permissions?project=${project}`,
    steps: [
      "Open the target service account permissions page.",
      "Choose Grant access.",
      `Principal: paste the service account email stored in GitHub Actions secret ${principalSecretName}.`,
      "Role: Service Account User.",
      "Save."
    ]
  },
  gcloudTemplate: [
    "gcloud iam service-accounts add-iam-policy-binding \\",
    `  ${targetServiceAccount} \\`,
    `  --project=${project} \\`,
    `  --member=\"serviceAccount:PASTE_${principalSecretName}_VALUE_HERE\" \\`,
    `  --role=\"${requiredRole}\"`
  ].join("\n"),
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
- Latest known failed run: ${value.blocker.latestKnownFailedRun.url || "Not recorded"}

## Known Facts

${value.knownFacts.map((item) => `- ${item}`).join("\n")}

## Cloud Console Repair

Open:

\`\`\`text
${value.cloudConsole.url}
\`\`\`

${value.cloudConsole.steps.map((item, index) => `${index + 1}. ${item}`).join("\n")}

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
