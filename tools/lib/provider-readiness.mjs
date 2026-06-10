import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const requiredProviderSecrets = [
  "RESEND_API_KEY",
  "FORM_INTEGRATION_URL",
  "FORM_INTEGRATION_SIGNING_SECRET",
  "FORM_INTEGRATION_TARGET",
  "REPORT_OPERATOR_TOKEN_SHA256"
];

async function runFirebase(args) {
  try {
    return await execFileAsync("firebase", args, { maxBuffer: 1024 * 1024 });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  return execFileAsync("npx", ["firebase-tools@latest", ...args], { maxBuffer: 1024 * 1024 });
}

export async function providerSecretMetadata(name, project) {
  try {
    const { stdout } = await runFirebase([
      "functions:secrets:get",
      name,
      "--project",
      project,
      "--json"
    ], { maxBuffer: 1024 * 1024 });
    const body = JSON.parse(stdout);
    const item = body.result?.secrets?.[0];
    return {
      ok: body.status === "success" && item?.state === "ENABLED",
      versionId: item?.versionId || "",
      createTime: item?.createTime || "",
      state: item?.state || "missing"
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || String(error)
    };
  }
}

export async function providerSecretMetadataEntries(project, secrets = requiredProviderSecrets) {
  const entries = [];
  for (const name of secrets) {
    entries.push([name, await providerSecretMetadata(name, project)]);
  }
  return entries;
}

export async function liveProviderDeliveryReadiness({ baseUrl, reportToken }) {
  if (!reportToken) {
    return {
      delivery: null,
      warning: "Set LUX_REPORT_TOKEN to check live provider readiness from /api/report."
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/report`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${reportToken}`
      },
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.ok) {
      return {
        delivery: null,
        error: `/api/report readiness check failed with HTTP ${response.status} (${body.error || "unknown"}).`
      };
    }
    return {
      delivery: body.delivery || {}
    };
  } catch (error) {
    return {
      delivery: null,
      error: `/api/report readiness check failed (${error?.message || String(error)}).`
    };
  } finally {
    clearTimeout(timeout);
  }
}
