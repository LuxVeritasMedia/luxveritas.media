export const DEFAULT_PILOT_EVIDENCE_MAX_AGE_HOURS = 72;

export function pilotEvidenceMaxAgeHours(env = process.env) {
  const raw = Number(env.LUX_PILOT_WRITE_EVIDENCE_MAX_AGE_HOURS || "");
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PILOT_EVIDENCE_MAX_AGE_HOURS;
}

export function pilotEvidenceFreshness(updatedAt, options = {}) {
  const maxAgeHours = Number.isFinite(options.maxAgeHours) && options.maxAgeHours > 0
    ? options.maxAgeHours
    : pilotEvidenceMaxAgeHours();
  const now = options.now instanceof Date ? options.now : new Date();
  const updatedMs = Date.parse(updatedAt || "");

  if (!Number.isFinite(updatedMs)) {
    return {
      ok: false,
      status: "invalid",
      updatedAt: updatedAt || "",
      ageHours: null,
      maxAgeHours,
      message: "pilot write evidence updatedAt is missing or invalid"
    };
  }

  const ageHoursRaw = (now.getTime() - updatedMs) / 36e5;
  const ageHours = Math.round(ageHoursRaw * 10) / 10;
  const futureSkewHours = -1;
  const ok = ageHoursRaw <= maxAgeHours && ageHoursRaw >= futureSkewHours;

  return {
    ok,
    status: ok ? "fresh" : ageHoursRaw < futureSkewHours ? "future" : "stale",
    updatedAt,
    ageHours,
    maxAgeHours,
    message: ok
      ? `pilot write evidence is fresh (${ageHours}h old, max ${maxAgeHours}h)`
      : ageHoursRaw < futureSkewHours
        ? `pilot write evidence timestamp is in the future (${ageHours}h old)`
        : `pilot write evidence is stale (${ageHours}h old, max ${maxAgeHours}h); rerun LUX_PILOT_WRITE_TESTS=1 node tools/qa-pilot-write-gate.mjs before final release`
  };
}

