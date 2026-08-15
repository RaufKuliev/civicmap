import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowIcon } from "@/components/icons";
import { DataNotice } from "@/components/notice";
import { formatDate } from "@/lib/format";
import { getRegionShard, getRegions } from "@/lib/data";

export const dynamicParams = false;
export function generateStaticParams() { return getRegions().map((region) => ({ regionId: region.id })); }

export async function generateMetadata({ params }: { params: Promise<{ regionId: string }> }): Promise<Metadata> {
  const shard = getRegionShard((await params).regionId);
  return { title: shard?.region.name ?? "Регион" };
}

export default async function RegionPage({ params }: { params: Promise<{ regionId: string }> }) {
  const shard = getRegionShard((await params).regionId);
  if (!shard) notFound();
  return (
    <div className="shell content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки"><Link href="/">Главная</Link><span>/</span><span>{shard.region.name}</span></nav>
      <header className="page-header"><div><h1>{shard.region.name}</h1><p>{shard.region.federal_district}</p></div><div className="updated-box"><span>Проверено</span><strong>{formatDate(shard.region.data_as_of)}</strong></div></header>
      <DataNotice compact />
      <section className="content-section">
        <div className="section-title-row"><h2>Одномандатные округа</h2><span>{shard.districts.length} округов</span></div>
        <div className="district-list">
          {shard.districts.map((district) => {
            const count = shard.candidates.filter((candidate) => candidate.district_number === district.number).length;
            return <Link key={district.number} href={`/districts/${district.number}/`} className="district-row"><span className="district-number">№ {district.number}</span><span><strong>{district.name}</strong><small>{count} кандидатов · данные на {formatDate(district.data_as_of)}</small></span><ArrowIcon /></Link>;
          })}
        </div>
      </section>
    </div>
  );
}
