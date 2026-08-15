import fs from "node:fs";
import path from "node:path";
import { loadAllData } from "./lib/load-data";

const { shards } = loadAllData();
const statusChanges = shards.flatMap((shard) => shard.candidates.flatMap((candidate) => {
  if (candidate.status_history.length < 2) return [];
  const before = candidate.status_history.at(-2)!;
  const after = candidate.status_history.at(-1)!;
  const source = candidate.sources.find((item) => after.source_ids.includes(item.id));
  return [{
    candidate_id: candidate.id,
    full_name: candidate.full_name,
    district_number: candidate.district_number,
    region_id: shard.region.id,
    before_status: before.status,
    after_status: after.status,
    effective_on: after.effective_on,
    decision: after.decision,
    source: source ? { title: source.title, url: source.url } : null,
  }];
})).sort((left, right) => left.district_number - right.district_number || left.full_name.localeCompare(right.full_name, "ru"));

const report = {
  schema_version: 1,
  before_snapshot_id: "duma-2026-2026-07-18",
  after_snapshot_id: "duma-2026-2026-08-14",
  generated_on: "2026-08-14",
  added: [],
  removed: [],
  status_changes: statusChanges,
};
const output = path.join(process.cwd(), "data", "changes", "2026-07-18--2026-08-14.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Changes: added=0 removed=0 status_changed=${statusChanges.length}`);
