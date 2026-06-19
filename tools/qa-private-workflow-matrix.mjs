import { readFile } from "node:fs/promises";

const issues = [];
const matrixRaw = await readFile("docs/private-workflow-matrix.json", "utf8");
const profilesRaw = await readFile("docs/private-integration-profiles.json", "utf8");
const fieldMapRaw = await readFile("docs/private-integration-field-map.json", "utf8");
const functionsRaw = await readFile("functions/index.js", "utf8");

const matrix = JSON.parse(matrixRaw);
const registry = JSON.parse(profilesRaw);
const fieldMap = JSON.parse(fieldMapRaw);
const queues = Array.isArray(matrix.queues) ? matrix.queues : [];
const profileIds = new Set((registry.profiles || []).map((profile) => profile.id));
const mappedProfileIds = new Set((fieldMap.profiles || []).map((profile) => profile.id));

const requiredQueues = {
  membership_waitlist: {
    label: "Membership Waitlist",
    priority: "standard",
    sla: "3 business days",
    inquiryKeys: ["membership"]
  },
  submission_review: {
    label: "Submission Review",
    priority: "high",
    sla: "5 business days",
    inquiryKeys: ["submissions"]
  },
  event_access: {
    label: "Event Access",
    priority: "standard",
    sla: "3 business days",
    inquiryKeys: ["events", "event_guest"]
  },
  press_contact: {
    label: "Press Contact",
    priority: "standard",
    sla: "2 business days",
    inquiryKeys: ["press"]
  },
  partner_licensing: {
    label: "Partner / Licensing",
    priority: "high",
    sla: "3 business days",
    inquiryKeys: ["partnership", "licensing", "partner"]
  },
  strategic_access: {
    label: "Strategic Access",
    priority: "high",
    sla: "2 business days",
    inquiryKeys: ["investor"]
  },
  access_review: {
    label: "Access Review",
    priority: "standard",
    sla: "3 business days",
    inquiryKeys: ["portal", "general"]
  }
};

function issue(message) {
  issues.push(message);
}

function hasAll(values, expected, label) {
  for (const value of expected) {
    if (!values.includes(value)) issue(`${label} missing ${value}`);
  }
}

if (matrix.schemaVersion !== "luxveritas.private_workflow_matrix.v1") {
  issue("workflow matrix schemaVersion mismatch");
}
if (matrix.contract !== "luxveritas.form_submission.v1") {
  issue("workflow matrix contract mismatch");
}
if (matrix.eventType !== "form.submission.received") {
  issue("workflow matrix eventType mismatch");
}
if (matrix.currentPrimaryProfile !== "firebase_handoff") {
  issue("workflow matrix currentPrimaryProfile must remain firebase_handoff for MVP");
}
if (matrix.publicExposure !== "none") {
  issue("workflow matrix publicExposure must be none");
}
if (!matrix.purpose || !/must not contain provider URLs/i.test(matrix.purpose)) {
  issue("workflow matrix purpose must state no provider URLs");
}
if (!matrix.activationRule || !/Firebase Secret Manager/i.test(matrix.activationRule)) {
  issue("workflow matrix activationRule must require Firebase Secret Manager");
}

const queuesById = new Map(queues.map((queue) => [queue.id, queue]));
for (const [id, expected] of Object.entries(requiredQueues)) {
  const queue = queuesById.get(id);
  if (!queue) {
    issue(`workflow matrix missing queue ${id}`);
    continue;
  }
  if (queue.label !== expected.label) issue(`${id}: label mismatch`);
  if (queue.priority !== expected.priority) issue(`${id}: priority mismatch`);
  if (queue.sla !== expected.sla) issue(`${id}: sla mismatch`);
  if (queue.currentProfile !== "firebase_handoff") issue(`${id}: currentProfile must be firebase_handoff`);
  if (!queue.owner) issue(`${id}: missing owner`);
  if (!Array.isArray(queue.inquiryKeys)) issue(`${id}: inquiryKeys must be an array`);
  else hasAll(queue.inquiryKeys, expected.inquiryKeys, `${id}.inquiryKeys`);
  if (!Array.isArray(queue.roleTargets) || queue.roleTargets.length < 1) {
    issue(`${id}: roleTargets must include at least one target`);
  }
  if (!Array.isArray(queue.approvedNextProfiles) || queue.approvedNextProfiles.length < 1) {
    issue(`${id}: approvedNextProfiles must include at least one future target`);
  }
  for (const profileId of [queue.currentProfile, ...(queue.approvedNextProfiles || [])]) {
    if (!profileIds.has(profileId)) issue(`${id}: profile ${profileId} is missing from registry`);
    if (!mappedProfileIds.has(profileId)) issue(`${id}: profile ${profileId} is missing from field map`);
  }
  if (!Array.isArray(queue.actions) || queue.actions.length < 3) {
    issue(`${id}: actions must include at least three workflow actions`);
  }
  if (!Array.isArray(queue.acceptance) || queue.acceptance.length < 3) {
    issue(`${id}: acceptance must include at least three checks`);
  }
}

if (queues.length !== Object.keys(requiredQueues).length) {
  issue(`workflow matrix expected ${Object.keys(requiredQueues).length} queues, found ${queues.length}`);
}

for (const [id, expected] of Object.entries(requiredQueues)) {
  if (!functionsRaw.includes(`routing_queue: "${id}"`)) {
    issue(`functions/index.js routing map missing queue ${id}`);
  }
  if (!functionsRaw.includes(`routing_label: "${expected.label}"`)) {
    issue(`functions/index.js routing map missing label ${expected.label}`);
  }
}

if (/https?:\/\//i.test(matrixRaw)) {
  issue("workflow matrix must not contain URLs");
}
if (/webhook|api[_ -]?key|bearer|password|token\s*[:=]|secret\s*[:=]|account[_ -]?id|endpoint path/i.test(matrixRaw)) {
  issue("workflow matrix appears to contain provider credential or endpoint language");
}

if (issues.length) {
  console.error(`Private workflow matrix QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Private workflow matrix QA passed for ${queues.length} routing queue(s).`);
