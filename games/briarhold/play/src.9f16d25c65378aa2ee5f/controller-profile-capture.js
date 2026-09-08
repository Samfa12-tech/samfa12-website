export const CONTROLLER_PROFILE_ENDPOINT = "/__briarhold/controller-profile";

export function isBackboneControllerProfile(profile) {
  return /\bbackbone\b/iu.test(String(profile?.controllerId || ""));
}

export function createControllerProfileCapture(profile, {
  capturedAt = new Date(),
  coarsePointer = false,
} = {}) {
  if (!isBackboneControllerProfile(profile)) return null;
  const timestamp = capturedAt instanceof Date ? capturedAt.toISOString() : new Date(capturedAt).toISOString();
  return {
    schemaVersion: 1,
    source: "guided-wizard",
    capturedAt: timestamp,
    client: {coarsePointer: coarsePointer === true},
    profile,
  };
}

export async function submitControllerProfileCapture(payload, fetchImpl = globalThis.fetch) {
  if (!payload || typeof fetchImpl !== "function") return null;
  const response = await fetchImpl(CONTROLLER_PROFILE_ENDPOINT, {
    method: "POST",
    headers: {"Content-Type": "application/json", Accept: "application/json"},
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Controller profile receiver returned ${response.status}`);
  return result;
}
