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

export async function providerSecretValue(name, project) {
  try {
    const { stdout } = await runFirebase([
      "functions:secrets:access",
      name,
      "--project",
      project
    ]);
    return {
      ok: true,
      value: stdout.trim()
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || String(error)
    };
  }
}

export function providerSecretValueStatus(name, value) {
  const secret = String(value || "").trim();
  if (!secret) return { ok: false, status: "missing", detail: "empty value" };

  if (name === "RESEND_API_KEY") {
    if (/^re_/i.test(secret)) return { ok: true, status: "active", detail: "Resend key format" };
    if (secret === "not_configured") return { ok: false, status: "offline", detail: "offline sentinel" };
    return { ok: false, status: "invalid", detail: "expected key beginning with re_" };
  }

  if (name === "FORM_INTEGRATION_URL") {
    if (/^https:\/\//i.test(secret)) return { ok: true, status: "active", detail: "HTTPS endpoint" };
    if (secret === "not_configured") return { ok: false, status: "offline", detail: "offline sentinel" };
    return { ok: false, status: "invalid", detail: "expected HTTPS endpoint" };
  }

  if (name === "FORM_INTEGRATION_SIGNING_SECRET") {
    if (secret !== "not_configured") return { ok: true, status: "active", detail: "signing secret set" };
    return { ok: false, status: "offline", detail: "offline sentinel" };
  }

  if (name === "FORM_INTEGRATION_TARGET") {
    if (secret && secret !== "unconfigured" && secret !== "not_configured") {
      return { ok: true, status: "active", detail: `target ${secret}` };
    }
    return { ok: false, status: "offline", detail: "target unconfigured" };
  }

  if (name === "REPORT_OPERATOR_TOKEN_SHA256") {
    if (/^[a-f0-9]{64}$/i.test(secret)) return { ok: true, status: "active", detail: "SHA-256 hash" };
    if (secret === "not_configured") return { ok: false, status: "offline", detail: "offline sentinel" };
    return { ok: false, status: "invalid", detail: "expected SHA-256 hash" };
  }

  return { ok: true, status: "present", detail: "value present" };
}

export async function providerSecretValueStatusEntries(project, secrets = requiredProviderSecrets) {
  const entries = [];
  for (const name of secrets) {
    const secret = await providerSecretValue(name, project);
    entries.push([
      name,
      secret.ok
        ? providerSecretValueStatus(name, secret.value)
        : { ok: false, status: "unavailable", detail: secret.error || "could not access value" }
    ]);
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
