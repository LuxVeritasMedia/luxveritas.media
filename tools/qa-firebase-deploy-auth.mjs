import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { googleAccessToken } from "./lib/google-cloud-auth.mjs";

const execFileAsync = promisify(execFile);
const firebaseToolsPackage = "firebase-tools@15.22.1";
const project = process.env.LUX_FIREBASE_PROJECT || "lux-veritas-media";
const site = process.env.LUX_FIREBASE_SITE || project;
const ciToken = String(process.env.FIREBASE_CI_TOKEN || "").trim();
const dryRun = process.env.LUX_FIREBASE_DEPLOY_AUTH_DRY_RUN === "1";

function redact(value) {
  const text = String(value || "");
  return ciToken ? text.split(ciToken).join("[redacted FIREBASE_CI_TOKEN]") : text;
}

function compactError(error) {
  const output = [
    error?.message,
    error?.stdout,
    error?.stderr
  ].filter(Boolean).map(redact).join("\n");

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-10)
    .join("\n");
}

function parseJson(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

const mode = ciToken ? "FIREBASE_CI_TOKEN" : "Google Workload Identity / ADC";
console.log(`Firebase deploy auth preflight for ${project} using ${mode}.`);

if (dryRun) {
  console.log("Firebase deploy auth preflight dry-run passed.");
  process.exit(0);
}

const args = [
  firebaseToolsPackage,
  "hosting:sites:list",
  "--project",
  project,
  "--non-interactive",
  "--json"
];

if (ciToken) {
  args.push("--token", ciToken);
}

try {
  await execFileAsync("npx", args, { maxBuffer: 1024 * 1024 });
  console.log(`Firebase deploy auth preflight passed for ${project}.`);
} catch (error) {
  if (!ciToken) {
    try {
      const { token, source } = await googleAccessToken();
      const response = await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${encodeURIComponent(site)}/versions?pageSize=1`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      });
      const text = await response.text();
      if (!response.ok) {
        const json = parseJson(text);
        const detail = json?.error?.message || text || response.statusText;
        throw new Error(`${response.status} ${response.statusText}: ${detail}`);
      }
      console.log(`Firebase deploy auth preflight passed through Hosting REST API using ${source}.`);
      process.exit(0);
    } catch (restError) {
      console.error(`Firebase Hosting REST auth fallback failed for site ${site}.`);
      console.error(compactError(restError));
    }
  }
  console.error(`Firebase deploy auth preflight failed for ${project}.`);
  if (ciToken) {
    console.error("Regenerate the GitHub Actions FIREBASE_CI_TOKEN secret with firebase login:ci from an approved Lux Veritas Firebase account.");
  } else {
    console.error("GitHub secret FIREBASE_CI_TOKEN is not set, and Firebase CLI rejected the Google Workload Identity fallback.");
    console.error("Either grant the GitHub Workload Identity service account Firebase Hosting REST access, or generate a Firebase CLI token with firebase login:ci from info@luxveritas.media and save it as the FIREBASE_CI_TOKEN GitHub Actions secret.");
  }
  const detail = compactError(error);
  if (detail) console.error(detail);
  process.exit(1);
}
