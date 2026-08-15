import fs from "node:fs";
import path from "node:path";
import { analyzeEvidence, collectEvidenceRecords } from "../src/lib/evidence";
import { loadAllData } from "./lib/load-data";

const { election, shards } = loadAllData();
const candidates = shards.flatMap((shard) => shard.candidates);
const resources = shards.flatMap((shard) => shard.resources);
const news = shards.flatMap((shard) => shard.news);
const records = collectEvidenceRecords(candidates, resources, news);
const evidenceAsOf = election.candidate_status_as_of ?? election.data_as_of;
const issues = analyzeEvidence(records, evidenceAsOf);
const report = {
  schema_version: 1,
  as_of: evidenceAsOf,
  records_checked: records.length,
  issue_counts: {
    duplicate_url: issues.filter((issue) => issue.code === "duplicate_url").length,
    invalid_url: issues.filter((issue) => issue.code === "invalid_url").length,
    stale_item: issues.filter((issue) => issue.code === "stale_item").length,
  },
  issues,
};

const reportPath = path.join(process.cwd(), "data", "reports", "evidence-quality.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Evidence quality · checked=${records.length} · duplicates=${report.issue_counts.duplicate_url} · invalid=${report.issue_counts.invalid_url} · stale=${report.issue_counts.stale_item}`);
if (report.issue_counts.invalid_url > 0 || report.issue_counts.duplicate_url > 0) process.exit(1);
