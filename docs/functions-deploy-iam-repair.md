# Firebase Functions Deploy IAM Repair

Status date: 2026-06-22

This packet documents the no-secret repair path for the remaining GitHub manual Functions deployment blocker.

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
https://github.com/LuxVeritasMedia/luxveritas.media/actions/runs/27887395119
```

## Required Grant

Grant the GitHub deploy service account this role:

```text
Project: lux-veritas-media
Target service account: lux-veritas-media@appspot.gserviceaccount.com
Principal: the service account email stored in GitHub Actions secret GCP_SERVICE_ACCOUNT
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
3. Principal: paste the service-account email stored in GitHub Actions secret `GCP_SERVICE_ACCOUNT`.
4. Role: `Service Account User`.
5. Save.

If the `GCP_SERVICE_ACCOUNT` value is not known, find the deploy service account in Google Cloud IAM by looking for the service account connected to the GitHub Workload Identity provider for `LuxVeritasMedia/luxveritas.media`. GitHub secret values cannot be read back after creation, so the value must come from the original setup notes, Google Cloud IAM, or by replacing the GitHub secret with a newly approved deploy service account.

## gcloud Command

If Google Cloud SDK is available and authenticated as a project owner:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  lux-veritas-media@appspot.gserviceaccount.com \
  --project=lux-veritas-media \
  --member="serviceAccount:PASTE_GCP_SERVICE_ACCOUNT_VALUE_HERE" \
  --role="roles/iam.serviceAccountUser"
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
