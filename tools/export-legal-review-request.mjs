import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const format = process.env.LUX_LEGAL_PACKET_FORMAT === "json" ? "json" : "markdown";
const outPath = process.env.LUX_LEGAL_PACKET_OUT || "";
const liveBaseUrl = "https://luxveritas.media";

function secretShape(value) {
  return /re_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}/.test(value);
}

function legalItem(legalReview, id) {
  const item = Array.isArray(legalReview.items)
    ? legalReview.items.find((entry) => entry.id === id)
    : null;
  return {
    id,
    route: item?.route || "",
    liveUrl: item?.route ? `${liveBaseUrl}${item.route}` : "",
    status: item?.status || "missing",
    version: item?.version || "",
    reviewedAt: item?.reviewedAt || "",
    reviewedBy: item?.reviewedBy || "",
    notes: item?.notes || ""
  };
}

function routeProof(html) {
  const title = (html.match(/<title>([^<]+)<\/title>/i)?.[1] || "").trim();
  const description = (html.match(/<meta name="description" content="([^"]+)"/i)?.[1] || "").trim();
  const noPlaceholderLanguage = !/placeholder|template|route-ready|future implementation/i.test(html);
  return { title, description, noPlaceholderLanguage };
}

const [
  legalReviewRaw,
  publicTermsRaw,
  launchRaw,
  closeoutRaw,
  buildRaw,
  privacyHtml,
  termsHtml
] = await Promise.all([
  readFile("data/lux-legal-review.json", "utf8"),
  readFile("data/lux-public-terms.json", "utf8"),
  readFile("data/lux-launch-readiness.json", "utf8"),
  readFile("data/lux-launch-closeout.json", "utf8"),
  readFile("data/lux-build-manifest.json", "utf8"),
  readFile("legal/privacy.html", "utf8"),
  readFile("legal/terms.html", "utf8")
]);

if (secretShape(`${legalReviewRaw}\n${publicTermsRaw}\n${launchRaw}\n${closeoutRaw}\n${buildRaw}`)) {
  console.error("Legal review request input appears to contain secret-shaped data.");
  process.exit(1);
}

const legalReview = JSON.parse(legalReviewRaw);
const publicTerms = JSON.parse(publicTermsRaw);
const launch = JSON.parse(launchRaw);
const closeout = JSON.parse(closeoutRaw);
const build = JSON.parse(buildRaw);
const gates = Array.isArray(launch.gates) ? launch.gates : [];
const blockedGates = gates
  .filter((gate) => gate.requiredForPublicLaunch === true && gate.status === "blocked")
  .map((gate) => ({
    id: gate.id,
    label: gate.label,
    nextAction: gate.nextAction,
    verification: gate.verification
  }));

