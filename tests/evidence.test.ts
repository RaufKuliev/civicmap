import { describe, expect, it } from "vitest";
import { analyzeEvidence, normalizeEvidenceUrl } from "../src/lib/evidence";

describe("evidence quality", () => {
  it("normalizes tracking parameters and trailing slash", () => {
    expect(normalizeEvidenceUrl("https://Example.org/profile/?utm_source=test&id=2#bio")).toBe("https://example.org/profile?id=2");
  });

  it("flags invalid, duplicate and stale records deterministically", () => {
    const issues = analyzeEvidence([
      { id: "b", url: "https://example.org/profile/?utm_source=x", publishedOn: null, qualityTier: "primary_official" },
      { id: "a", url: "https://example.org/profile", publishedOn: null, qualityTier: "primary_official" },
      { id: "invalid", url: "not a url", publishedOn: null, qualityTier: "primary_controlled" },
      { id: "old", url: "https://news.example.org/old", publishedOn: "2024-01-01", qualityTier: "secondary_editorial" },
    ], "2026-08-14");
    expect(issues).toEqual([
      { code: "duplicate_url", record_id: "b", detail: "a" },
      { code: "invalid_url", record_id: "invalid", detail: "not a url" },
      { code: "stale_item", record_id: "old", detail: "956 days" },
    ]);
  });
});
