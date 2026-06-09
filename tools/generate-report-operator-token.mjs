import crypto from "node:crypto";

const token = process.env.LUX_REPORT_TOKEN || "";
const generated = process.env.LUX_GENERATE_REPORT_TOKEN === "1"
  ? crypto.randomBytes(32).toString("base64url")
  : "";
const value = token || generated;

if (!value) {
  console.error("Set LUX_REPORT_TOKEN to a private operator token, then run:");
  console.error("  LUX_REPORT_TOKEN='paste-private-token' node tools/generate-report-operator-token.mjs");
  console.error("");
  console.error("Or generate a one-time token for manual vault storage:");
  console.error("  LUX_GENERATE_REPORT_TOKEN=1 LUX_PRINT_OPERATOR_TOKEN=1 node tools/generate-report-operator-token.mjs");
  process.exit(1);
}

const hash = crypto.createHash("sha256").update(value).digest("hex");
const email = process.env.LUX_REPORT_OPERATOR_EMAIL || "operator@luxveritas.media";

if (generated && process.env.LUX_PRINT_OPERATOR_TOKEN === "1") {
  console.log(`Private operator token: ${generated}`);
  console.log("Store this raw token in the private operator password manager. Do not commit it.");
} else if (generated) {
  console.error("Generated token was not printed. Re-run with LUX_PRINT_OPERATOR_TOKEN=1 if you need a one-time token to store.");
  process.exit(1);
}

console.log(`REPORT_OPERATOR_TOKEN_SHA256=${hash}`);
console.log("");
console.log("Cloud Run setup command:");
console.log(`gcloud run services update reportactivity --region us-central1 --project lux-veritas-media --set-env-vars REPORT_OPERATOR_TOKEN_SHA256=${hash},REPORT_OPERATOR_EMAIL=${email}`);
