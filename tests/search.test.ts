import { describe, expect, it } from "vitest";
import { compactDiscoveryDocument, expandDiscoveryDocument, normalizeSearchText, searchDiscoveryDocuments, type DiscoveryDocument } from "../src/lib/search";

const documents: DiscoveryDocument[] = [
  { id: "candidate-1", type: "candidate", title: "Воробьёв Леонид Дмитриевич", meta: "Округ № 202", href: "/candidates/candidate-1/", searchable: "Воробьёв Леонид Дмитриевич 202 Москва Нижневартовский КПРФ", regionId: "082-region", districtNumber: 202, partyId: "kprf", nominationType: "party", status: "registered", dataAsOf: "2026-07-22", decisionEvidence: true },
  { id: "district-57", type: "district", title: "Краснодарский край – Северный", meta: "Округ № 57", href: "/districts/57/", searchable: "57 Краснодарский край Северный", regionId: "028-region", districtNumber: 57, partyId: null, nominationType: null, status: null, dataAsOf: "2026-08-14", decisionEvidence: false },
];

describe("discovery search", () => {
  it.each([
    ["воробьев", "candidate-1"],
    ["ВОРОБЬЁВ", "candidate-1"],
    ["Леонид-Дмитриевич", "candidate-1"],
    ["202", "candidate-1"],
    ["нижневартовский", "candidate-1"],
    ["краснодарский северный", "district-57"],
  ])("matches %s", (query, id) => expect(searchDiscoveryDocuments(documents, { query }).map((item) => item.id)).toContain(id));

  it("composes region, party, status, and evidence filters", () => {
    expect(searchDiscoveryDocuments(documents, { region: "082-region", party: "kprf", status: "registered", evidence: "decision" })).toHaveLength(1);
    expect(searchDiscoveryDocuments(documents, { region: "082-region", evidence: "nomination" })).toHaveLength(0);
  });

  it("normalizes punctuation and Russian spelling variants", () => expect(normalizeSearchText("Воробьёв—Л.Д.'")).toBe("воробьев л д"));

  it("keeps search and filters after compact-index round trip", () => {
    const compact = documents.map(compactDiscoveryDocument);
    const expanded = compact.map((item) => expandDiscoveryDocument(item, new Map([["082-region", "Город Москва"], ["028-region", "Краснодарский край"]])));
    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(documents).length);
    expect(searchDiscoveryDocuments(expanded, { query: "воробьев", party: "kprf", evidence: "decision" }).map((item) => item.id)).toEqual(["candidate-1"]);
    expect(expanded[0].href).toBe("/candidates/candidate-1/");
  });
});
