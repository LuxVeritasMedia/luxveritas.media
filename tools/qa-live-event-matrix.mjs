import { execFile } from "node:child_process";
import { promisify } from "node:util";

const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const writeEnabled = process.env.LUX_EVENT_MATRIX_WRITE === "1";
const strictLiveQa = process.env.LUX_STRICT_LIVE_QA === "1" || writeEnabled;
const issues = [];
const warnings = [];
const execFileAsync = promisify(execFile);

const matrix = [
  {
    event: "view_content",
    page: "/index.html",
    detail: { surface: "home", title: "Home", cta_id: "home__view_content__page" }
  },
  {
    event: "form_open",
    page: "/membership.html",
    detail: { formType: "fan", surface: "hero", cta_id: "hero__form_open__form_fan" }
  },
  {
    event: "link_click",
    page: "/music.html",
    detail: { destination: "/spmvp.html", surface: "hero", cta_id: "hero__link_click__link_spmvp_html" }
  },
  {
    event: "link_click",
    page: "/index.html",
    detail: {
      destination: "/music.html",
      surface: "fan_flywheel",
      intent: "flywheel_listen",
      label: "Listen Start With Sound",
      cta_id: "fan_flywheel__link_click__flywheel_listen"
    }
  },
  {
    event: "link_click",
    page: "/index.html",
    detail: {
      destination: "/music.html",
      surface: "brand_house",
      intent: "house_lvr",
      label: "Lux Veritas Records",
      cta_id: "brand_house__link_click__house_lvr"
    }
  },
  {
    event: "media_action",
    page: "/spmvp.html",
    detail: {
      action: "play",
      media_id: "spmvp-release",
      source_type: "audio",
      source_status: "ready",
      source_ready: true,
      reporting_key: "spmvp_release_audio"
    }
  },
  {
    event: "media_playback",
    page: "/music.html",
    detail: {
      action: "milestone",
      media_id: "spmvp-release",
      title: "SPMVP",
      kind: "release",
      source_type: "audio",
      source_status: "ready",
      source_ready: true,
      reporting_key: "spmvp_release_audio",
      milestone: "25%",
      current_time: 30,
      duration: 100,
      progress_percent: 30
    }
  },
  {
    event: "fan_reaction",
    page: "/music.html",
    detail: {
      reaction: "collect",
      reaction_label: "Collect",
      media_id: "spmvp-release",
      title: "SPMVP",
      source_type: "audio",
      source_status: "ready",
      source_ready: true,
      reporting_key: "spmvp_release_audio",
      cta_id: "music__fan_reaction__collect"
    }
  },
  {
    event: "lead_accepted",
    page: "/submissions.html",
    detail: { formType: "submission", delivery: "stored", surface: "form_dialog" }
  },
  {
    event: "lead_rejected",
    page: "/contact.html",
    detail: { formType: "press", reason: "validation_failed", surface: "form_dialog" }
  },
  {
    event: "report_action",
    page: "/portal/reporting.html",
    detail: { action: "load-private", surface: "operator_report", cta_id: "operator_report__report_action__load_private" }
  }
];
const expectedEvents = [
  "view_content",
  "form_open",
  "link_click",
  "media_action",
  "media_playback",
  "fan_reaction",
  "lead_accepted",
  "lead_rejected",
  "report_action"
];

function stamp() {
  return new Date().toISOString();
}

function compactStamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

const qaRunId = (process.env.LUX_QA_RUN_ID || compactStamp())
  .replace(/[^A-Za-z0-9_-]+/g, "")
  .slice(0, 48) || compactStamp();

async function curlJson(path, payload) {
  const marker = "__HTTP_STATUS__:";
  const { stdout } = await execFileAsync("curl", [
    "-sS",
    "-m",
    "15",
    "-X",
    "POST",
    "-H",
    "Content-Type: application/json",
    "-H",
    "Accept: application/json",
    "--data",
    JSON.stringify(payload),
    "-w",
    `\n${marker}%{http_code}`,
    `${baseUrl}${path}`
  ], {
    maxBuffer: 1024 * 1024
  });
  const markerIndex = stdout.lastIndexOf(marker);
  if (markerIndex === -1) throw new Error("curl response missing status marker");
  const text = stdout.slice(0, markerIndex).trim();
  const status = Number(stdout.slice(markerIndex + marker.length).trim());
  return {
    response: {
      ok: status >= 200 && status < 300,
      status
    },
    json: text ? JSON.parse(text) : {}
  };
}

async function postJson(path, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await response.text();
    return { response, json: text ? JSON.parse(text) : {} };
  } catch (error) {
    if (error?.message === "fetch failed" || error?.name === "TypeError") {
      return curlJson(path, payload);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function validationCheck() {
  const { response, json } = await postJson("/api/event", { event: "view_content", page: "/qa-event-matrix", consent: "rejected" });
  if (response.status !== 400 && response.status !== 429) {
    issues.push(`validation check expected HTTP 400 or 429, received ${response.status}`);
  }
  if (response.status === 400 && json.error !== "validation_failed") {
    issues.push(`validation check returned unexpected error: ${json.error || "none"}`);
  }
}

async function writeCheck(item, index) {
  const payload = {
    event: item.event,
    page: item.page,
    consent: "accepted",
    timestamp: stamp(),
    detail: {
      ...item.detail,
      qa_id: `LV-EVENT-MATRIX-${qaRunId}-${String(index + 1).padStart(2, "0")}`
    }
  };
  const { response, json } = await postJson("/api/event", payload);
  if (!response.ok && response.status !== 202) {
    issues.push(`${item.event} on ${item.page}: expected accepted response, received HTTP ${response.status}`);
    return;
  }
  if (!json.ok || !json.id) {
    issues.push(`${item.event} on ${item.page}: response did not return ok:true with an id`);
  }
  if (json.delivery !== "stored" || json.stored !== true) {
    issues.push(`${item.event} on ${item.page}: expected stored event reporting, received ${json.delivery || "unknown"}`);
  } else {
    console.log(`${item.event} on ${item.page}: stored ${json.id}.`);
  }
}

function matrixCoverageCheck() {
  const events = new Set(matrix.map((item) => item.event));
  const missing = expectedEvents.filter((event) => !events.has(event));
  if (missing.length) {
    issues.push(`live event matrix missing event path(s): ${missing.join(", ")}`);
  }
  if (matrix.length > 20) {
    issues.push(`live event matrix has ${matrix.length} write checks; keep total comfortably under the event rate limit of 40.`);
  }
}

matrixCoverageCheck();

try {
  await validationCheck();
} catch (error) {
  const message = `validation check failed: ${error.message}`;
  if (strictLiveQa) issues.push(message);
  else warnings.push(`${message}. Live network check skipped in non-strict mode.`);
}

if (writeEnabled) {
  for (const [index, item] of matrix.entries()) {
    await writeCheck(item, index);
  }
} else {
  warnings.push("Skipped live event matrix writes. Set LUX_EVENT_MATRIX_WRITE=1 to create one QA event per reporting path.");
}

if (warnings.length) {
  console.warn("Live event matrix QA warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (issues.length) {
  console.error(`Live event matrix QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Live event matrix QA passed for ${baseUrl}.`);
