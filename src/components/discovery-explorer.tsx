"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { useEffect } from "react";
import { RotateCcw, Search } from "lucide-react";
import { ArrowIcon } from "./icons";
import { StatusLabel } from "./status-label";
import { formatDate, statusLabels } from "@/lib/format";
import { expandDiscoveryDocument, searchDiscoveryDocuments, type CompactDiscoveryDocument, type DiscoveryDocument, type DiscoveryFilters } from "@/lib/search";
import type { CandidateStatus } from "@/lib/schemas";

const typeLabels = { region: "Регион", district: "Округ", candidate: "Кандидат" } as const;

type FilterState = {
  q: string;
  type: DiscoveryFilters["type"];
  region: string;
  party: string;
  nomination: DiscoveryFilters["nomination"];
  status: DiscoveryFilters["status"];
  evidence: DiscoveryFilters["evidence"];
  sort: DiscoveryFilters["sort"];
};

export function DiscoveryExplorer({ indexUrl, formAction, regions, parties, statuses }: {
  indexUrl: string;
  formAction: string;
  regions: Array<{ id: string; name: string }>;
  parties: Array<{ id: string; name: string }>;
  statuses: CandidateStatus[];
}) {
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<DiscoveryDocument[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const initialState: FilterState = {
    q: searchParams.get("q") ?? "",
    type: (searchParams.get("type") as FilterState["type"]) ?? "all",
    region: searchParams.get("region") ?? "",
    party: searchParams.get("party") ?? "",
    nomination: (searchParams.get("nomination") as FilterState["nomination"]) ?? "all",
    status: (searchParams.get("status") as FilterState["status"]) ?? "all",
    evidence: (searchParams.get("evidence") as FilterState["evidence"]) ?? "all",
    sort: (searchParams.get("sort") as FilterState["sort"]) ?? "relevance",
  };
  const [state, setState] = useState<FilterState>(initialState);
  const deferredState = useDeferredValue(state);
  const filters: DiscoveryFilters = useMemo(() => ({
    query: deferredState.q,
    type: deferredState.type,
    region: deferredState.region,
    party: deferredState.party,
    nomination: deferredState.nomination,
    status: deferredState.status,
    evidence: deferredState.evidence,
    sort: deferredState.sort,
  }), [deferredState]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(indexUrl, { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error(`search_index_${response.status}`);
      return response.json() as Promise<{ schema_version: number; documents: CompactDiscoveryDocument[] }>;
    }).then((payload) => {
      if (payload.schema_version !== 1) throw new Error("search_index_schema");
      const regionNames = new Map(regions.map((region) => [region.id, region.name]));
      setDocuments(payload.documents.map((document) => expandDiscoveryDocument(document, regionNames)));
    }).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(true);
    });
    return () => controller.abort();
  }, [indexUrl, regions]);
  const results = useMemo(() => documents ? searchDiscoveryDocuments(documents, filters) : [], [documents, filters]);

  function setFilter(name: string, value: string) {
    setState((current) => ({ ...current, [name]: value } as FilterState));
  }

  return (
    <form className="discovery" action={formAction} method="get">
      <div className="discovery-query">
        <Search aria-hidden="true" />
        <label className="sr-only" htmlFor="discovery-query">Поиск</label>
        <input id="discovery-query" name="q" value={filters.query} onChange={(event) => setFilter("q", event.target.value)} placeholder="ФИО, округ, регион или территория" />
      </div>
      <fieldset className="filter-grid">
        <legend className="sr-only">Фильтры каталога</legend>
        <label>Тип<select name="type" aria-label="Тип результата" defaultValue={filters.type} onChange={(event) => setFilter("type", event.target.value)}><option value="all">Все типы</option><option value="candidate">Кандидаты</option><option value="district">Округа</option><option value="region">Регионы</option></select></label>
        <label>Регион<select name="region" aria-label="Регион" defaultValue={filters.region} onChange={(event) => setFilter("region", event.target.value)}><option value="">Все регионы</option>{regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></label>
        <label>Выдвижение<select name="nomination" aria-label="Тип выдвижения" defaultValue={filters.nomination} onChange={(event) => setFilter("nomination", event.target.value)}><option value="all">Любое</option><option value="party">От партии</option><option value="self">Самовыдвижение</option></select></label>
        <label>Партия<select name="party" aria-label="Партия" defaultValue={filters.party} onChange={(event) => setFilter("party", event.target.value)}><option value="">Все партии</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>
        <label>Статус<select name="status" aria-label="Статус" defaultValue={filters.status} onChange={(event) => setFilter("status", event.target.value)}><option value="all">Все статусы</option>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
        <label>Основание<select name="evidence" aria-label="Основание статуса" defaultValue={filters.evidence} onChange={(event) => setFilter("evidence", event.target.value)}><option value="all">Любое</option><option value="decision">Есть решение комиссии</option><option value="nomination">Только выдвижение</option></select></label>
      </fieldset>
      <div className="results-toolbar">
        <strong aria-live="polite">Найдено: {results.length}</strong>
        <div><label>Сортировка <select name="sort" aria-label="Сортировка" defaultValue={filters.sort} onChange={(event) => setFilter("sort", event.target.value)}><option value="relevance">По релевантности</option><option value="name">По названию</option><option value="district">По номеру округа</option></select></label><button className="apply-filters" type="submit">Применить и сохранить ссылку</button><Link className="reset-filters" href="/search/"><RotateCcw />Сбросить</Link></div>
      </div>
      <div className="discovery-results">
        {!documents && !loadError && <div className="empty-state"><strong>Загружаем компактный индекс…</strong><p>Фильтры станут доступны через несколько мгновений.</p></div>}
        {loadError && <div className="empty-state"><strong>Индекс поиска не загрузился</strong><p>Проверьте соединение или повторите попытку. Данные не заменяются неполной выдачей.</p></div>}
        {documents && results.length ? results.slice(0, 250).map((result) => (
          <Link className="discovery-result" href={result.href} key={`${result.type}-${result.id}`}>
            <span className="result-type">{typeLabels[result.type]}</span>
            <span><strong>{result.title}</strong><small>{result.meta} · данные на {formatDate(result.dataAsOf)}</small></span>
            {result.status ? <StatusLabel status={result.status} /> : <span className="coverage-label">{result.type === "district" ? "границы требуют источника" : "справочная запись"}</span>}
            <ArrowIcon />
          </Link>
        )) : documents && <div className="empty-state"><strong>Ничего не найдено</strong><p>Измените запрос или сбросьте один из фильтров. Неизвестные данные не заменяются предположениями.</p></div>}
        {results.length > 250 && <p className="result-limit">Показаны первые 250 результатов из {results.length}. Уточните фильтры.</p>}
      </div>
    </form>
  );
}
