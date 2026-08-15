import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CandidateRow } from "@/components/candidate-row";
import { DataNotice } from "@/components/notice";
import { formatDate, inactiveStatuses } from "@/lib/format";
import { getAllShards, getDistrict } from "@/lib/data";

export const dynamicParams = false;
export function generateStaticParams() { return getAllShards().flatMap((shard) => shard.districts.map((district) => ({ number: String(district.number) }))); }

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const result = getDistrict(Number((await params).number));
  return { title: result?.district.name ?? "Округ" };
}

export default async function DistrictPage({ params }: { params: Promise<{ number: string }> }) {
  const result = getDistrict(Number((await params).number));
  if (!result) notFound();
  const { district, shard } = result;
  const candidates = shard.candidates.filter((candidate) => candidate.district_number === district.number);
  const active = candidates.filter((candidate) => !inactiveStatuses.includes(candidate.status));
  const inactive = candidates.filter((candidate) => inactiveStatuses.includes(candidate.status));
  return (
    <div className="shell content-page">
      <nav className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><Link href={`/regions/${shard.region.id}/`}>{shard.region.name}</Link><span>/</span><span>Округ № {district.number}</span></nav>
      <header className="page-header district-header"><div><span className="overline">Одномандатный округ № {district.number}</span><h1>{district.name}</h1><p>{shard.region.name}</p></div><div className="updated-box"><span>Данные на</span><strong>{formatDate(district.data_as_of)}</strong></div></header>
      <DataNotice compact />
      <div className="detail-grid">
        <section className="content-section"><div className="section-title-row"><h2>Кандидаты</h2><span>{candidates.length} в текущем наборе</span></div><div className="candidate-list">{active.map((candidate) => <CandidateRow key={candidate.id} candidate={candidate} />)}</div>{inactive.length > 0 && <><h3 className="subsection-heading">Выбывшие и утратившие статус</h3><div className="candidate-list muted-list">{inactive.map((candidate) => <CandidateRow key={candidate.id} candidate={candidate} />)}</div></>}</section>
        <aside className="territory-box"><h2>Территория округа</h2><p>{district.territory_description}</p><dl><div><dt>Окружная комиссия</dt><dd>{district.electoral_commission ?? "Не указана в источнике"}</dd></div><div><dt>Геометрия</dt><dd>Не опубликована в машиночитаемом виде</dd></div><div><dt>Источник</dt><dd>{district.official_source.url ? <a href={district.official_source.url} target="_blank" rel="noreferrer">{district.official_source.title}</a> : district.official_source.title}</dd></div></dl></aside>
      </div>
    </div>
  );
}
