import { normalizeTerritoryTerm } from "./territories";

export type GeocoderResult = { displayName: string; latitude: number; longitude: number };
export type GeocoderConfig = { endpoint: string | null; minIntervalMs: number; cacheTtlMs: number; timeoutMs: number };
export type AddressTerritory = { districtNumber: number; regionId: string; terms: string[]; reviewRequired: boolean };

const cache = new Map<string, { expiresAt: number; results: GeocoderResult[] }>();
let lastRequestAt = 0;

export async function geocodeAddress(query: string, config: GeocoderConfig, signal?: AbortSignal): Promise<GeocoderResult[]> {
  const normalized = normalizeTerritoryTerm(query);
  if (normalized.length < 5) throw new Error("input_too_short");
  if (!config.endpoint) throw new Error("provider_disabled");
  const cached = cache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.results;
  const waitMs = Math.max(0, config.minIntervalMs - (Date.now() - lastRequestAt));
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), config.timeoutMs);
  const abort = () => controller.abort("cancelled");
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const url = new URL(config.endpoint);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "3");
    url.searchParams.set("countrycodes", "ru");
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    const payload = await response.json() as Array<{ display_name?: string; lat?: string; lon?: string }>;
    const results = payload.flatMap((item) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      return item.display_name && Number.isFinite(latitude) && Number.isFinite(longitude) ? [{ displayName: item.display_name, latitude, longitude }] : [];
    });
    cache.set(normalized, { expiresAt: Date.now() + config.cacheTtlMs, results });
    return results;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

function searchableStems(value: string) {
  const stopwords = new Set(["область", "республика", "край", "город", "округ", "федеральный", "автономный", "одномандатный", "избирательный"]);
  return normalizeTerritoryTerm(value).split(" ").filter((token) => token.length >= 5 && !stopwords.has(token)).map((token) => token.slice(0, 5));
}

export function findTerritoryFallback(query: string, territories: AddressTerritory[]) {
  const normalized = normalizeTerritoryTerm(query);
  const matchedRegionIds = new Set(territories.filter((territory) => {
    const regionName = normalizeTerritoryTerm(territory.terms[1] ?? "");
    return regionName.length >= 5 && normalized.includes(regionName);
  }).map((territory) => territory.regionId));
  const pool = matchedRegionIds.size ? territories.filter((territory) => matchedRegionIds.has(territory.regionId)) : territories;
  return pool.map((territory) => {
    const score = Math.max(...territory.terms.flatMap(searchableStems).map((stem) => normalized.includes(stem) ? stem.length : 0), 0);
    return { ...territory, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.districtNumber - b.districtNumber);
}
