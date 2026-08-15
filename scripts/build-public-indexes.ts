import fs from "node:fs";
import path from "node:path";
import { getSearchDocuments } from "../src/lib/data";
import { compactDiscoveryDocument } from "../src/lib/search";

const outputDirectory = path.join(process.cwd(), "public", "data");
fs.mkdirSync(outputDirectory, { recursive: true });
const documents = getSearchDocuments().map(compactDiscoveryDocument);
const payload = `${JSON.stringify({ schema_version: 1, documents })}\n`;
const outputPath = path.join(outputDirectory, "search-index.json");
fs.writeFileSync(outputPath, payload);
console.log(`Public search index: ${documents.length} records, ${Buffer.byteLength(payload)} bytes`);
if (Buffer.byteLength(payload) > 800_000) throw new Error("Search index exceeds 800 KB raw budget");
