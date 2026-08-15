import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import examples from "./fixtures/territory-titles.json";
import {
  parseDistrictTitle,
  territoryBuildSchema,
  territoryReviewReportSchema,
  territorySearchEntrySchema,
} from "../src/lib/territories";

describe("district territory parser", () => {
  it.each(examples)("parses $full_name without discarding the source", (example) => {
    const result = parseDistrictTitle(example.full_name, example.region_name);
    expect(result.label).toBe(example.label);
    expect(result.units.at(-1)?.type).toBe(example.type);
    expect(result.warnings).toContain("source_contains_district_name_not_boundary_composition");
  });

  it("validates all generated territory artifacts", () => {
    const root = path.join(process.cwd(), "data", "territories");
    const build = territoryBuildSchema.parse(JSON.parse(fs.readFileSync(path.join(root, "districts.json"), "utf8")));
    const search = territorySearchEntrySchema.array().parse(JSON.parse(fs.readFileSync(path.join(root, "search-index.json"), "utf8")));
    const review = territoryReviewReportSchema.parse(JSON.parse(fs.readFileSync(path.join(root, "review-report.json"), "utf8")));
    expect(build.districts).toHaveLength(225);
    expect(new Set(build.districts.map((district) => district.district_number)).size).toBe(225);
    expect(search).toHaveLength(225);
    expect(review).toMatchObject({ source_descriptions: 225, structured: 225, review_required: 225 });
  });
});
