import { z } from "zod";

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const datasetKindSchema = z.enum(["synthetic", "official"]);

export const electionSchema = z.object({
  title: z.string().min(1),
  election_date: isoDate.nullable(),
  data_as_of: isoDate,
  candidate_status_as_of: isoDate.optional(),
  dataset_kind: datasetKindSchema,
  expected_district_count: z.number().int().positive(),
  real_release_district_count: z.literal(225),
  methodology_version: z.string().min(1),
});

export const regionSchema = z.object({
  id: z.string().regex(/^\d{2,3}-[a-z0-9-]+$/),
  name: z.string().min(2),
  federal_district: z.string().min(2),
  district_count: z.number().int().positive(),
  data_as_of: isoDate,
});

export const sourceSchema = z.object({
  title: z.string().min(2),
  url: z.string().url().nullable(),
});

export const sourceKindSchema = z.enum([
  "official_registry",
  "party_list",
  "commission_decision",
  "official_document",
  "candidate_official",
  "party_official",
  "media",
  "synthetic_fixture",
]);

export const sourceReferenceSchema = sourceSchema.extend({
  id: z.string().min(3),
  publisher: z.string().min(2).nullable(),
  source_kind: sourceKindSchema,
  published_on: isoDate.nullable(),
  accessed_on: isoDate,
  sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  archived_path: z.string().min(1).nullable(),
});

export const evidenceSourceClassSchema = z.enum([
  "election_authority",
  "government_official",
  "candidate_controlled",
  "party_controlled",
  "independent_media",
]);

export const evidenceQualityTierSchema = z.enum([
  "primary_official",
  "primary_controlled",
  "secondary_editorial",
]);

export const evidenceReferenceSchema = z.object({
  publisher: z.string().min(2),
  source_url: z.string().url(),
  source_class: evidenceSourceClassSchema,
  quality_tier: evidenceQualityTierSchema,
  published_on: isoDate.nullable(),
  accessed_on: isoDate,
});

export const biographyEvidenceSchema = z.object({
  id: z.string().min(3),
  field: z.enum(["current_role", "education", "experience", "public_office"]),
  value: z.string().min(3),
  as_of: isoDate,
  evidence: evidenceReferenceSchema,
});

export const contactEvidenceSchema = z.object({
  id: z.string().min(3),
  type: z.enum(["public_office_phone", "public_office_address", "email", "contact_page"]),
  value: z.string().min(3),
  label: z.string().min(2),
  as_of: isoDate,
  evidence: evidenceReferenceSchema,
});

export const districtSchema = z.object({
  number: z.number().int().min(1).max(225),
  name: z.string().min(3),
  territory_description: z.string().min(20),
  electoral_commission: z.string().min(3).nullable(),
  official_source: sourceSchema,
  geometry_status: z.enum(["not_published", "verified"]),
  data_as_of: isoDate,
});

export const candidateStatusSchema = z.enum([
  "nominated",
  "certified_list",
  "registered",
  "registration_denied",
  "registration_cancelled",
  "withdrawn",
  "lost_status",
  "elected",
  "not_elected",
  "status_pending_verification",
]);

export const statusDecisionSchema = z.object({
  number: z.string().min(1),
  decided_on: isoDate,
  commission: z.string().min(2),
});

export const candidateStatusEventSchema = z.object({
  id: z.string().min(3),
  status: candidateStatusSchema,
  effective_on: isoDate,
  recorded_on: isoDate,
  source_ids: z.array(z.string().min(3)).min(1),
  decision: statusDecisionSchema.nullable(),
  note: z.string().min(2).nullable(),
});

