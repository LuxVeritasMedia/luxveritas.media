import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const reportTokenKeychainService = "Lux Veritas Report Operator Token";
export const reportTokenKeychainAccount = "info@luxveritas.media";

export async function readKeychainReportToken() {
  if (process.platform !== "darwin") return "";
  try {
    const { stdout } = await execFileAsync("security", [
      "find-generic-password",
      "-s",
      reportTokenKeychainService,
      "-a",
      reportTokenKeychainAccount,
      "-w"
    ], {
      timeout: 5000,
      maxBuffer: 1024 * 16
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

export async function resolveReportOperatorToken() {
  const envToken = process.env.LUX_REPORT_TOKEN || "";
  if (envToken) return { token: envToken, source: "environment" };
  const keychainToken = await readKeychainReportToken();
  if (keychainToken) return { token: keychainToken, source: "macOS Keychain" };
  return { token: "", source: "missing" };
}