const packet = {
  schemaVersion: "luxveritas.legal_review_request.v1",
  generatedAt: new Date().toISOString(),
  purpose: "No-secret Privacy and Terms review request. This is not legal approval.",
  project: "LuxVeritas.media",
  liveUrl: liveBaseUrl,
  firebaseProject: "lux-veritas-media",
  githubRepo: "LuxVeritasMedia/luxveritas.media",
  assetVersion: build.assetVersion || build.version || "",
  publicTerms: {
    version: publicTerms.version || "",
    privacyVersion: publicTerms.privacyVersion || "",
    termsVersion: publicTerms.termsVersion || "",
    submissionTermsVersion: publicTerms.submissionTermsVersion || "",
    notice: publicTerms.notice || ""
  },
  legal: {
    privacy: {
      ...legalItem(legalReview, "privacy"),
      page: routeProof(privacyHtml)
    },
    terms: {
      ...legalItem(legalReview, "terms"),
      page: routeProof(termsHtml)
    }
  },
  blockedLaunchGates: blockedGates,
  reviewerChecklist: [
    "Confirm public forms, portal access requests, submissions, membership interest, events, press, contact, investor, and partner inquiry practices are accurately described.",
    "Confirm email/SMS consent, analytics, CTA reporting, media-player events, operator reporting, and opt-out language match actual practices.",
    "Confirm submissions, user content, creator participation, licensing, membership, event, purchase, refund, and cancellation language match what is live or intentionally not live.",
    "Confirm storage, retention, deletion, service-provider, legal-compliance, and contact paths are acceptable for launch.",
    "Confirm no paid commerce, ticketing, creator payment, or regulated activity launches without matching reviewed terms."
  ],
  approvalCommands: [
    "LUX_LEGAL_SYNC_LAUNCH=1 LUX_LEGAL_EVIDENCE=\"Legal review packet YYYY-MM-DD\" LUX_LEGAL_REVIEW_ITEM=privacy LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY=\"Reviewer Name\" node tools/set-legal-review-status.mjs",
    "LUX_LEGAL_SYNC_LAUNCH=1 LUX_LEGAL_EVIDENCE=\"Legal review packet YYYY-MM-DD\" LUX_LEGAL_REVIEW_ITEM=terms LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY=\"Reviewer Name\" node tools/set-legal-review-status.mjs",
    "node tools/build-static.mjs",
    "node tools/prepare-hosting.mjs",
    "node tools/qa-release-readiness.mjs"
  ],
  acceptance: [
    "data/lux-legal-review.json shows Privacy and Terms as approved with reviewedAt and reviewedBy.",
    "node tools/qa-release-readiness.mjs no longer reports Privacy or Terms blockers.",
    "Legal pages do not say placeholder, template, route-ready, or future implementation.",
    "Any paid membership, ticketing, store, or creator-payment launch has matching reviewed terms before going live."
  ],
  closeoutStatus: {
    updatedAt: closeout.updatedAt || "",
    items: Array.isArray(closeout.items)
      ? closeout.items.map((item) => ({
        id: item.id,
        label: item.label,
        status: item.status,
        owner: item.owner
      }))
      : []
  }
};

let rendered = "";
if (format === "json") {
  rendered = `${JSON.stringify(packet, null, 2)}\n`;
} else {
  const legalRows = [packet.legal.privacy, packet.legal.terms]
    .map((item) => `- ${item.id}: ${item.status} (${item.version}) - ${item.liveUrl}`)
    .join("\n");
  const blockers = packet.blockedLaunchGates.length
    ? packet.blockedLaunchGates.map((gate) => `- ${gate.label}: ${gate.nextAction}`).join("\n")
    : "- None";

  rendered = `# Lux Veritas Legal Review Request

Generated: ${packet.generatedAt}

Purpose: ${packet.purpose}

Project: ${packet.project}
Live URL: ${packet.liveUrl}
Asset version: ${packet.assetVersion}
Public terms bundle: ${packet.publicTerms.version}

## Review Routes

${legalRows}

## Page Proof

- Privacy title: ${packet.legal.privacy.page.title || "missing"}
- Privacy description: ${packet.legal.privacy.page.description || "missing"}
- Privacy placeholder language absent: ${packet.legal.privacy.page.noPlaceholderLanguage ? "yes" : "no"}
- Terms title: ${packet.legal.terms.page.title || "missing"}
- Terms description: ${packet.legal.terms.page.description || "missing"}
- Terms placeholder language absent: ${packet.legal.terms.page.noPlaceholderLanguage ? "yes" : "no"}

## Current Launch Blockers

${blockers}

## Reviewer Checklist

${packet.reviewerChecklist.map((item) => `- ${item}`).join("\n")}

## Approval Commands

\`\`\`bash
${packet.approvalCommands.join("\n")}
\`\`\`

## Acceptance

${packet.acceptance.map((item) => `- ${item}`).join("\n")}
`;
}

if (secretShape(rendered)) {
  console.error("Legal review request output appears to contain secret-shaped data.");
  process.exit(1);
}

if (outPath) {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, rendered);
}

process.stdout.write(rendered);
