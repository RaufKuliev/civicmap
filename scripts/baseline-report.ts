import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadAllData, projectRoot } from "./lib/load-data";

function walk(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function bytes(files: string[]) {
  return files.reduce((total, file) => total + fs.statSync(file).size, 0);
}

function checksum(file: string) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const { election, regions, shards } = loadAllData();
const dataFiles = walk(path.join(projectRoot, "data"));
const regionJsonFiles = dataFiles.filter((file) => file.includes(`${path.sep}regions${path.sep}`) && file.endsWith(".json"));
const rawFiles = dataFiles.filter((file) => file.includes(`${path.sep}raw${path.sep}`));
const sourceFiles = rawFiles.filter((file) => file.includes(`${path.sep}sources${path.sep}`));
const districts = shards.flatMap((shard) => shard.districts);
const candidates = shards.flatMap((shard) => shard.candidates);

const report = {
  schema_version: 1,
  generated_for_snapshot: election.data_as_of,
  counts: {
    regions: regions.length,
    districts: districts.length,
    candidates: candidates.length,
    region_json_files: regionJsonFiles.length,
    raw_files: rawFiles.length,
  },
  bytes: {
    region_json: bytes(regionJsonFiles),
    raw: bytes(rawFiles),
  },
  source_sha256: Object.fromEntries(
    sourceFiles.sort().map((file) => [path.relative(projectRoot, file).replaceAll("\\", "/"), checksum(file)]),
  ),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
