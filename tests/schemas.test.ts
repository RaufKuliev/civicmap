import { describe, expect, it } from "vitest";
import validRegion from "./fixtures/valid-region.json";
import validDistrict from "./fixtures/valid-district.json";
import validCandidate from "./fixtures/valid-candidate.json";
import malformedCandidate from "./fixtures/malformed-candidate.json";
import emptyShard from "./fixtures/empty-shard.json";
import {
  candidateInputSchema,
  legacyCandidateSchema,
  districtSchema,
  newsSchema,
  regionSchema,
  resourceSchema,
} from "../src/lib/schemas";

describe("public data schemas", () => {
  it("accepts representative region, district, and candidate fixtures", () => {
    expect(regionSchema.parse(validRegion).id).toBe("999-test-region");
    expect(districtSchema.parse(validDistrict).number).toBe(225);
    expect(candidateInputSchema.parse(validCandidate).nomination_type).toBe("party");
  });

  it("rejects contradictory nomination and registration evidence", () => {
    const result = legacyCandidateSchema.safeParse(malformedCandidate);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining(["party_id", "status"]),
      );
    }
  });

  it("accepts empty optional collections without inventing records", () => {
    expect(districtSchema.array().parse(emptyShard.districts)).toEqual([]);
    expect(candidateInputSchema.array().parse(emptyShard.candidates)).toEqual([]);
    expect(resourceSchema.array().parse(emptyShard.resources)).toEqual([]);
    expect(newsSchema.array().parse(emptyShard.news)).toEqual([]);
  });

  it("migrates a legacy candidate into dated facts and status history", () => {
    const candidate = candidateInputSchema.parse(validCandidate);
    expect(candidate.schema_version).toBe(2);
    expect(candidate.candidacy).toMatchObject({
      district_number: validCandidate.district_number,
      nomination_type: validCandidate.nomination_type,
      party_id: validCandidate.party_id,
      as_of: validCandidate.status_as_of,
    });
    expect(candidate.facts.map((fact) => fact.field)).toEqual([
      "full_name",
      "birth_date",
      "district_number",
      "nomination_type",
      "party_id",
    ]);
    expect(candidate.facts.every((fact) => fact.as_of === validCandidate.status_as_of)).toBe(true);
    expect(candidate.status_history).toHaveLength(1);
    expect(candidate.status_history[0].source_ids).toEqual([candidate.sources[0].id]);
  });
});
