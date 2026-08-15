import { z } from "zod";
import { isoDate, sourceReferenceSchema } from "./schemas";

export const territoryUnitTypeSchema = z.enum([
  "federal_subject",
  "locality_label",
  "territory_fragment",
  "unparsed",
]);

export const territoryUnitSchema = z.object({
  id: z.string().min(3),
  type: territoryUnitTypeSchema,
  name: z.string().min(1),
  source_fragment: z.string().min(1),
  interpretation: z.enum(["exact", "label_only", "unparsed"]),
});

export const districtTerritorySchema = z.object({
  schema_version: z.literal(1),
  district_id: z.string().regex(/^district-\d+$/),
  district_number: z.number().int().min(1).max(225),
  region_id: z.string().min(3),
  verbatim_source_text: z.string().min(20),
  source: sourceReferenceSchema,
  units: z.array(territoryUnitSchema).min(2),
  review_required: z.boolean(),
  warnings: z.array(z.string().min(3)),
  parsed_on: isoDate,
});

export const territorySearchEntrySchema = z.object({
  district_id: z.string(),
  district_number: z.number().int(),
  region_id: z.string(),
  terms: z.array(z.string().min(1)).min(2),
  review_required: z.boolean(),
});

export const territoryBuildSchema = z.object({
  schema_version: z.literal(1),
  source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  districts: z.array(districtTerritorySchema).length(225),
});

export const territoryReviewReportSchema = z.object({
  schema_version: z.literal(1),
  generated_on: isoDate,
  source_descriptions: z.number().int(),
  structured: z.number().int(),
  review_required: z.number().int(),
  warning_counts: z.record(z.string(), z.number().int()),
  districts: z.array(z.object({ district_number: z.number().int(), warnings: z.array(z.string()) })),
});

const directionalLabels = /^(центральный|северный|южный|западный|восточный|северо-западный|северо-восточный|юго-западный|юго-восточный)$/iu;

export function normalizeTerritoryTerm(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ru-RU").replaceAll("ё", "е").replace(/[^а-яa-z0-9]+/giu, " ").trim();
}

export function parseDistrictTitle(fullName: string, regionName: string) {
  const withoutSuffix = fullName.replace(/\s+одномандатный избирательный округ$/iu, "").trim();
  const parts = withoutSuffix.split(/\s+[–—]\s+/u).map((part) => part.trim()).filter(Boolean);
  const label = parts.at(-1) ?? withoutSuffix;
  const warnings = ["source_contains_district_name_not_boundary_composition"];
  const labelType = directionalLabels.test(label) ? "territory_fragment" as const : "locality_label" as const;
  if (labelType === "territory_fragment") warnings.push("directional_label_requires_boundary_source");
  return {
    label,
    warnings,
    units: [
      { type: "federal_subject" as const, name: regionName, source_fragment: regionName, interpretation: "exact" as const },
      { type: labelType, name: label, source_fragment: label, interpretation: "label_only" as const },
    ],
  };
}

export type DistrictTerritory = z.infer<typeof districtTerritorySchema>;
