import fs from "node:fs";
import path from "node:path";
import { diffCandidateSnapshots, serializeCandidateDiff } from "../src/lib/snapshot";

const args = process.argv.slice(2);
function valueOf(flag: string, fallback: string) {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const beforePath = path.resolve(valueOf("--before", "tests/fixtures/snapshot-before.json"));
const afterPath = path.resolve(valueOf("--after", "tests/fixtures/snapshot-after.json"));
const before = JSON.parse(fs.readFileSync(beforePath, "utf8"));
const after = JSON.parse(fs.readFileSync(afterPath, "utf8"));
process.stdout.write(serializeCandidateDiff(diffCandidateSnapshots(before, after)));
