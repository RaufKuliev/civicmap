import { describe, expect, it } from "vitest";
import { matchVerifiedDistrict, pointInPolygon, type VerifiedGeometry } from "../src/lib/geometry";

const source = { id: "geometry-source", title: "Fixture", url: "https://example.org/geometry", publisher: "Test publisher", source_kind: "official_document" as const, published_on: "2026-01-01", accessed_on: "2026-08-14", sha256: null, archived_path: null };
const square = (district_number: number, offset = 0): VerifiedGeometry => ({ schema_version: 1, district_number, verified_on: "2026-08-14", source, polygon: [[offset, 0], [offset + 10, 0], [offset + 10, 10], [offset, 10], [offset, 0]] });

describe("verified geometry matching", () => {
  it("classifies inside, outside and boundary points", () => {
    expect(pointInPolygon([5, 5], square(1).polygon)).toBe("inside");
    expect(pointInPolygon([15, 5], square(1).polygon)).toBe("outside");
    expect(pointInPolygon([0, 5], square(1).polygon)).toBe("boundary");
  });

  it("returns exact only for one non-boundary containing polygon", () => {
    expect(matchVerifiedDistrict([5, 5], []).exact).toBeNull();
    expect(matchVerifiedDistrict([5, 5], [square(1)]).exact).toBe(1);
    expect(matchVerifiedDistrict([0, 5], [square(1)]).exact).toBeNull();
    expect(matchVerifiedDistrict([7, 5], [square(1), square(2, 5)]).exact).toBeNull();
  });
});
