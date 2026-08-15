"use client";

import MiniSearch, { type SearchResult } from "minisearch";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { expandDiscoveryDocument, type CompactDiscoveryDocument } from "@/lib/search";

type Document = { id: string; type: "region" | "district" | "candidate"; title: string; meta: string; href: string; searchable: string };

const typeLabels = { region: "Регион", district: "Округ", candidate: "Кандидат" };

export function SearchBox({ indexUrl, regions }: { indexUrl: string; regions: Array<{ id: string; name: string }> }) {
  const [query, setQuery] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(indexUrl, { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error(`search_index_${response.status}`);
      return response.json() as Promise<{ schema_version: number; documents: CompactDiscoveryDocument[] }>;
    }).then((payload) => {
      if (payload.schema_version !== 1) throw new Error("search_index_schema");
      const regionNames = new Map(regions.map((region) => [region.id, region.name]));
      setDocuments(payload.documents.map((item) => {
        const { id, type, title, meta, href, searchable } = expandDiscoveryDocument(item, regionNames);
        return { id, type, title, meta, href, searchable };
      }));
    }).catch((error) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setDocuments([]);
    });
    return () => controller.abort();
  }, [indexUrl, regions]);
  const miniSearch = useMemo(() => {
    const index = new MiniSearch<Document>({ fields: ["title", "searchable"], storeFields: ["type", "title", "meta", "href"], searchOptions: { prefix: true, fuzzy: 0.2, boost: { title: 2 } } });
    index.addAll(documents);
    return index;
  }, [documents]);
  const results = query.trim().length > 1 ? miniSearch.search(query).slice(0, 8) : [];

  return (
    <div className="search-wrap">
      <label className="sr-only" htmlFor="catalog-search">Поиск по каталогу</label>
      <div className="search-control">
        <Search aria-hidden="true" />
        <input id="catalog-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ФИО, номер округа или регион" autoComplete="off" />
        {query && <button className="search-clear" type="button" onClick={() => setQuery("")} aria-label="Очистить поиск"><X size={18} /></button>}
        <button className="search-button" type="button" aria-label="Перейти к поиску" onClick={() => document.getElementById("catalog-search")?.focus()}><Search aria-hidden="true" size={20} />Найти</button>
      </div>
      {query.trim().length > 1 && (
        <div className="search-results" role="region" aria-live="polite" aria-label="Результаты поиска">
          {results.length ? results.map((result: SearchResult) => (
            <Link key={`${result.type}-${result.id}`} href={String(result.href)} className="search-result" onClick={() => setQuery("")}>
              <span className="result-type">{typeLabels[result.type as keyof typeof typeLabels]}</span>
              <span><strong>{String(result.title)}</strong><small>{String(result.meta)}</small></span>
            </Link>
          )) : <p className="search-empty">Ничего не найдено. Попробуйте ФИО, номер округа или название региона.</p>}
        </div>
      )}
      <Link className="advanced-search-link" href={query.trim() ? `/search/?q=${encodeURIComponent(query.trim())}` : "/search/"}>Расширенный поиск и фильтры</Link>
    </div>
  );
}
