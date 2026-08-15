import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { candidateInputSchema } from "../src/lib/schemas";
import {
  applyOfficialStatusRecord,
  fixtureChecksum,
  officialStatusFixtureSchema,
} from "../scripts/lib/official-status-adapter";
import validCandidate from "./fixtures/valid-candidate.json";
import selfNomineeFixture from "./fixtures/official-self-nominee.json";

describe("official status adapter", () => {
  it("parses the recorded source deterministically", () => {
    const file = path.join(process.cwd(), "data", "raw", "2026-08-14", "official", "moscow-oik-201-202.json");
    const bytes = fs.readFileSync(file);
    const first = officialStatusFixtureSchema.parse(JSON.parse(bytes.toString("utf8")));
    const second = officialStatusFixtureSchema.parse(JSON.parse(bytes.toString("utf8")));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.records).toHaveLength(16);
    expect(fixtureChecksum(bytes)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("adds a dated decision-backed status to a party nominee", () => {
    const fixture = officialStatusFixtureSchema.parse({
      ...selfNomineeFixture,
      fixture_id: "party-status-test",
      records: [{
        ...selfNomineeFixture.records[0],
        candidate_id: validCandidate.id,
        full_name: validCandidate.full_name,
        birth_date: validCandidate.birth_date,
        district_number: validCandidate.district_number,
        nomination_type: "party",
        party_id: validCandidate.party_id,
      }],
    });
    const candidate = applyOfficialStatusRecord(validCandidate, fixture.records[0], {
      fixture,
      archivedPath: "tests/fixtures/official-self-nominee.json",
      fixtureSha256: crypto.createHash("sha256").update("party").digest("hex"),
    });
    expect(candidate.status).toBe("registered");
    expect(candidate.status_history.at(-1)?.decision).toMatchObject({ number: "1/1", decided_on: "2026-07-25" });
  });

  it("represents a self-nominee without a party", () => {
    const fixture = officialStatusFixtureSchema.parse(selfNomineeFixture);
    const candidate = applyOfficialStatusRecord(null, fixture.records[0], {
      fixture,
      archivedPath: "tests/fixtures/official-self-nominee.json",
      fixtureSha256: crypto.createHash("sha256").update("self").digest("hex"),
    });
    expect(candidate.nomination_type).toBe("self");
    expect(candidate.party_id).toBeNull();
    expect(candidate.id).toMatch(/^c225-self-/);
    expect(candidate.status_history.map((event) => event.status)).toEqual(["nominated", "registered"]);
  });

  it("rejects authoritative statuses without a decision", () => {
    const broken = {
      ...selfNomineeFixture,
      records: [{ ...selfNomineeFixture.records[0], decision: null }],
    };
    const result = officialStatusFixtureSchema.safeParse(broken);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path.join(".") === "records.0.decision")).toBe(true);
  });

  it("keeps versioned candidates valid after adaptation", () => {
    const fixture = officialStatusFixtureSchema.parse(selfNomineeFixture);
    const candidate = applyOfficialStatusRecord(null, fixture.records[0], {
      fixture,
      archivedPath: "tests/fixtures/official-self-nominee.json",
      fixtureSha256: crypto.createHash("sha256").update("valid").digest("hex"),
    });
    expect(candidateInputSchema.parse(candidate)).toEqual(candidate);
  });
});
