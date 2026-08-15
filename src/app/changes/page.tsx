import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { StatusLabel } from "@/components/status-label";
import { formatDate } from "@/lib/format";
import type { CandidateStatus } from "@/lib/schemas";

export const metadata: Metadata = { title: "Изменения данных" };

type ChangeReport = { before_snapshot_id: string; after_snapshot_id: string; added: unknown[]; removed: unknown[]; status_changes: Array<{ candidate_id: string; full_name: string; district_number: number; before_status: CandidateStatus; after_status: CandidateStatus; effective_on: string; decision: { number: string } | null; source: { title: string; url: string | null } | null }> };

export default function ChangesPage() {
  const report = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "changes", "2026-07-18--2026-08-14.json"), "utf8")) as ChangeReport;
  return (
    <div className="shell content-page changes-page">
      <header className="page-header"><div><h1>Изменения данных</h1><p>Сравнение срезов 18 июля и 14 августа 2026 года.</p></div><div className="updated-box"><span>Изменено статусов</span><strong>{report.status_changes.length}</strong></div></header>
      <div className="change-summary"><span><strong>{report.added.length}</strong> добавлено</span><span><strong>{report.removed.length}</strong> удалено</span><span><strong>{report.status_changes.length}</strong> изменений статуса</span></div>
      <section className="content-section"><h2>Добавленные записи</h2><div className="empty-state">Между доступными срезами новых подтверждённых записей нет.</div></section>
      <section className="content-section"><h2>Удалённые записи</h2><div className="empty-state">Записи не удалялись. Исправления должны сохранять историю.</div></section>
      <section className="content-section"><h2>Изменения статусов</h2><div className="change-list">{report.status_changes.map((change) => <article key={change.candidate_id} className="change-row"><div><Link href={`/candidates/${change.candidate_id}/`}>{change.full_name}</Link><small>Округ №{change.district_number} · {formatDate(change.effective_on)}{change.decision ? ` · решение № ${change.decision.number}` : ""}</small></div><div className="status-transition"><StatusLabel status={change.before_status} /><span aria-hidden="true">→</span><StatusLabel status={change.after_status} /></div>{change.source?.url && <a className="source-link" href={change.source.url} target="_blank" rel="noreferrer">Источник <ExternalLink /></a>}</article>)}</div></section>
    </div>
  );
}
