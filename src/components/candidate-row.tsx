import Link from "next/link";
import { ArrowIcon } from "./icons";
import { StatusLabel } from "./status-label";
import { getPartyName } from "@/lib/data";
import type { Candidate } from "@/lib/schemas";

export function CandidateRow({ candidate }: { candidate: Candidate }) {
  return (
    <Link href={`/candidates/${candidate.id}/`} className="candidate-row">
      <span><strong>{candidate.full_name}</strong><small>{getPartyName(candidate.party_id)}</small></span>
      <StatusLabel status={candidate.status} />
      <ArrowIcon />
    </Link>
  );
}
