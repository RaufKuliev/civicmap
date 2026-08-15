import { afterEach, describe, expect, it, vi } from "vitest";
import { findTerritoryFallback, geocodeAddress } from "../src/lib/geocoding";

afterEach(() => vi.unstubAllGlobals());

describe("address lookup", () => {
  it("finds only explicitly labelled fallback territories", () => {
    const territories = [
      { districtNumber: 159, regionId: "068-region", terms: ["самарская область", "самарский"], reviewRequired: true },
      { districtNumber: 201, regionId: "082-region", terms: ["город москва", "новомосковский"], reviewRequired: true },
    ];
    expect(findTerritoryFallback("Самара", territories).map((item) => item.districtNumber)).toEqual([159]);
    expect(findTerritoryFallback("Ленинский район, Самара, Самарская область, Россия", territories).map((item) => item.districtNumber)).toEqual([159]);
    expect(findTerritoryFallback("неизвестное место", territories)).toEqual([]);
    expect(findTerritoryFallback("Приволжский федеральный округ", territories)).toEqual([]);
  });

  it("reports disabled provider and invalid input without network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const base = { endpoint: null, minIntervalMs: 0, cacheTtlMs: 0, timeoutMs: 100 };
    await expect(geocodeAddress("Самара", base)).rejects.toThrow("provider_disabled");
    await expect(geocodeAddress("дом", { ...base, endpoint: "https://geo.example/search" })).rejects.toThrow("input_too_short");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces provider errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(geocodeAddress("Самара", { endpoint: "https://geo.example/search", minIntervalMs: 0, cacheTtlMs: 0, timeoutMs: 100 })).rejects.toThrow("provider_http_503");
  });
});
