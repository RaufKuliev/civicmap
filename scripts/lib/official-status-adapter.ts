import crypto from "node:crypto";
import { z } from "zod";
import {
  candidateInputSchema,
  candidateSchema,
  candidateStatusSchema,
  decisionRequiredStatuses,
  migrateLegacyCandidate,
  legacyCandidateSchema,
  statusDecisionSchema,
  type Candidate,
  type CandidateStatus,
} from "../../src/lib/schemas";

const sourcePageSchema = z.object({
  id: z.string().min(3),
  title: z.string().min(3),
  url: z.string().url(),
  publisher: z.string().min(2),
});

export const officialStatusRecordSchema = z.object({
  candidate_id: z.string().min(3).nullable(),
  full_name: z.string().min(5),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  district_number: z.number().int().min(1).max(225),
  nomination_type: z.enum(["party", "self"]),
  party_id: z.string().nullable(),
  nominated_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: candidateStatusSchema,
  decision: statusDecisionSchema.nullable(),
  source_page_id: z.string().min(3),
}).superRefine((value, ctx) => {
  if (value.nomination_type === "party" && !value.party_id) ctx.addIssue({ code: "custom", path: ["party_id"], message: "Для партийного кандидата обязательна партия" });
  if (value.nomination_type === "self" && value.party_id) ctx.addIssue({ code: "custom", path: ["party_id"], message: "У самовыдвиженца не должно быть партии" });
  if (decisionRequiredStatuses.has(value.status) && !value.decision) ctx.addIssue({ code: "custom", path: ["decision"], message: `Статус ${value.status} требует решения` });
});

export const officialStatusFixtureSchema = z.object({
  schema_version: z.literal(1),
  fixture_id: z.string().min(3),
  observed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  acquisition: z.enum(["manual_transcription_verified", "official_export", "recorded_html"]),
  source_pages: z.array(sourcePageSchema).min(1),
  records: z.array(officialStatusRecordSchema).min(1),
}).superRefine((value, ctx) => {
  const sourceIds = new Set(value.source_pages.map((source) => source.id));
  for (const [index, record] of value.records.entries()) if (!sourceIds.has(record.source_page_id)) {
    ctx.addIssue({ code: "custom", path: ["records", index, "source_page_id"], message: "Неизвестная страница источника" });
  }
});

export type OfficialStatusFixture = z.infer<typeof officialStatusFixtureSchema>;
export type OfficialStatusRecord = z.infer<typeof officialStatusRecordSchema>;

export interface AdapterContext {
  fixture: OfficialStatusFixture;
  archivedPath: string;
  fixtureSha256: string;
}

export interface OfficialStatusAdapter {
  readonly id: string;
  parse(bytes: Buffer): OfficialStatusFixture;
  apply(candidate: unknown | null, record: OfficialStatusRecord, context: AdapterContext): Candidate;
}

function stableHash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function normalizePersonName(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ru-RU").replaceAll("ё", "е").replace(/[^а-яa-z0-9]+/giu, " ").trim();
}

export function candidateLookupKey(fullName: string, districtNumber: number) {
  return `${districtNumber}|${normalizePersonName(fullName)}`;
}

function getSourcePage(record: OfficialStatusRecord, fixture: OfficialStatusFixture) {
  const source = fixture.source_pages.find((item) => item.id === record.source_page_id);
  if (!source) throw new Error(`Источник ${record.source_page_id} отсутствует в fixture`);
  return source;
}

function buildSource(record: OfficialStatusRecord, context: AdapterContext) {
  const page = getSourcePage(record, context.fixture);
  const decisionSuffix = record.decision ? `${record.decision.number}-${record.decision.decided_on}` : `nomination-${record.nominated_on}`;
  return {
    id: `${page.id}-${stableHash(decisionSuffix)}`,
    title: record.decision ? `Решение № ${record.decision.number} от ${record.decision.decided_on}: ${record.full_name}` : page.title,
    url: page.url,
    publisher: page.publisher,
    source_kind: record.decision ? "commission_decision" as const : "official_registry" as const,
    published_on: record.decision?.decided_on ?? record.nominated_on,
    accessed_on: context.fixture.observed_on,
    sha256: context.fixtureSha256,
    archived_path: context.archivedPath,
  };
}

function createBaseCandidate(record: OfficialStatusRecord, context: AdapterContext): Candidate {
  const page = getSourcePage(record, context.fixture);
  const candidateId = record.candidate_id ?? `c${record.district_number}-self-${stableHash(`${record.full_name}|${record.birth_date ?? ""}`)}`;
  return migrateLegacyCandidate(legacyCandidateSchema.parse({
    id: candidateId,
    full_name: record.full_name,
    birth_date: record.birth_date,
    district_number: record.district_number,
    nomination_type: record.nomination_type,
    party_id: record.party_id,
    status: "nominated",
    status_as_of: record.nominated_on,
    official_source: {
      title: page.title,
      url: page.url,
      accessed_at: context.fixture.observed_on,
      source_kind: "official_registry",
    },
    synthetic: false,
  }));
}

export function applyOfficialStatusRecord(input: unknown | null, recordInput: unknown, context: AdapterContext): Candidate {
  const record = officialStatusRecordSchema.parse(recordInput);
  const base = input ? candidateInputSchema.parse(input) : createBaseCandidate(record, context);
  if (base.district_number !== record.district_number || normalizePersonName(base.full_name) !== normalizePersonName(record.full_name)) {
    throw new Error(`Кандидат не совпадает с записью fixture: ${record.full_name}, округ ${record.district_number}`);
  }
  if (base.nomination_type !== record.nomination_type || base.party_id !== record.party_id) {
    throw new Error(`Тип выдвижения не совпадает: ${record.full_name}`);
  }
  if (base.status === record.status && base.status_history.some((event) => event.decision?.number === record.decision?.number)) return base;
  if (base.status === record.status && !record.decision) return base;

  const source = buildSource(record, context);
  const effectiveOn = record.decision?.decided_on ?? record.nominated_on;
  return candidateSchema.parse({
    ...base,
    status: record.status,
    status_as_of: effectiveOn,
    official_source: {
      title: source.title,
      url: source.url,
      accessed_at: context.fixture.observed_on,
      source_kind: source.source_kind,
    },
    sources: [...base.sources.filter((item) => item.id !== source.id), source],
    status_history: [...base.status_history, {
      id: `status-${base.id}-${record.status}-${effectiveOn}`,
      status: record.status,
      effective_on: effectiveOn,
      recorded_on: context.fixture.observed_on,
      source_ids: [source.id],
      decision: record.decision,
      note: record.decision ? "Статус подтверждён решением окружной избирательной комиссии" : "Статус подтверждён официальным реестром",
    }],
  });
}

export function fixtureChecksum(bytes: Buffer) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function countStatuses(candidates: Candidate[]): Record<CandidateStatus, number> {
  const result = Object.fromEntries(candidateStatusSchema.options.map((status) => [status, 0])) as Record<CandidateStatus, number>;
  for (const candidate of candidates) result[candidate.status] += 1;
  return result;
}

export const recordedFixtureAdapter: OfficialStatusAdapter = {
  id: "recorded-official-status-json-v1",
  parse(bytes) {
    return officialStatusFixtureSchema.parse(JSON.parse(bytes.toString("utf8")));
  },
  apply(candidate, record, context) {
    return applyOfficialStatusRecord(candidate, record, context);
  },
};
