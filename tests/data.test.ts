import { describe, expect, it } from "vitest";
import {
  getCandidate,
  getDistrict,
  getElection,
  getRegionShard,
  getRegions,
  getSearchDocuments,
} from "../src/lib/data";

describe("current nationwide dataset", () => {
  it("retains the published nationwide counts", () => {
    const election = getElection();
    const regions = getRegions();
    expect(election.expected_district_count).toBe(225);
    expect(regions).toHaveLength(89);
  });

  it("loads a representative region and linked records", () => {
    const shard = getRegionShard("068-region");
    expect(shard).not.toBeNull();
    expect(shard?.districts.some((district) => district.number === 159)).toBe(true);
    expect(getDistrict(159)?.shard.region.id).toBe("068-region");
    expect(getCandidate("c159-pensioners-a5d830e020")?.district.number).toBe(159);
  });

  it("returns null for unknown public identifiers", () => {
    expect(getRegionShard("999-unknown")).toBeNull();
    expect(getDistrict(999)).toBeNull();
    expect(getCandidate("missing-candidate")).toBeNull();
  });

  it("builds searchable documents for every public entity", () => {
    const documents = getSearchDocuments();
    expect(documents).toHaveLength(89 + 225 + 1670);
    expect(documents.some((item) => item.type === "region" && item.id === "068-region")).toBe(true);
    expect(documents.some((item) => item.type === "district" && item.id === "159")).toBe(true);
    expect(documents.some((item) => item.type === "candidate" && item.id === "c159-pensioners-a5d830e020")).toBe(true);
  });
});
