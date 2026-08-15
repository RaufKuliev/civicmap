import type { Metadata } from "next";
import Link from "next/link";
import { AddressLookup } from "@/components/address-lookup";
import { getTerritorySearchEntries, getVerifiedGeometryRegistry } from "@/lib/data";

export const metadata: Metadata = { title: "Найти округ по адресу" };

export default function AddressPage() {
  const endpoint = process.env.NEXT_PUBLIC_GEOCODER_ENDPOINT?.trim() || null;
  const territories = getTerritorySearchEntries().map((entry) => ({ districtNumber: entry.district_number, regionId: entry.region_id, terms: entry.terms, reviewRequired: entry.review_required }));
  const geometries = getVerifiedGeometryRegistry().geometries;
  return <div className="shell content-page address-page">
    <header className="page-header"><div><span className="overline">Адресный поиск</span><h1>Найти возможный округ</h1><p>Точный ответ появляется только при наличии проверенных границ.</p></div><div className="updated-box"><span>Проверенные геометрии</span><strong>{geometries.length} из 225</strong></div></header>
    <div className="coverage-note"><strong>Сейчас точное определение недоступно.</strong> В официальном наборе есть названия округов, но нет юридически проверенных полигонов. Сервис покажет только возможные совпадения и не станет выдавать их за точный результат.</div>
    <AddressLookup endpoint={endpoint} territories={territories} geometries={geometries} />
    <p className="osm-attribution">Геокодирование при включённом провайдере: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">участники OpenStreetMap</a>. <Link href="/methodology/">Как определяется точность</Link>.</p>
  </div>;
}
