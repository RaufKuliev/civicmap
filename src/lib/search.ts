import type { CandidateStatus } from "./schemas";

export type DiscoveryType = "region" | "district" | "candidate";

export type DiscoveryDocument = {
  id: string;
  type: DiscoveryType;
  title: string;
  meta: string;
  href: string;
  searchable: string;
  regionId: string;
  districtNumber: number | null;
  partyId: string | null;
  nominationType: "party" | "self" | null;
  status: CandidateStatus | null;
  dataAsOf: string;
  decisionEvidence: boolean;
};

export type DiscoveryFilters = {
  query?: string;
  type?: DiscoveryType | "all";
  region?: string;
  party?: string;
  nomination?: "party" | "self" | "all";
  status?: CandidateStatus | "all";
  evidence?: "decision" | "nomination" | "all";
  sort?: "relevance" | "name" | "district";
};

const discoveryTypes: DiscoveryType[] = ["region", "district", "candidate"];
export type CompactDiscoveryDocument = [string, number, string, string, string, number | null, string | null, number | null, CandidateStatus | null, string, number];

export function compactDiscoveryDocument(document: DiscoveryDocument): CompactDiscoveryDocument {
  const titleTokens = new Set(normalizeSearchText(document.title).split(" "));
  const searchTokens = [...new Set(normalizeSearchText(document.searchable).split(" ").filter((token) => token && !titleTokens.has(token)))];
  return [document.id, discoveryTypes.indexOf(document.type), document.title, searchTokens.join(" "), document.regionId, document.districtNumber, document.partyId, document.nominationType === "party" ? 1 : document.nominationType === "self" ? 0 : null, document.status, document.dataAsOf, document.decisionEvidence ? 1 : 0];
}

export function expandDiscoveryDocument(value: CompactDiscoveryDocument, regionNames: Map<string, string>): DiscoveryDocument {
  const [id, typeIndex, title, searchable, regionId, districtNumber, partyId, nominationCode, status, dataAsOf, evidenceCode] = value;
  const type = discoveryTypes[typeIndex];
  if (!type) throw new Error(`Unknown discovery type code: ${typeIndex}`);
  const regionName = regionNames.get(regionId) ?? regionId;
  const href = type === "candidate" ? `/candidates/${id}/` : type === "district" ? `/districts/${districtNumber}/` : `/regions/${id}/`;
  const meta = type === "region" ? "Регион" : `Округ № ${districtNumber} · ${regionName}`;
  return { id, type, title, meta, href, searchable, regionId, districtNumber, partyId, nominationType: nominationCode === 1 ? "party" : nominationCode === 0 ? "self" : null, status, dataAsOf, decisionEvidence: evidenceCode === 1 };
}

export function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ru-RU").replaceAll("ё", "е").replace(/[’'`]/gu, "").replace(/[^а-яa-z0-9]+/giu, " ").trim();
}

export function searchDiscoveryDocuments(documents: DiscoveryDocument[], filters: DiscoveryFilters) {
  const query = normalizeSearchText(filters.query ?? "");
  const tokens = query.split(" ").filter(Boolean);
  const results = documents.filter((document) => {
    const haystack = normalizeSearchText(`${document.title} ${document.searchable}`);
    if (tokens.some((token) => !haystack.includes(token))) return false;
    if (filters.type && filters.type !== "all" && document.type !== filters.type) return false;
    if (filters.region && document.regionId !== filters.region) return false;
    if (filters.party && document.partyId !== filters.party) return false;
    if (filters.nomination && filters.nomination !== "all" && document.nominationType !== filters.nomination) return false;
    if (filters.status && filters.status !== "all" && document.status !== filters.status) return false;
    if (filters.evidence === "decision" && !document.decisionEvidence) return false;
    if (filters.evidence === "nomination" && document.decisionEvidence) return false;
    return true;
  });
  const sort = filters.sort ?? (query ? "relevance" : "name");
  return results.sort((left, right) => {
    if (sort === "district") return (left.districtNumber ?? 0) - (right.districtNumber ?? 0) || left.title.localeCompare(right.title, "ru");
    if (sort === "relevance") {
      const leftIndex = normalizeSearchText(left.title).indexOf(query);
      const rightIndex = normalizeSearchText(right.title).indexOf(query);
      const normalizedLeft = leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const normalizedRight = rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex;
      if (normalizedLeft !== normalizedRight) return normalizedLeft - normalizedRight;
    }
    return left.title.localeCompare(right.title, "ru");
  });
}
