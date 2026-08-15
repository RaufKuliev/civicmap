import Link from "next/link";
import { Clock3, FileText } from "lucide-react";
import { ArrowIcon } from "@/components/icons";
import { SearchBox } from "@/components/search-box";
import { DataNotice } from "@/components/notice";
import { RegionMap } from "@/components/region-map";
import { formatDate } from "@/lib/format";
import { getElection, getRegions } from "@/lib/data";
import { withBasePath } from "@/lib/paths";

export default function Home() {
  const election = getElection();
  const regions = getRegions();
  const federalDistricts = new Map<string, typeof regions>();
  for (const region of regions) federalDistricts.set(region.federal_district, [...(federalDistricts.get(region.federal_district) ?? []), region]);

  return (
    <>
      <section className="hero-section">
        <div className="hero-map-lines" aria-hidden="true" />
        <div className="shell hero-inner">
          <h1>Найдите свой округ и кандидатов</h1>
          <p className="hero-copy">Справочная информация об одномандатных избирательных округах Российской Федерации и кандидатах.</p>
          <SearchBox indexUrl={withBasePath("/data/search-index.json")} regions={regions.map(({ id, name }) => ({ id, name }))} />
          <p className="freshness"><Clock3 size={20} />Данные обновлены {formatDate(election.data_as_of)}</p>
        </div>
      </section>

      <section className="regions-section shell" id="regions">
        <div className="section-title-row"><h2>Выберите регион</h2><span>{regions.length} регионов · {election.expected_district_count} округов</span></div>
        <div className="regions-layout">
          <aside className="federal-list" aria-label="Федеральные округа">
            <div className="federal-active"><span>Все регионы</span><strong>{regions.length}</strong></div>
            {[...federalDistricts.entries()].map(([name, items]) => <div key={name}><span>{name}</span><strong>{items.length}</strong></div>)}
            <Link className="method-link" href="/methodology/"><FileText size={18} />Методология формирования округов</Link>
          </aside>
          <div className="region-table">
            <div className="table-head"><span>Регион</span><span>Округов</span><span /></div>
            {regions.map((region) => (
              <Link href={`/regions/${region.id}/`} className="region-row" key={region.id}>
                <strong>{region.name.replace(/^Город /, "")}</strong><span>{region.district_count}</span><ArrowIcon />
              </Link>
            ))}
          </div>
          <div className="map-panel">
            <div className="map-title"><span>Карта регионов</span><small>Нажмите на регион</small></div>
            <RegionMap />
            <p>Навигационный слой Natural Earth, а не официальная карта границ округов. В спорных вопросах карта отражает модель исходного набора геоданных.</p>
          </div>
        </div>
        <DataNotice />
      </section>
    </>
  );
}
