import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import {
  candidateInputSchema,
  districtSchema,
  electionSchema,
  newsSchema,
  partySchema,
  regionSchema,
  resourceSchema,
  type Candidate,
  type District,
  type Election,
  type Party,
  type Region,
  type RegionShard,
} from "./schemas";
import { territorySearchEntrySchema } from "./territories";
import { verifiedGeometryRegistrySchema } from "./geometry";
import type { DiscoveryDocument } from "./search";

const dataRoot = path.join(process.cwd(), "data");

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(dataRoot, relativePath), "utf8")) as T;
}

export const getElection = cache((): Election => electionSchema.parse(readJson("election.json")));
export const getRegions = cache((): Region[] => regionSchema.array().parse(readJson("regions.json")));
export const getParties = cache((): Party[] => partySchema.array().parse(readJson("parties.json")));
export const getTerritorySearchEntries = cache(() => territorySearchEntrySchema.array().parse(readJson("territories/search-index.json")));
export const getVerifiedGeometryRegistry = cache(() => verifiedGeometryRegistrySchema.parse(readJson("geometry/verified-districts.json")));

export const getRegionShard = cache((regionId: string): RegionShard | null => {
  const region = getRegions().find((item) => item.id === regionId);
  if (!region) return null;
  const base = `regions/${regionId}`;
  return {
    region: regionSchema.parse(readJson(`${base}/region.json`)),
    districts: districtSchema.array().parse(readJson(`${base}/districts.json`)),
    candidates: candidateInputSchema.array().parse(readJson(`${base}/candidates.json`)),
    resources: resourceSchema.array().parse(readJson(`${base}/resources.json`)),
    news: newsSchema.array().parse(readJson(`${base}/news.json`)),
  };
});

export function getAllShards() {
  return getRegions().map((region) => getRegionShard(region.id)).filter((shard): shard is RegionShard => Boolean(shard));
}

export function getDistrict(number: number): { district: District; shard: RegionShard } | null {
  for (const shard of getAllShards()) {
    const district = shard.districts.find((item) => item.number === number);
    if (district) return { district, shard };
  }
  return null;
}

export function getCandidate(id: string): { candidate: Candidate; shard: RegionShard; district: District } | null {
  for (const shard of getAllShards()) {
    const candidate = shard.candidates.find((item) => item.id === id);
    const district = candidate && shard.districts.find((item) => item.number === candidate.district_number);
    if (candidate && district) return { candidate, shard, district };
  }
  return null;
}

export function getPartyName(partyId: string | null) {
  if (!partyId) return "Самовыдвижение";
  return getParties().find((party) => party.id === partyId)?.name ?? "Партия не найдена";
}

export function getSearchDocuments() {
  const election = getElection();
  const parties = new Map(getParties().map((party) => [party.id, party.name]));
  const territoryTerms = new Map(getTerritorySearchEntries().map((entry) => [entry.district_number, entry.terms.join(" ")]));
  const documents: DiscoveryDocument[] = [];
  for (const shard of getAllShards()) {
    documents.push({ id: shard.region.id, type: "region", title: shard.region.name, meta: `${shard.region.district_count} округов`, href: `/regions/${shard.region.id}/`, searchable: `${shard.region.name} ${shard.region.federal_district}`, regionId: shard.region.id, districtNumber: null, partyId: null, nominationType: null, status: null, dataAsOf: shard.region.data_as_of, decisionEvidence: false });
    for (const district of shard.districts) {
      documents.push({ id: String(district.number), type: "district", title: district.name, meta: `Округ № ${district.number} · ${shard.region.name}`, href: `/districts/${district.number}/`, searchable: `${district.number} ${district.name} ${shard.region.name} ${territoryTerms.get(district.number) ?? ""}`, regionId: shard.region.id, districtNumber: district.number, partyId: null, nominationType: null, status: null, dataAsOf: district.data_as_of, decisionEvidence: false });
    }
    for (const candidate of shard.candidates) {
      documents.push({ id: candidate.id, type: "candidate", title: candidate.full_name, meta: `Округ № ${candidate.district_number} · ${shard.region.name}`, href: `/candidates/${candidate.id}/`, searchable: `${candidate.full_name} ${candidate.district_number} ${shard.region.name} ${parties.get(candidate.party_id ?? "") ?? "самовыдвижение"} ${territoryTerms.get(candidate.district_number) ?? ""}`, regionId: shard.region.id, districtNumber: candidate.district_number, partyId: candidate.party_id, nominationType: candidate.nomination_type, status: candidate.status, dataAsOf: candidate.status_as_of ?? election.data_as_of, decisionEvidence: candidate.status_history.some((event) => Boolean(event.decision)) });
    }
  }
  return documents;
}
