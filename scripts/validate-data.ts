import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { collectUrls, dataRoot, loadAllData, readJson } from "./lib/load-data";
import { snapshotManifestSchema } from "../src/lib/schemas";
import { territoryBuildSchema, territoryReviewReportSchema, territorySearchEntrySchema } from "../src/lib/territories";
import { verifiedGeometryRegistrySchema } from "../src/lib/geometry";

const errors: string[] = [];
const fail = (message: string) => errors.push(message);

try {
  const { election, regions, parties, shards } = loadAllData();
  const partyIds = new Set(parties.map((party) => party.id));
  const districtNumbers = new Set<number>();
  const candidateIds = new Set<string>();
  const allCandidateIds = new Set(shards.flatMap((shard) => shard.candidates.map((candidate) => candidate.id)));

  const validateSnapshot = (snapshotDate: string) => {
    const snapshot = snapshotManifestSchema.parse(readJson(`snapshots/${snapshotDate}/manifest.json`));
    if (snapshot.as_of !== snapshotDate) fail(`Дата snapshot manifest ${snapshot.snapshot_id} не совпадает с ${snapshotDate}`);
    if (snapshot.record_counts.regions !== regions.length) fail(`${snapshot.snapshot_id}: неверное число регионов`);
    if (snapshot.record_counts.districts !== districtNumbers.size) fail(`${snapshot.snapshot_id}: неверное число округов`);
    if (snapshot.record_counts.candidates !== candidateIds.size) fail(`${snapshot.snapshot_id}: неверное число кандидатов`);
    for (const source of snapshot.sources) {
      if (!source.archived_path || !source.sha256) continue;
      const archived = path.join(process.cwd(), source.archived_path);
      if (!fs.existsSync(archived)) fail(`Архив источника не найден: ${source.archived_path}`);
      else {
        const actual = crypto.createHash("sha256").update(fs.readFileSync(archived)).digest("hex");
        if (actual !== source.sha256) fail(`Checksum snapshot-источника не совпадает: ${source.archived_path}`);
      }
    }
    return snapshot;
  };

  for (const shard of shards) {
    if (shard.region.id !== regions.find((region) => region.id === shard.region.id)?.id) fail(`Региональный shard ${shard.region.id} отсутствует в regions.json`);
    if (shard.region.district_count !== shard.districts.length) fail(`${shard.region.id}: district_count=${shard.region.district_count}, файлов=${shard.districts.length}`);
    const localDistricts = new Set(shard.districts.map((district) => district.number));
    for (const district of shard.districts) {
      if (districtNumbers.has(district.number)) fail(`Округ № ${district.number} встречается повторно`);
      districtNumbers.add(district.number);
      if (election.dataset_kind === "official" && !district.official_source.url) fail(`Округ № ${district.number}: нет URL официального источника`);
    }
    for (const candidate of shard.candidates) {
      if (candidateIds.has(candidate.id)) fail(`Duplicate candidate ID: ${candidate.id}`);
      candidateIds.add(candidate.id);
      if (!localDistricts.has(candidate.district_number)) fail(`${candidate.id}: отсутствует округ № ${candidate.district_number}`);
      if (candidate.party_id && !partyIds.has(candidate.party_id)) fail(`${candidate.id}: отсутствует партия ${candidate.party_id}`);
      if (candidate.synthetic !== (election.dataset_kind === "synthetic")) fail(`${candidate.id}: смешаны synthetic и official записи`);
      if (election.dataset_kind === "official" && !candidate.official_source.url) fail(`${candidate.id}: нет URL официального статуса`);
    }
    for (const resource of shard.resources) if (!allCandidateIds.has(resource.candidate_id)) fail(`Ресурс ссылается на отсутствующего кандидата ${resource.candidate_id}`);
    for (const item of shard.news) if (!allCandidateIds.has(item.candidate_id)) fail(`Новость ссылается на отсутствующего кандидата ${item.candidate_id}`);
  }

  if (districtNumbers.size !== election.expected_district_count) fail(`Всего округов ${districtNumbers.size}, ожидалось ${election.expected_district_count}`);
  if (election.dataset_kind === "official" && election.expected_district_count !== 225) fail("Официальный production-набор обязан содержать 225 округов");
  if (parties.some((party) => party.synthetic !== (election.dataset_kind === "synthetic"))) fail("Смешаны synthetic и official партии");

  const territoryBuild = territoryBuildSchema.parse(readJson("territories/districts.json"));
  const territorySearch = territorySearchEntrySchema.array().parse(readJson("territories/search-index.json"));
  const territoryReview = territoryReviewReportSchema.parse(readJson("territories/review-report.json"));
  const geometryRegistry = verifiedGeometryRegistrySchema.parse(readJson("geometry/verified-districts.json"));
  const territoryByNumber = new Map(territoryBuild.districts.map((district) => [district.district_number, district]));
  if (territorySearch.length !== districtNumbers.size) fail("Территориальный индекс не покрывает все округа");
  if (territoryReview.source_descriptions !== districtNumbers.size) fail("Отчёт территорий содержит неверное число исходных описаний");
  for (const shard of shards) for (const district of shard.districts) {
    const territory = territoryByNumber.get(district.number);
    if (!territory) fail(`Округ № ${district.number}: отсутствует структурированная территория`);
    else {
      if (territory.region_id !== shard.region.id) fail(`Округ № ${district.number}: неверная ссылка на регион`);
      if (territory.verbatim_source_text !== district.territory_description) fail(`Округ № ${district.number}: дословный текст расходится с shard`);
    }
  }
  const geometryDistricts = new Set<number>();
  for (const geometry of geometryRegistry.geometries) {
    if (!districtNumbers.has(geometry.district_number)) fail(`Геометрия ссылается на отсутствующий округ № ${geometry.district_number}`);
    if (geometryDistricts.has(geometry.district_number)) fail(`Повторная геометрия округа № ${geometry.district_number}`);
    geometryDistricts.add(geometry.district_number);
    const first = geometry.polygon[0];
    const last = geometry.polygon.at(-1);
    if (!last || first[0] !== last[0] || first[1] !== last[1]) fail(`Полигон округа № ${geometry.district_number} не замкнут`);
  }

  validateSnapshot(election.data_as_of);
  if (election.candidate_status_as_of && election.candidate_status_as_of !== election.data_as_of) validateSnapshot(election.candidate_status_as_of);

  const urls = collectUrls({ election, regions, parties, shards });
  for (const url of urls) if (new URL(url).hostname === "example.invalid") fail(`Запрещенный placeholder URL: ${url}`);

  const manifest = readJson(`raw/${election.data_as_of}/manifest.json`) as { dataset_kind?: string; source?: { file?: string; sha256?: string | null } };
  if (manifest.dataset_kind !== election.dataset_kind) fail("Тип manifest не совпадает с election.dataset_kind");
  if (election.dataset_kind === "official") {
    const file = manifest.source?.file;
    const expected = manifest.source?.sha256;
    if (!file || !expected) fail("Официальный manifest обязан содержать file и sha256");
    else {
      const bytes = fs.readFileSync(path.join(dataRoot, `raw/${election.data_as_of}`, file));
      const actual = crypto.createHash("sha256").update(bytes).digest("hex");
      if (actual !== expected) fail(`Checksum не совпадает: ${file}`);
    }
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

if (errors.length) {
  console.error("\nПроверка данных не пройдена:\n" + errors.map((error) => `  • ${error}`).join("\n"));
  process.exit(1);
}
console.log("Данные валидны: структура, ссылки, totals и provenance согласованы.");
