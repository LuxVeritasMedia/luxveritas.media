# Firebase Functions Deploy IAM Repair

Status date: 2026-06-30

This packet documents the no-secret repair path for the remaining GitHub manual Functions deployment blocker.

## Current Operator Findings

- Firebase CLI can read the deployed `submitForm` and `reportActivity` Functions from the current launch machine.
- GitHub CLI is authenticated and can inspect workflow status.
- GitHub Actions secrets `GCP_SERVICE_ACCOUNT` and `GCP_WORKLOAD_IDENTITY_PROVIDER` exist, but their values cannot be read back.
- Recent workflow logs mask the GitHub deploy service account value as `***`, so the principal cannot be safely recovered from logs.
- Google Cloud CLI is available at `.codex-tools/google-cloud-sdk/bin/gcloud` when run with the bundled Python runtime:

```bash
CLOUDSDK_PYTHON=/Users/frederickparent/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  .codex-tools/google-cloud-sdk/bin/gcloud
```

- Read-only IAM inspection on 2026-06-30 found the active GitHub Workload Identity service account:

```text
github-actions-firebase@lux-veritas-media.iam.gserviceaccount.com
```

- The service account above has a Workload Identity User binding for:

```text
principalSet://iam.googleapis.com/projects/795940577664/locations/global/workloadIdentityPools/github-actions-pool/attribute.repository/LuxVeritasMedia/luxveritas.media
```

- The Workload Identity provider is active and limited to:

```text
assertion.repository == 'LuxVeritasMedia/luxveritas.media' && assertion.ref == 'refs/heads/main'
```

- This account currently has project-level Firebase viewer/hosting permissions, but it still needs the target runtime-service-account grant below for manual Functions deploys.
- The latest manual `workflow_dispatch` Functions deploy evidence is still the failed run below.

Security approval is required before any agent, local command, or GitHub workflow mutates Google Cloud IAM. Do not add a self-repair workflow or run the `gcloud` policy-binding command until the project owner explicitly approves granting `roles/iam.serviceAccountUser` on `lux-veritas-media@appspot.gserviceaccount.com` to `github-actions-firebase@lux-veritas-media.iam.gserviceaccount.com`.

## Current Blocker

The latest manual Functions workflow run failed during:

```bash
npx firebase-tools@15.22.1 deploy --only functions --project lux-veritas-media --non-interactive --force
```

Failure:

```text
Missing permissions required for functions deploy.
You must have permission iam.serviceAccounts.ActAs on service account lux-veritas-media@appspot.gserviceaccount.com.
```

Failed run:

```text
https://github.com/LuxVeritasMedia/luxveritas.media/actions/runs/28463324534
```

## Required Grant

Grant the GitHub deploy service account this role:

```text
Project: lux-veritas-media
Target service account: lux-veritas-media@appspot.gserviceaccount.com
Principal: github-actions-firebase@lux-veritas-media.iam.gserviceaccount.com
Role: Service Account User
Role ID: roles/iam.serviceAccountUser
Permission supplied: iam.serviceAccounts.ActAs
```

Do not paste service-account keys, JSON credentials, provider URLs, or tokens into the repo.

## Cloud Console Path

1. Open Google Cloud Console:

```text
https://console.cloud.google.com/iam-admin/serviceaccounts/details/lux-veritas-media@appspot.gserviceaccount.com/permissions?project=lux-veritas-media
```

2. Choose `Grant access`.
3. Principal: `github-actions-firebase@lux-veritas-media.iam.gserviceaccount.com`.
4. Role: `Service Account User`.
5. Save.

If the GitHub secret later changes, re-run the read-only IAM inspection instead of guessing. GitHub secret values cannot be read back after creation, so the value must come from the original setup notes, Google Cloud IAM, or by replacing the GitHub secret with a newly approved deploy service account.

## If The Secret Value Is Unknown

Do not guess the principal. Use one of these approved recovery paths:

1. Find the existing deploy service account in Google Cloud IAM by inspecting the Workload Identity provider and service account impersonation bindings for `LuxVeritasMedia/luxveritas.media`.
2. If the existing deploy service account cannot be identified, have the project owner choose or create a new approved GitHub deploy service account without creating a JSON key.
3. Confirm the chosen service account is allowed to impersonate through the existing Workload Identity provider.
4. Replace the GitHub Actions secret `GCP_SERVICE_ACCOUNT` with the approved service account email.
5. Grant `roles/iam.serviceAccountUser` on `lux-veritas-media@appspot.gserviceaccount.com` to that approved service account.
6. Rerun the manual Functions workflow and `node tools/qa-functions-deploy-readiness.mjs`.

GitHub secret rotation template:

```bash
printf '%s' 'APPROVED_DEPLOY_SERVICE_ACCOUNT_EMAIL' \
  | gh secret set GCP_SERVICE_ACCOUNT --repo LuxVeritasMedia/luxveritas.media
```

This stores only the approved deploy service account email in GitHub. Do not create or upload service-account keys.

## gcloud Command

After explicit project-owner approval, run:

```bash
CLOUDSDK_PYTHON=/Users/frederickparent/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  .codex-tools/google-cloud-sdk/bin/gcloud iam service-accounts add-iam-policy-binding \
  lux-veritas-media@appspot.gserviceaccount.com \
  --project=lux-veritas-media \
  --member="serviceAccount:github-actions-firebase@lux-veritas-media.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

Exact approval language:

```text
I approve granting roles/iam.serviceAccountUser on lux-veritas-media@appspot.gserviceaccount.com to github-actions-firebase@lux-veritas-media.iam.gserviceaccount.com for the LuxVeritasMedia/luxveritas.media manual Firebase Functions deploy workflow.
```

## Verify

After the grant:

```bash
.codex-tools/gh-local/bin/gh workflow run firebase-functions-manual.yml --repo LuxVeritasMedia/luxveritas.media
node tools/qa-functions-deploy-readiness.mjs
```

To export a no-secret repair packet for the Google Cloud administrator:

```bash
node tools/export-functions-iam-repair-request.mjs
LUX_FUNCTIONS_IAM_PACKET_OUT=/tmp/lux-functions-iam-repair-request.md node tools/export-functions-iam-repair-request.mjs
node tools/qa-functions-iam-repair-request.mjs
```

Expected result:

```text
Latest manual Functions deploy completed successfully
Functions deploy readiness checked with 0 deploy blocker(s)
```

Only then mark the Functions deploy IAM TODO complete.
