"use client";

import Link from "next/link";
import { ExternalLink, LocateFixed, Search } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { findTerritoryFallback, geocodeAddress, type AddressTerritory, type GeocoderResult } from "@/lib/geocoding";
import { matchVerifiedDistrict, type VerifiedGeometry } from "@/lib/geometry";

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; geocoded: GeocoderResult | null; exact: number | null; possible: AddressTerritory[]; note: string }
  | { kind: "error"; message: string; possible: AddressTerritory[] };

export function AddressLookup({ endpoint, territories, geometries }: { endpoint: string | null; territories: AddressTerritory[]; geometries: VerifiedGeometry[] }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<LookupState>({ kind: "idle" });
  const activeRequest = useRef<AbortController | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const local = findTerritoryFallback(query, territories).slice(0, 12);
    activeRequest.current?.abort();
    if (!endpoint) {
      setState({ kind: "result", geocoded: null, exact: null, possible: local, note: "Внешний геокодер отключён. Показано неточное совпадение по официальным названиям территорий." });
      return;
    }
    const controller = new AbortController();
    activeRequest.current = controller;
    setState({ kind: "loading" });
    try {
      const results = await geocodeAddress(query, { endpoint, minIntervalMs: 1100, cacheTtlMs: 300_000, timeoutMs: 8_000 }, controller.signal);
      const first = results[0] ?? null;
      if (!first) {
        setState({ kind: "result", geocoded: null, exact: null, possible: local, note: "Адрес не найден провайдером. Возможные округа ниже основаны только на текстовом совпадении." });
        return;
      }
      const geometryMatch = matchVerifiedDistrict([first.longitude, first.latitude], geometries);
      const geocodedFallback = findTerritoryFallback(`${query} ${first.displayName}`, territories).slice(0, 12);
      setState({ kind: "result", geocoded: first, exact: geometryMatch.exact, possible: geocodedFallback, note: geometryMatch.matches.length > 1 ? "Координата попала в несколько геометрий; точный округ не выбран." : geometryMatch.matches.some((match) => match.relation === "boundary") ? "Координата лежит на границе; точный округ не выбран." : "Для этой точки пока нет проверенной геометрии округа. Показаны возможные текстовые совпадения." });
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error && error.message === "input_too_short" ? "Введите не менее пяти символов." : "Геокодер временно недоступен. Ниже остаются локальные неточные совпадения.";
      setState({ kind: "error", message, possible: local });
    }
  }

  const possible = state.kind === "result" || state.kind === "error" ? state.possible : [];
  return <div className="address-tool">
    <form className="address-form" onSubmit={submit}>
      <label htmlFor="address-query">Адрес или населённый пункт</label>
      <div><LocateFixed aria-hidden="true" /><input id="address-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Например: Самара, Московское шоссе, 10" autoComplete="street-address" /><button disabled={state.kind === "loading"}><Search size={18} />{state.kind === "loading" ? "Проверяем…" : "Найти"}</button></div>
      <p>Адрес не сохраняется. Поиск запускается только после нажатия кнопки.</p>
    </form>
    {!endpoint && <div className="provider-state"><strong>Внешний геокодер отключён владельцем сайта.</strong><span>Доступен локальный поиск по официальным территориальным подписям.</span></div>}
    {state.kind === "error" && <div className="lookup-message lookup-error"><strong>Не удалось получить координаты</strong><p>{state.message}</p></div>}
    {state.kind === "result" && <div className="lookup-message"><strong>{state.exact ? `Точный округ № ${state.exact}` : "Точный округ не определён"}</strong><p>{state.note}</p>{state.geocoded && <small>Ответ геокодера: {state.geocoded.displayName}</small>}{state.exact && <Link href={`/districts/${state.exact}/`}>Открыть округ № {state.exact}</Link>}</div>}
    {possible.length > 0 && <section className="possible-districts"><h2>Возможные округа</h2><p>Это подсказки по названиям, а не проверка попадания адреса в границы.</p>{possible.map((item) => <Link key={item.districtNumber} href={`/districts/${item.districtNumber}/`}><span><strong>Округ № {item.districtNumber}</strong><small>{item.reviewRequired ? "Границы требуют проверки" : "Есть проверенная геометрия"}</small></span><ExternalLink size={16} /></Link>)}</section>}
    {(state.kind === "result" || state.kind === "error") && possible.length === 0 && <div className="empty-state"><strong>Даже неточного совпадения нет.</strong><p>Попробуйте добавить название региона или города. Проект не будет назначать округ без подтверждения.</p></div>}
  </div>;
}
