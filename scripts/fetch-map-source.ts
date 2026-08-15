import { createHash } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceUrl =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";
const expectedSha256 =
  "22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5";
const destination = path.join(
  process.cwd(),
  "data",
  "raw",
  "2026-08-14",
  "sources",
  "ne_10m_admin_1_states_provinces.geojson",
);
const temporary = `${destination}.download`;

async function main() {
  const response = await fetch(sourceUrl, {
    headers: { "User-Agent": "civic-map-source-fetch/0.1" },
  });
  if (!response.ok) {
    throw new Error(`Natural Earth download failed: HTTP ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `Natural Earth checksum mismatch: expected ${expectedSha256}, received ${actualSha256}`,
    );
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(temporary, bytes);
  await rm(destination, { force: true });
  await rename(temporary, destination);
  console.log(`Natural Earth source verified and saved: ${path.relative(process.cwd(), destination)}`);
}

main().catch(async (error: unknown) => {
  await rm(temporary, { force: true });
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
