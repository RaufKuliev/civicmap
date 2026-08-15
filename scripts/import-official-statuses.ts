import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { candidateInputSchema, snapshotManifestSchema, type Candidate } from "../src/lib/schemas";
import {
  candidateLookupKey,
  countStatuses,
  fixtureChecksum,
  recordedFixtureAdapter,
} from "./lib/official-status-adapter";

const dataRoot = path.join(process.cwd(), "data");
const defaultFixture = path.join(dataRoot, "raw", "2026-08-14", "official", "moscow-oik-201-202.json");

function sha256(bytes: Buffer | string) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function stableJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function relativeToProject(filePath: string) {
  return path.relative(process.cwd(), filePath).replaceAll("\\", "/");
}

function candidateFiles() {
  return fs.readdirSync(path.join(dataRoot, "regions"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dataRoot, "regions", entry.name, "candidates.json"))
    .sort();
}

export function prepareOfficialStatusImport(fixturePath: string) {
  const fixtureBytes = fs.readFileSync(fixturePath);
  const fixture = recordedFixtureAdapter.parse(fixtureBytes);
  const archivedPath = relativeToProject(fixturePath);
  const fixtureSha256 = fixtureChecksum(fixtureBytes);
  const files = candidateFiles();
  const rawByFile = new Map<string, unknown[]>();
  const fileByCandidateId = new Map<string, string>();
  const fileByLookupKey = new Map<string, string>();
  const districtFile = new Map<number, string>();

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown[];
    rawByFile.set(file, raw);
    for (const item of raw) {
      const candidate = candidateInputSchema.parse(item);
      fileByCandidateId.set(candidate.id, file);
      fileByLookupKey.set(candidateLookupKey(candidate.full_name, candidate.district_number), file);
      districtFile.set(candidate.district_number, file);
    }
  }

  let created = 0;
  let changed = 0;
  let unchanged = 0;
  const touched = new Set<string>();
  const appliedCandidates: Candidate[] = [];

  for (const record of fixture.records) {
    const lookup = candidateLookupKey(record.full_name, record.district_number);
    const file = (record.candidate_id && fileByCandidateId.get(record.candidate_id)) ?? fileByLookupKey.get(lookup) ?? districtFile.get(record.district_number);
    if (!file) throw new Error(`Не найден региональный файл для округа № ${record.district_number}`);
    const raw = rawByFile.get(file)!;
    const index = raw.findIndex((item) => {
      const candidate = candidateInputSchema.parse(item);
      return (record.candidate_id && candidate.id === record.candidate_id) || candidateLookupKey(candidate.full_name, candidate.district_number) === lookup;
    });
    const before = index >= 0 ? raw[index] : null;
    const after = recordedFixtureAdapter.apply(before, record, { fixture, archivedPath, fixtureSha256 });
    if (index < 0) {
      raw.push(after);
      created += 1;
    } else if (stableJson(before) === stableJson(after)) {
      unchanged += 1;
    } else {
      raw[index] = after;
      changed += 1;
    }
    touched.add(file);
    appliedCandidates.push(after);
  }

  const allCandidates = [...rawByFile.values()].flatMap((items) => items.map((item) => candidateInputSchema.parse(item)));
  const beforeHashes = Object.fromEntries([...touched].sort().map((file) => [relativeToProject(file), sha256(fs.readFileSync(file))]));
  const afterHashes = Object.fromEntries([...touched].sort().map((file) => [relativeToProject(file), sha256(stableJson(rawByFile.get(file)))]));
  const report = {
    schema_version: 1,
    fixture_id: fixture.fixture_id,
    observed_on: fixture.observed_on,
    acquisition: fixture.acquisition,
    fixture_sha256: fixtureSha256,
    archived_path: archivedPath,
    mode: "offline-replay",
    records: fixture.records.length,
    changed,
    created,
    unchanged,
    touched_files: [...touched].sort().map(relativeToProject),
    before_sha256: beforeHashes,
    after_sha256: afterHashes,
    imported_status_counts: countStatuses(appliedCandidates),
  };

  return { fixture, fixtureSha256, archivedPath, rawByFile, touched, allCandidates, report };
}

function buildSnapshot(prepared: ReturnType<typeof prepareOfficialStatusImport>) {
  const previous = JSON.parse(fs.readFileSync(path.join(dataRoot, "snapshots", "2026-07-18", "manifest.json"), "utf8"));
  const districtCount = fs.readdirSync(path.join(dataRoot, "regions"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .reduce((sum, entry) => sum + (JSON.parse(fs.readFileSync(path.join(dataRoot, "regions", entry.name, "districts.json"), "utf8")) as unknown[]).length, 0);
  return snapshotManifestSchema.parse({
    schema_version: 1,
    snapshot_id: `duma-2026-${prepared.fixture.observed_on}`,
    election_id: "duma-2026",
    as_of: prepared.fixture.observed_on,
    created_on: prepared.fixture.observed_on,
    dataset_kind: "official",
    predecessor_snapshot_id: previous.snapshot_id,
    sources: [...previous.sources, ...prepared.fixture.source_pages.map((source) => ({
      ...source,
      source_kind: "commission_decision",
      published_on: null,
      accessed_on: prepared.fixture.observed_on,
      sha256: prepared.fixtureSha256,
      archived_path: prepared.archivedPath,
    }))],
    record_counts: {
      regions: fs.readdirSync(path.join(dataRoot, "regions"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).length,
      districts: districtCount,
      candidates: prepared.allCandidates.length,
    },
  });
}

function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fixtureArg = args.find((arg) => !arg.startsWith("--"));
  const fixturePath = path.resolve(fixtureArg ?? defaultFixture);
  try {
    const prepared = prepareOfficialStatusImport(fixturePath);
    if (apply) {
      for (const file of [...prepared.touched].sort()) fs.writeFileSync(file, stableJson(prepared.rawByFile.get(file)), "utf8");
      const reportDir = path.join(dataRoot, "import-reports");
      const snapshotDir = path.join(dataRoot, "snapshots", prepared.fixture.observed_on);
      fs.mkdirSync(reportDir, { recursive: true });
      fs.mkdirSync(snapshotDir, { recursive: true });
      fs.writeFileSync(path.join(reportDir, `${prepared.fixture.fixture_id}.json`), stableJson({ ...prepared.report, applied: true }), "utf8");
      fs.writeFileSync(path.join(snapshotDir, "manifest.json"), stableJson(buildSnapshot(prepared)), "utf8");
    }
    console.log(stableJson({ ...prepared.report, applied: apply }).trim());
  } catch (error) {
    console.error(`IMPORT_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

main();
