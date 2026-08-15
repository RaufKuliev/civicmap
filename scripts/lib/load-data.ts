import fs from "node:fs";
import path from "node:path";
import {
  candidateInputSchema,
  districtSchema,
  electionSchema,
  newsSchema,
  partySchema,
  regionSchema,
  resourceSchema,
  type RegionShard,
} from "../../src/lib/schemas";

export const projectRoot = process.cwd();
export const dataRoot = path.join(projectRoot, "data");

export function readJson(relativePath: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(dataRoot, relativePath), "utf8"));
}

export function loadAllData() {
  const election = electionSchema.parse(readJson("election.json"));
  const regions = regionSchema.array().parse(readJson("regions.json"));
  const parties = partySchema.array().parse(readJson("parties.json"));
  const shards: RegionShard[] = regions.map((listedRegion) => {
    const base = `regions/${listedRegion.id}`;
    return {
      region: regionSchema.parse(readJson(`${base}/region.json`)),
      districts: districtSchema.array().parse(readJson(`${base}/districts.json`)),
      candidates: candidateInputSchema.array().parse(readJson(`${base}/candidates.json`)),
      resources: resourceSchema.array().parse(readJson(`${base}/resources.json`)),
      news: newsSchema.array().parse(readJson(`${base}/news.json`)),
    };
  });
  return { election, regions, parties, shards };
}

export function collectUrls(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string" && /^https?:\/\//.test(value)) found.push(value);
  if (Array.isArray(value)) value.forEach((item) => collectUrls(item, found));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectUrls(item, found));
  return found;
}
