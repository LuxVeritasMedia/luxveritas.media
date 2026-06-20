import { readFile, readdir } from "node:fs/promises";
import { join, normalize, relative } from "node:path";

export const actionInventoryVersion = "2026-06-20-action-inventory";
export const actionInventoryHtmlFiles = [
  "about.html",
  "auth/signin.html",
  "brands/index.html",
  "brands/sample.html",
  "codex-inner.html",
  "codex-sanctum.html",
  "codex.html",
  "community.html",
  "contact.html",
  "events.html",
  "events/codex-salon.html",
  "events/destination-week.html",
  "events/listening-room.html",
  "film.html",
  "index.html",
  "insights.html",
  "investor.html",
  "join.html",
  "ledger.html",
  "legal/privacy.html",
  "legal/terms.html",
  "membership.html",
  "music.html",
  "offline.html",
  "portal/admin.html",
  "portal/admin/users.html",
  "portal/index.html",
  "portal/library.html",
  "portal/releases.html",
  "portal/reporting.html",
  "press.html",
  "private-steward.html",
  "spmvp.html",
  "store.html",
  "submissions.html",
  "works/index.html",
  "works/sample.html"
];

export async function walkHtmlFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.name === "dist" || entry.name === "node_modules" || entry.name === ".git") continue;
    if (entry.isDirectory()) {
      files.push(...await walkHtmlFiles(path));
    } else if (entry.name.endsWith(".html")) {
      files.push(path);
    }
  }
  return files;
}

export function attrValue(attrs, name) {
  const match = attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] || "";
}

export function stripTags(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function slug(value, fallback = "action") {
  const clean = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return clean || fallback;
}

function actionFromButton(attrs, label) {
  const actionAttributes = [
    ["data-open-form", "form_open", "Opens screened capture form", "form_open"],
    ["data-media-action", "media_action", "Activates Lux Player source", "media_action"],
    ["data-fan-reaction", "fan_reaction", "Records fan media reaction", "fan_reaction"],
    ["data-media-item", "media_select", "Selects media queue item", "media_select"],
    ["data-fan-signal-export", "fan_signal_export", "Exports local signal pass", "local_export"],
    ["data-portal-signin", "portal_signin", "Submits screened portal access capture", "portal_signin_capture"],
    ["data-report-action", "operator_report_action", "Runs approved operator report action", "report_action"],
    ["data-submit-form", "form_submit", "Submits current capture form", "lead_accepted"],
    ["data-close-dialog", "dialog_close", "Closes capture dialog", "dialog_close"],
    ["data-nav-toggle", "navigation_toggle", "Opens or closes mobile navigation", "navigation_toggle"],
    ["data-consent", "consent_update", "Updates analytics consent", "consent_update"],
    ["data-track", "tracked_button", "Reports tracked button interaction", "interaction"]
  ];
  const type = attrValue(attrs, "type").toLowerCase();
  for (const [attr, actionType, expectedOutcome, reportingEvent] of actionAttributes) {
    if (!attrs.includes(attr)) continue;
    const value = attrValue(attrs, attr) || label || actionType;
    return {
      actionType,
      actionValue: value,
      expectedOutcome,
      reportingEvent
    };
  }
  if (type === "submit") {
    return {
      actionType: "form_submit",
      actionValue: label || "submit",
      expectedOutcome: "Submits current capture form",
      reportingEvent: "lead_accepted"
    };
  }
  return null;
}

function actionFromLink(attrs, label) {
  const href = attrValue(attrs, "href");
  if (!href || href === "#") return null;
  return {
    actionType: "link_click",
    actionValue: href,
    expectedOutcome: /^https?:\/\//i.test(href) ? "Opens external destination" : "Navigates to public or screened route",
    reportingEvent: "link_click"
  };
}

function recordFor({ route, index, element, attrs, label, action }) {
  const href = attrValue(attrs, "href");
  const formType = attrValue(attrs, "data-open-form");
  const mediaAction = attrValue(attrs, "data-media-action");
  const reportAction = attrValue(attrs, "data-report-action");
  const surface = attrValue(attrs, "data-track-surface");
  const intent = attrValue(attrs, "data-track-intent");
  const ctaLabel = attrValue(attrs, "data-track-label");
  const actionValue = action.actionValue || href || formType || mediaAction || reportAction || label;
  const id = `${route.replace(/[^a-z0-9]+/gi, "_")}__${index}__${action.actionType}__${slug(actionValue || label)}`;
  return {
    id,
    route,
    element,
    label: ctaLabel || label || actionValue,
    actionType: action.actionType,
    actionValue,
    target: href || "",
    formType,
    mediaAction,
    reportAction,
    surface,
    intent,
    reportingEvent: action.reportingEvent,
    expectedOutcome: action.expectedOutcome
  };
}

export async function extractActionInventory(root = ".", files = actionInventoryHtmlFiles) {
  const actions = [];

  for (const file of files) {
    const fullPath = join(root, file);
    const route = normalize(relative(root, fullPath));
    const html = await readFile(fullPath, "utf8");
    let index = 0;

    for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
      const attrs = match[1];
      const label = stripTags(match[2]) || attrValue(attrs, "aria-label") || "(button)";
      const action = actionFromButton(attrs, label);
      if (!action) continue;
      actions.push(recordFor({ route, index, element: "button", attrs, label, action }));
      index += 1;
    }

    for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const attrs = match[1];
      const label = stripTags(match[2]) || attrValue(attrs, "aria-label") || attrValue(attrs, "href") || "(link)";
      const action = actionFromLink(attrs, label);
      if (!action) continue;
      actions.push(recordFor({ route, index, element: "a", attrs, label, action }));
      index += 1;
    }
  }

  actions.push(
    {
      id: "app_js__dynamic__consent_update__accepted",
      route: "app.js",
      element: "button",
      label: "Accept all",
      actionType: "consent_update",
      actionValue: "accepted",
      target: "",
      formType: "",
      mediaAction: "",
      reportAction: "",
      surface: "consent_banner",
      intent: "accept_optional_analytics",
      reportingEvent: "consent_update",
      expectedOutcome: "Accepts optional analytics and enables consented reporting"
    },
    {
      id: "app_js__dynamic__consent_update__rejected",
      route: "app.js",
      element: "button",
      label: "Reject non-essential",
      actionType: "consent_update",
      actionValue: "rejected",
      target: "",
      formType: "",
      mediaAction: "",
      reportAction: "",
      surface: "consent_banner",
      intent: "reject_optional_analytics",
      reportingEvent: "consent_update",
      expectedOutcome: "Rejects optional analytics while preserving essential site function"
    }
  );

  return actions;
}

export function summarizeActions(actions) {
  const byType = {};
  const byRoute = {};
  const byReportingEvent = {};
  for (const action of actions) {
    byType[action.actionType] = (byType[action.actionType] || 0) + 1;
    byRoute[action.route] = (byRoute[action.route] || 0) + 1;
    byReportingEvent[action.reportingEvent] = (byReportingEvent[action.reportingEvent] || 0) + 1;
  }
  return { byType, byRoute, byReportingEvent };
}
