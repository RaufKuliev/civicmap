import type { Candidate, NewsItem, Resource } from "./schemas";

export type EvidenceIssueCode = "duplicate_url" | "invalid_url" | "stale_item";
export type EvidenceIssue = { code: EvidenceIssueCode; record_id: string; detail: string };

type EvidenceRecord = {
  id: string;
  scope?: string;
  url: string;
  publishedOn: string | null;
  qualityTier: "primary_official" | "primary_controlled" | "secondary_editorial";
};

export function normalizeEvidenceUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|yclid|gclid)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}

export function analyzeEvidence(records: EvidenceRecord[], asOf: string) {
  const issues: EvidenceIssue[] = [];
  const seen = new Map<string, string>();
  const asOfTime = Date.parse(`${asOf}T12:00:00Z`);
  for (const record of [...records].sort((a, b) => a.id.localeCompare(b.id))) {
    let normalized: string;
    try {
      normalized = normalizeEvidenceUrl(record.url);
    } catch {
      issues.push({ code: "invalid_url", record_id: record.id, detail: record.url });
      continue;
    }
    const duplicateKey = `${record.scope ?? "all"}|${normalized}`;
    const duplicateOf = seen.get(duplicateKey);
    if (duplicateOf) issues.push({ code: "duplicate_url", record_id: record.id, detail: duplicateOf });
    else seen.set(duplicateKey, record.id);
    if (record.qualityTier === "secondary_editorial" && record.publishedOn) {
      const ageDays = Math.floor((asOfTime - Date.parse(`${record.publishedOn}T12:00:00Z`)) / 86_400_000);
      if (ageDays > 365) issues.push({ code: "stale_item", record_id: record.id, detail: `${ageDays} days` });
    }
  }
  return issues;
}

export function collectEvidenceRecords(candidates: Candidate[], resources: Resource[], news: NewsItem[]): EvidenceRecord[] {
  return [
    ...candidates.flatMap((candidate) => [
      ...candidate.biography.map((item) => ({ id: `biography:${candidate.id}:${item.id}`, scope: "biography", url: item.evidence.source_url, publishedOn: item.evidence.published_on, qualityTier: item.evidence.quality_tier })),
      ...candidate.contacts.map((item) => ({ id: `contact:${candidate.id}:${item.id}`, scope: "contact", url: item.evidence.source_url, publishedOn: item.evidence.published_on, qualityTier: item.evidence.quality_tier })),
    ]),
    ...resources.map((item) => ({ id: `resource:${item.candidate_id}:${item.url}`, scope: "resource", url: item.url, publishedOn: item.published_on, qualityTier: item.quality_tier })),
    ...news.map((item) => ({ id: `news:${item.id}`, scope: "news", url: item.url, publishedOn: item.published_at, qualityTier: item.quality_tier })),
  ];
}

export const sourceClassLabels = {
  election_authority: "Избирательная комиссия",
  government_official: "Официальный государственный источник",
  candidate_controlled: "Ресурс кандидата",
  party_controlled: "Ресурс партии",
  independent_media: "Независимое СМИ",
} as const;

export const biographyFieldLabels = {
  current_role: "Текущая публичная роль",
  education: "Образование",
  experience: "Опыт",
  public_office: "Публичная должность",
} as const;
