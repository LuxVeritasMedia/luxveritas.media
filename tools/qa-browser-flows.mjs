import { createServer } from "node:http";
import { access, readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = "dist";
const bundledPlaywrightPath = "/Users/frederickparent/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const issues = [];
const submissions = [];
const events = [];

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const flows = [
  { path: "/index.html", trigger: 'button[data-open-form="request"]', role: "General", inquiry: "Portal" },
  { path: "/submissions.html", trigger: 'button[data-open-form="submission"]', role: "Creator", inquiry: "Submissions" },
  { path: "/membership.html", trigger: 'button[data-open-form="fan"]', role: "Member", inquiry: "Membership" },
  { path: "/community.html", trigger: 'button[data-open-form="fan"]', role: "Member", inquiry: "Membership" },
  { path: "/investor.html", trigger: 'button[data-open-form="investor"]', role: "Investor", inquiry: "Investor" },
  { path: "/events.html", trigger: 'button[data-open-form="request"]', role: "General", inquiry: "Portal" },
  { path: "/contact.html", trigger: 'button[data-open-form="press"]', role: "Press", inquiry: "Press" }
];

function safePath(urlPath) {
  const path = decodeURIComponent(urlPath.split("?")[0] || "/");
  const filePath = path === "/" ? "/index.html" : path;
  const normalized = normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
  return join(root, normalized);
}

async function fileExists(path) {
  try {
    const info = await stat(path);
    return info.isFile();
  } catch {
    return false;
  }
}

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      let filePath = safePath(req.url || "/");
      if (!await fileExists(filePath) && !extname(filePath)) filePath = join(filePath, "index.html");
      if (!await fileExists(filePath)) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      const body = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream"
      });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error.message);
    }
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function loadPlaywright() {
  if (process.env.LUX_PLAYWRIGHT_MODULE) return import(`file://${process.env.LUX_PLAYWRIGHT_MODULE}`);
  try {
    await access(bundledPlaywrightPath);
    return import(`file://${bundledPlaywrightPath}`);
  } catch {
    return import("playwright");
  }
}

async function openFlow(page, baseUrl, flow) {
  const beforeCount = submissions.length;
  await page.goto(`${baseUrl}${flow.path}`, { waitUntil: "domcontentloaded" });
  await page.click(flow.trigger);
  await page.waitForSelector("[data-dialog][open]", { timeout: 5000 });

  const role = await page.locator('select[name="role_path"]').inputValue();
  const inquiry = await page.locator('select[name="inquiry_type"]').inputValue();
  if (role !== flow.role) issues.push(`${flow.path}: expected role path ${flow.role}, found ${role || "blank"}`);
  if (inquiry !== flow.inquiry) issues.push(`${flow.path}: expected inquiry type ${flow.inquiry}, found ${inquiry || "blank"}`);

  await page.fill('input[name="name"]', "Lux Browser QA");
  await page.fill('input[name="email"]', "qa@luxveritas.media");
  await page.fill('textarea[name="message"]', `Browser flow QA for ${flow.path}`);
  await page.check('input[name="consent_email"]');
  await page.click("[data-submit-form]");
  await page.waitForFunction(() => {
    const status = document.querySelector("[data-form-status]");
    return status && !status.hidden && /Received\. Thank you|Sent\. Thank you|Too many attempts|Please check/i.test(status.textContent || "");
  }, null, { timeout: 6000 });

  const statusText = await page.locator("[data-form-status]").innerText();
  if (!/Received\. Thank you\. Your request is recorded with Lux Veritas\./.test(statusText)) {
    issues.push(`${flow.path}: expected stored-submission success, found "${statusText.replace(/\s+/g, " ")}"`);
  }

  await page.waitForFunction(() => {
    const button = document.querySelector("[data-submit-form]");
    return button && !button.disabled && button.textContent.trim().toLowerCase() === "send to lux veritas";
  }, null, { timeout: 3000 }).catch(() => {});
  const buttonText = await page.locator("[data-submit-form]").innerText();
  const buttonDisabled = await page.locator("[data-submit-form]").isDisabled();
  if (buttonDisabled || buttonText.trim().toLowerCase() !== "send to lux veritas") {
    issues.push(`${flow.path}: submit button did not reset after submit (text="${buttonText}", disabled=${buttonDisabled})`);
  }

  const payload = submissions.at(-1);
  if (submissions.length !== beforeCount + 1 || !payload) {
    issues.push(`${flow.path}: mocked submit endpoint did not receive a payload`);
    return;
  }
  for (const field of ["client_submission_id", "name", "email", "role_path", "inquiry_type", "message", "source_page"]) {
    if (!payload[field]) issues.push(`${flow.path}: submitted payload missing ${field}`);
  }
  if (payload.role_path !== flow.role) issues.push(`${flow.path}: payload role_path mismatch`);
  if (payload.inquiry_type !== flow.inquiry) issues.push(`${flow.path}: payload inquiry_type mismatch`);
}

async function mediaFlow(page, baseUrl, path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
  await page.click('[data-media-action="play"]');
  await page.waitForSelector("[data-media-followup]:not([hidden])", { timeout: 5000 });
  const followupText = await page.locator("[data-media-followup]").innerText();
  if (!/Join for access|source opens|first access/i.test(followupText)) {
    issues.push(`${path}: media follow-up did not show conversion copy`);
  }
  await page.click("[data-media-followup-action]");
  await page.waitForSelector("[data-dialog][open]", { timeout: 5000 });
  const role = await page.locator('select[name="role_path"]').inputValue();
  const inquiry = await page.locator('select[name="inquiry_type"]').inputValue();
  if (role !== "Member" || inquiry !== "Membership") {
    issues.push(`${path}: media follow-up did not open membership defaults`);
  }
}

const { server, baseUrl } = await startServer();
let browser;

try {
  const { chromium } = await loadPlaywright();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.route("**/api/submit", async (route) => {
    const payload = JSON.parse(route.request().postData() || "{}");
    submissions.push(payload);
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        delivery: "stored",
        reason: "qa_mock",
        id: payload.client_submission_id || "LV-BROWSER-QA",
        stored: true
      })
    });
  });

  await page.route("**/api/event", async (route) => {
    const payload = JSON.parse(route.request().postData() || "{}");
    events.push(payload);
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, delivery: "stored", id: "LV-EVENT-QA", stored: true })
    });
  });

  for (const flow of flows) {
    await openFlow(page, baseUrl, flow);
  }
  for (const path of ["/music.html", "/spmvp.html"]) {
    await mediaFlow(page, baseUrl, path);
  }
} catch (error) {
  issues.push(`browser flow failed: ${error.message}`);
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

if (issues.length) {
  console.error(`Browser flow QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Browser flow QA passed for ${flows.length} form flows and 2 media flows.`);
