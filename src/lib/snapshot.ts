import {
  candidateDiffSchema,
  candidateSnapshotSchema,
  type Candidate,
  type CandidateDiff,
  type CandidateSnapshot,
} from "./schemas";

const comparableFields = [
  "full_name",
  "birth_date",
  "district_number",
  "nomination_type",
  "party_id",
  "status",
  "status_as_of",
  "status_history",
] as const satisfies readonly (keyof Candidate)[];

function compareIds(left: { candidate_id: string }, right: { candidate_id: string }) {
  return left.candidate_id.localeCompare(right.candidate_id, "en");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function parseCandidateSnapshot(value: unknown): CandidateSnapshot {
  return candidateSnapshotSchema.parse(value);
}

export function diffCandidateSnapshots(beforeInput: unknown, afterInput: unknown): CandidateDiff {
  const before = parseCandidateSnapshot(beforeInput);
  const after = parseCandidateSnapshot(afterInput);
  const beforeById = new Map(before.candidates.map((candidate) => [candidate.id, candidate]));
  const afterById = new Map(after.candidates.map((candidate) => [candidate.id, candidate]));

  const added = [...afterById.values()]
    .filter((candidate) => !beforeById.has(candidate.id))
    .map((candidate) => ({ candidate_id: candidate.id, status: candidate.status }))
    .sort(compareIds);
  const removed = [...beforeById.values()]
    .filter((candidate) => !afterById.has(candidate.id))
    .map((candidate) => ({ candidate_id: candidate.id, status: candidate.status }))
    .sort(compareIds);
  const changed = [...afterById.values()].flatMap((candidate) => {
    const previous = beforeById.get(candidate.id);
    if (!previous) return [];
    const changes = comparableFields.flatMap((field) => (
      canonical(previous[field]) === canonical(candidate[field])
        ? []
        : [{ field, before: previous[field], after: candidate[field] }]
    ));
    return changes.length ? [{ candidate_id: candidate.id, changes }] : [];
  }).sort(compareIds);

  return candidateDiffSchema.parse({
    schema_version: 1,
    before_snapshot_id: before.manifest.snapshot_id,
    after_snapshot_id: after.manifest.snapshot_id,
    added,
    removed,
    changed,
  });
}

export function serializeCandidateDiff(diff: CandidateDiff) {
  return `${JSON.stringify(diff, null, 2)}\n`;
}