export const candidateFactSchema = z.object({
  field: z.enum(["full_name", "birth_date", "district_number", "nomination_type", "party_id"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  as_of: isoDate,
  source_ids: z.array(z.string().min(3)).min(1),
});

export const candidacySchema = z.object({
  district_number: z.number().int().min(1).max(225),
  nomination_type: z.enum(["party", "self"]),
  party_id: z.string().nullable(),
  as_of: isoDate,
  source_ids: z.array(z.string().min(3)).min(1),
});

const candidateCoreSchema = z.object({
  id: z.string().min(3),
  full_name: z.string().min(5),
  birth_date: isoDate.nullable(),
  district_number: z.number().int().min(1).max(225),
  nomination_type: z.enum(["party", "self"]),
  party_id: z.string().nullable(),
  status: candidateStatusSchema,
  status_as_of: isoDate,
  official_source: sourceSchema.extend({
    accessed_at: isoDate,
    source_kind: z.enum(["official_registry", "party_list", "commission_decision", "synthetic_fixture"]),
  }),
  synthetic: z.boolean(),
  biography: z.array(biographyEvidenceSchema).default([]),
  contacts: z.array(contactEvidenceSchema).default([]),
});

function validateCandidateCore(value: z.infer<typeof candidateCoreSchema>, ctx: z.RefinementCtx) {
  if (value.nomination_type === "party" && !value.party_id) {
    ctx.addIssue({ code: "custom", path: ["party_id"], message: "Для партийного выдвижения обязательна партия" });
  }
  if (value.nomination_type === "self" && value.party_id) {
    ctx.addIssue({ code: "custom", path: ["party_id"], message: "У самовыдвижения не должно быть party_id" });
  }
  if (value.status === "registered" && value.official_source.source_kind === "party_list") {
    ctx.addIssue({ code: "custom", path: ["status"], message: "Партийный список не подтверждает регистрацию" });
  }
}

export const legacyCandidateSchema = candidateCoreSchema.superRefine(validateCandidateCore);

export const allowedStatusTransitions: Readonly<Record<z.infer<typeof candidateStatusSchema>, readonly z.infer<typeof candidateStatusSchema>[]>> = {
  nominated: ["certified_list", "registered", "registration_denied", "withdrawn", "lost_status", "status_pending_verification"],
  certified_list: ["registered", "registration_denied", "registration_cancelled", "withdrawn", "lost_status", "status_pending_verification"],
  registered: ["registration_cancelled", "withdrawn", "lost_status", "elected", "not_elected", "status_pending_verification"],
  registration_denied: ["registered", "status_pending_verification"],
  registration_cancelled: ["registered", "status_pending_verification"],
  withdrawn: ["status_pending_verification"],
  lost_status: ["status_pending_verification"],
  elected: [],
  not_elected: [],
  status_pending_verification: ["nominated", "certified_list", "registered", "registration_denied", "registration_cancelled", "withdrawn", "lost_status", "elected", "not_elected"],
};

export const decisionRequiredStatuses = new Set<z.infer<typeof candidateStatusSchema>>([
  "registered",
  "registration_denied",
  "registration_cancelled",
  "withdrawn",
  "lost_status",
  "elected",
  "not_elected",
]);

export function isAllowedStatusTransition(previous: z.infer<typeof candidateStatusSchema>, next: z.infer<typeof candidateStatusSchema>) {
  return allowedStatusTransitions[previous].includes(next);
}

export const candidateSchema = candidateCoreSchema.extend({
  schema_version: z.literal(2),
  sources: z.array(sourceReferenceSchema).min(1),
  candidacy: candidacySchema,
  facts: z.array(candidateFactSchema).min(5),
  status_history: z.array(candidateStatusEventSchema).min(1),
}).superRefine((value, ctx) => {
  validateCandidateCore(value, ctx);
  const sourceIds = new Set(value.sources.map((source) => source.id));
  for (const sourceId of value.candidacy.source_ids) if (!sourceIds.has(sourceId)) {
    ctx.addIssue({ code: "custom", path: ["candidacy", "source_ids"], message: `Неизвестный источник ${sourceId}` });
  }
  if (value.candidacy.district_number !== value.district_number || value.candidacy.nomination_type !== value.nomination_type || value.candidacy.party_id !== value.party_id) {
    ctx.addIssue({ code: "custom", path: ["candidacy"], message: "Версионированное выдвижение должно совпадать с совместимыми плоскими полями" });
  }
  for (const [index, fact] of value.facts.entries()) {
    for (const sourceId of fact.source_ids) if (!sourceIds.has(sourceId)) {
      ctx.addIssue({ code: "custom", path: ["facts", index, "source_ids"], message: `Неизвестный источник ${sourceId}` });
    }
  }
  for (const [index, event] of value.status_history.entries()) {
    for (const sourceId of event.source_ids) if (!sourceIds.has(sourceId)) {
      ctx.addIssue({ code: "custom", path: ["status_history", index, "source_ids"], message: `Неизвестный источник ${sourceId}` });
    }
    const previous = value.status_history[index - 1];
    if (previous && event.effective_on < previous.effective_on) {
      ctx.addIssue({ code: "custom", path: ["status_history", index, "effective_on"], message: "История статусов должна быть хронологической" });
    }
    if (previous && !isAllowedStatusTransition(previous.status, event.status)) {
      ctx.addIssue({ code: "custom", path: ["status_history", index, "status"], message: `Недопустимый переход ${previous.status} → ${event.status}` });
    }
    if (decisionRequiredStatuses.has(event.status) && !event.decision) {
      ctx.addIssue({ code: "custom", path: ["status_history", index, "decision"], message: `Статус ${event.status} требует датированного решения комиссии` });
    }
  }
  const latest = value.status_history.at(-1);
  if (latest && (latest.status !== value.status || latest.effective_on !== value.status_as_of)) {
    ctx.addIssue({ code: "custom", path: ["status_history"], message: "Последнее событие должно совпадать с текущим статусом" });
  }
});

function stableSourceId(value: z.infer<typeof legacyCandidateSchema>) {
  const input = `${value.official_source.source_kind}|${value.official_source.url ?? value.official_source.title}|${value.official_source.accessed_at}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `source-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function migrateLegacyCandidate(value: z.infer<typeof legacyCandidateSchema>): z.infer<typeof candidateSchema> {
  const sourceId = stableSourceId(value);
  const source = {
    id: sourceId,
    title: value.official_source.title,
    url: value.official_source.url,
    publisher: null,
    source_kind: value.official_source.source_kind,
    published_on: value.status_as_of,
    accessed_on: value.official_source.accessed_at,
    sha256: null,
    archived_path: null,
  } as const;
  return candidateSchema.parse({
    ...value,
    schema_version: 2,
    sources: [source],
    candidacy: {
      district_number: value.district_number,
      nomination_type: value.nomination_type,
      party_id: value.party_id,
      as_of: value.status_as_of,
      source_ids: [sourceId],
    },
    facts: [
      { field: "full_name", value: value.full_name, as_of: value.status_as_of, source_ids: [sourceId] },
      { field: "birth_date", value: value.birth_date, as_of: value.status_as_of, source_ids: [sourceId] },
      { field: "district_number", value: value.district_number, as_of: value.status_as_of, source_ids: [sourceId] },
      { field: "nomination_type", value: value.nomination_type, as_of: value.status_as_of, source_ids: [sourceId] },
      { field: "party_id", value: value.party_id, as_of: value.status_as_of, source_ids: [sourceId] },
    ],
    status_history: [{
      id: `legacy-${value.id}-${value.status_as_of}`,
      status: value.status,
      effective_on: value.status_as_of,
      recorded_on: value.official_source.accessed_at,
      source_ids: [sourceId],
      decision: null,
      note: "Мигрировано из схемы v1 без изменения исходной записи",
    }],
  });
}

export const candidateInputSchema = z.union([candidateSchema, legacyCandidateSchema]).transform((value) => (
  "schema_version" in value ? value : migrateLegacyCandidate(value)
));

export const snapshotManifestSchema = z.object({
  schema_version: z.literal(1),
  snapshot_id: z.string().min(3),
  election_id: z.string().min(3),
  as_of: isoDate,
  created_on: isoDate,
  dataset_kind: datasetKindSchema,
  predecessor_snapshot_id: z.string().min(3).nullable(),
  sources: z.array(sourceReferenceSchema).min(1),
  record_counts: z.object({ regions: z.number().int().nonnegative(), districts: z.number().int().nonnegative(), candidates: z.number().int().nonnegative() }),
});

export const candidateSnapshotSchema = z.object({
  manifest: snapshotManifestSchema,
  candidates: z.array(candidateInputSchema),
});

export const candidateDiffSchema = z.object({
  schema_version: z.literal(1),
  before_snapshot_id: z.string(),
  after_snapshot_id: z.string(),
  added: z.array(z.object({ candidate_id: z.string(), status: candidateStatusSchema })),
  removed: z.array(z.object({ candidate_id: z.string(), status: candidateStatusSchema })),
  changed: z.array(z.object({
    candidate_id: z.string(),
    changes: z.array(z.object({ field: z.string(), before: z.unknown(), after: z.unknown() })).min(1),
  })),
});

export const partySchema = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  short_name: z.string().min(1),
  synthetic: z.boolean(),
});

export const resourceSchema = z.object({
  candidate_id: z.string(),
  type: z.enum(["website", "party_profile", "telegram", "vk", "youtube", "rutube", "other"]),
  title: z.string().min(2),
  url: z.string().url(),
  verification_status: z.enum(["verified_by_official_profile", "verified_by_cross_links"]),
  verification_method: z.string().min(3),
  verified_at: isoDate,
  source_url: z.string().url(),
  publisher: z.string().min(2),
  source_class: evidenceSourceClassSchema,
  quality_tier: evidenceQualityTierSchema,
  published_on: isoDate.nullable(),
  accessed_on: isoDate,
});

export const newsSchema = z.object({
  id: z.string(),
  candidate_id: z.string(),
  title: z.string().min(3),
  publisher: z.string().min(2),
  url: z.string().url(),
  published_at: isoDate,
  accessed_at: isoDate,
  material_type: z.enum(["news", "interview", "profile", "statement"]),
  relation: z.string().min(3),
  review_status: z.literal("approved"),
  source_class: evidenceSourceClassSchema,
  quality_tier: evidenceQualityTierSchema,
});

export type Election = z.infer<typeof electionSchema>;
export type Region = z.infer<typeof regionSchema>;
export type District = z.infer<typeof districtSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type CandidateSnapshot = z.infer<typeof candidateSnapshotSchema>;
export type CandidateDiff = z.infer<typeof candidateDiffSchema>;
export type Party = z.infer<typeof partySchema>;
export type Resource = z.infer<typeof resourceSchema>;
export type NewsItem = z.infer<typeof newsSchema>;
export type CandidateStatus = z.infer<typeof candidateStatusSchema>;
export type EvidenceSourceClass = z.infer<typeof evidenceSourceClassSchema>;

export type RegionShard = {
  region: Region;
  districts: District[];
  candidates: Candidate[];
  resources: Resource[];
  news: NewsItem[];
};
