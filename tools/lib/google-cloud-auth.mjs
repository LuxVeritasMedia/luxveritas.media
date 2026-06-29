import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

const defaultScopes = [
  "https://www.googleapis.com/auth/firebase.hosting",
  "https://www.googleapis.com/auth/cloud-platform"
];

function formBody(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) params.set(key, value.join(" "));
    else if (value != null) params.set(key, String(value));
  }
  return params;
}

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function postJson(url, body, { token } = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const detail = json?.error?.message || json?.error_description || text || response.statusText;
    throw new Error(`${response.status} ${response.statusText}: ${detail}`);
  }
  return json;
}

async function postForm(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const detail = json?.error_description || json?.error || text || response.statusText;
    throw new Error(`${response.status} ${response.statusText}: ${detail}`);
  }
  return json;
}

async function serviceAccountAccessToken(credentials, scopes) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: credentials.client_email,
    scope: scopes.join(" "),
    aud: credentials.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(credentials.private_key);
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const body = formBody({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });
  const tokenResponse = await postForm(credentials.token_uri || "https://oauth2.googleapis.com/token", body);
  return {
    token: tokenResponse.access_token,
    source: `service account ${credentials.client_email || "credential file"}`
  };
}

async function subjectToken(credentials) {
  const source = credentials.credential_source || {};
  if (source.file) return (await readFile(source.file, "utf8")).trim();
  if (source.url) {
    const headers = Object.fromEntries(
      Object.entries(source.headers || {}).map(([key, value]) => [key, String(value)])
    );
    const response = await fetch(source.url, { headers });
    const text = await response.text();
    if (!response.ok) throw new Error(`subject token fetch failed: ${response.status} ${text}`);
    if (source.format?.type === "json" && source.format?.subject_token_field_name) {
      return JSON.parse(text)[source.format.subject_token_field_name];
    }
    return text.trim();
  }
  throw new Error("external_account credential_source must include file or url");
}

async function externalAccountAccessToken(credentials, scopes) {
  const stsResponse = await postForm(credentials.token_url || "https://sts.googleapis.com/v1/token", formBody({
    audience: credentials.audience,
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
    scope: scopes,
    subject_token_type: credentials.subject_token_type,
    subject_token: await subjectToken(credentials)
  }));

  if (!credentials.service_account_impersonation_url) {
    return {
      token: stsResponse.access_token,
      source: "Google external account"
    };
  }

  const impersonated = await postJson(credentials.service_account_impersonation_url, {
    scope: scopes,
    lifetime: "3600s"
  }, { token: stsResponse.access_token });

  return {
    token: impersonated.accessToken,
    source: "Google Workload Identity service account impersonation"
  };
}

export async function googleAccessToken({ scopes = defaultScopes } = {}) {
  const explicit = String(process.env.LUX_GOOGLE_ACCESS_TOKEN || process.env.GOOGLE_OAUTH_ACCESS_TOKEN || "").trim();
  if (explicit) return { token: explicit, source: "environment access token" };

  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE;
  if (!credentialPath) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS or CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE is required for Google ADC auth.");
  }

  const credentials = JSON.parse(await readFile(credentialPath, "utf8"));
  if (credentials.type === "external_account") return externalAccountAccessToken(credentials, scopes);
  if (credentials.type === "service_account") return serviceAccountAccessToken(credentials, scopes);

  throw new Error(`Unsupported Google credential type: ${credentials.type || "missing"}`);
}

