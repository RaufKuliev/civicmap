import { describe, expect, it } from "vitest";
import before from "./fixtures/snapshot-before.json";
import after from "./fixtures/snapshot-after.json";
import { diffCandidateSnapshots, serializeCandidateDiff } from "../src/lib/snapshot";

describe("candidate snapshot diff", () => {
  it("reports additions, removals, and status changes", () => {
    const diff = diffCandidateSnapshots(before, after);
    expect(diff.added.map((item) => item.candidate_id)).toEqual(["candidate-added"]);
    expect(diff.removed.map((item) => item.candidate_id)).toEqual(["candidate-removed"]);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].changes.map((change) => change.field)).toEqual(
      expect.arrayContaining(["status", "status_as_of", "status_history"]),
    );
  });

  it("serializes deterministically", () => {
    const first = serializeCandidateDiff(diffCandidateSnapshots(before, after));
    const second = serializeCandidateDiff(diffCandidateSnapshots(before, after));
    expect(second).toBe(first);
    expect(first.endsWith("\n")).toBe(true);
  });
});
