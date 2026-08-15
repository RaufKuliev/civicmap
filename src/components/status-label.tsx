import { statusLabels } from "@/lib/format";
import type { CandidateStatus } from "@/lib/schemas";

export function StatusLabel({ status }: { status: CandidateStatus }) {
  const tone = status === "registered" || status === "elected" ? "positive" : status === "status_pending_verification" || status === "nominated" || status === "certified_list" ? "pending" : "inactive";
  return <span className={`status status-${tone}`}><span aria-hidden="true" />{statusLabels[status]}</span>;
}
