import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { strFromU8, unzipSync } from "fflate";
import {
  normalizeTerritoryTerm,
  parseDistrictTitle,
  territoryBuildSchema,
  territoryReviewReportSchema,
  territorySearchEntrySchema,
} from "../src/lib/territories";

const root = process.cwd();
const dataRoot = path.join(root, "data");
const sourcePath = path.join(dataRoot, "raw", "2026-08-14", "sources", "districts-107fz.docx");
const outputRoot = path.join(dataRoot, "territories");
const sourceUrl = "https://government.ru/docs/all/159107/";
const parsedOn = "2026-08-14";

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

export function extractFirstDocxTableRows(bytes: Uint8Array) {
  const archive = unzipSync(bytes);
  const document = archive["word/document.xml"];
  if (!document) throw new Error("DOCX не содержит word/document.xml");
  const xml = strFromU8(document);
  const table = xml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/u)?.[0];
  if (!table) throw new Error("В DOCX не найдена таблица округов");
  return [...table.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/gu)].map(([row]) => (
    [...row.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/gu)].map(([cell]) => {
      const paragraphs = [...cell.matchAll(/<w:p\b[\s\S]*?<\/w:p>/gu)].map(([paragraph]) => (
        [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gu)].map((match) => decodeXml(match[1])).join("")
      ));
      return paragraphs.join(" ").replace(/\s+/gu, " ").trim();
    })
  ));
}

function stableJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function main() {
  const sourceBytes = fs.readFileSync(sourcePath);
  const sourceSha256 = crypto.createHash("sha256").update(sourceBytes).digest("hex");
  const regions = JSON.parse(fs.readFileSync(path.join(dataRoot, "regions.json"), "utf8")) as Array<{ id: string; name: string }>;
  const regionByName = new Map(regions.map((region) => [region.name, region]));
  const rows = extractFirstDocxTableRows(sourceBytes);
  const records: Array<{ number: number; regionName: string; fullName: string }> = [];
  let currentRegion = "";
  for (const cells of rows) {
    const numberMatch = cells[0]?.match(/^(\d+)\.$/u);
    if (!numberMatch || cells.length < 3) continue;
    const number = Number(numberMatch[0]);
    if (number < 1 || number > 225 || records.some((item) => item.number === number)) continue;
    if (cells[1]) currentRegion = cells[1];
    if (!currentRegion || !cells[2]) throw new Error(`Неполная строка округа № ${number}`);
    records.push({ number, regionName: currentRegion, fullName: cells[2] });
  }
  records.sort((left, right) => left.number - right.number);
  if (records.length !== 225 || records.some((record, index) => record.number !== index + 1)) throw new Error(`Ожидались округа 1–225, получено ${records.length}`);

  const districts = records.map((record) => {
    const region = regionByName.get(record.regionName);
    if (!region) throw new Error(`Не найден canonical region для ${record.regionName}`);
    const parsed = parseDistrictTitle(record.fullName, record.regionName);
    return {
      schema_version: 1 as const,
      district_id: `district-${record.number}`,
      district_number: record.number,
      region_id: region.id,
      verbatim_source_text: record.fullName,
      source: {
        id: "federal-law-107-fz",
        title: "Федеральный закон от 23.05.2025 № 107-ФЗ и схема округов",
        url: sourceUrl,
        publisher: "Правительство России",
        source_kind: "official_document" as const,
        published_on: "2025-05-23",
        accessed_on: parsedOn,
        sha256: sourceSha256,
        archived_path: "data/raw/2026-08-14/sources/districts-107fz.docx",
      },
      units: parsed.units.map((unit, index) => ({ ...unit, id: `district-${record.number}-unit-${index + 1}` })),
      review_required: true,
      warnings: parsed.warnings,
      parsed_on: parsedOn,
    };
  });
  const build = territoryBuildSchema.parse({ schema_version: 1, source_sha256: sourceSha256, districts });
  const search = territorySearchEntrySchema.array().parse(districts.map((district) => ({
    district_id: district.district_id,
    district_number: district.district_number,
    region_id: district.region_id,
    terms: [...new Set([district.verbatim_source_text, ...district.units.map((unit) => unit.name)].map(normalizeTerritoryTerm))],
    review_required: district.review_required,
  })));
  const warningCounts: Record<string, number> = {};
  for (const district of districts) for (const warning of district.warnings) warningCounts[warning] = (warningCounts[warning] ?? 0) + 1;
  const review = territoryReviewReportSchema.parse({
    schema_version: 1,
    generated_on: parsedOn,
    source_descriptions: districts.length,
    structured: districts.filter((district) => district.units.length > 0).length,
    review_required: districts.filter((district) => district.review_required).length,
    warning_counts: warningCounts,
    districts: districts.filter((district) => district.review_required).map((district) => ({ district_number: district.district_number, warnings: district.warnings })),
  });

  for (const region of regions) {
    const districtFile = path.join(dataRoot, "regions", region.id, "districts.json");
    const regionDistricts = JSON.parse(fs.readFileSync(districtFile, "utf8")) as Array<Record<string, unknown> & { number: number }>;
    const byNumber = new Map(districts.filter((district) => district.region_id === region.id).map((district) => [district.district_number, district]));
    const updated = regionDistricts.map((district) => ({ ...district, territory_description: byNumber.get(district.number)?.verbatim_source_text ?? district.territory_description }));
    fs.writeFileSync(districtFile, stableJson(updated), "utf8");
  }

  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(path.join(outputRoot, "districts.json"), stableJson(build), "utf8");
  fs.writeFileSync(path.join(outputRoot, "search-index.json"), stableJson(search), "utf8");
  fs.writeFileSync(path.join(outputRoot, "review-report.json"), stableJson(review), "utf8");
  console.log(`Territories: ${districts.length}/225 source descriptions; structured=${review.structured}; review_required=${review.review_required}; source_sha256=${sourceSha256}`);
}

main();
