import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscoveryExplorer } from "@/components/discovery-explorer";
import { candidateStatusSchema } from "@/lib/schemas";
import { getElection, getParties, getRegions } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { withBasePath } from "@/lib/paths";

export const metadata: Metadata = { title: "Поиск и фильтры" };

export default function SearchPage() {
  const election = getElection();
  return (
    <div className="shell content-page discovery-page">
      <header className="page-header"><div><h1>Поиск по каталогу</h1><p>Кандидаты, округа и регионы в одном списке.</p></div><div className="updated-box"><span>Статусы на</span><strong>{formatDate(election.candidate_status_as_of ?? election.data_as_of)}</strong></div></header>
      <p className="coverage-note">Решения комиссий подтверждены пока для 16 кандидатов в округах №201–202. Территориальные подписи доступны для 225 округов, но не заменяют юридические границы.</p>
      <Suspense fallback={<div className="empty-state">Загрузка фильтров…</div>}>
        <DiscoveryExplorer indexUrl={withBasePath("/data/search-index.json")} formAction={withBasePath("/search/")} regions={getRegions()} parties={getParties()} statuses={candidateStatusSchema.options} />
      </Suspense>
    </div>
  );
}
