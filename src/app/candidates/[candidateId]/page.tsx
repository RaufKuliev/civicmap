import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { StatusLabel } from "@/components/status-label";
import { DataNotice } from "@/components/notice";
import { formatDate } from "@/lib/format";
import { getAllShards, getCandidate, getPartyName } from "@/lib/data";
import { biographyFieldLabels, sourceClassLabels } from "@/lib/evidence";
import type { EvidenceSourceClass } from "@/lib/schemas";

function EvidenceMeta({ publisher, sourceClass, accessedOn }: { publisher: string; sourceClass: EvidenceSourceClass; accessedOn: string }) {
  return <div className="evidence-meta"><span className={`source-badge source-${sourceClass}`} data-source-class={sourceClass}>{sourceClassLabels[sourceClass]}</span><span>{publisher}</span><span>Проверено {formatDate(accessedOn)}</span></div>;
}

export const dynamicParams = false;
export function generateStaticParams() { return getAllShards().flatMap((shard) => shard.candidates.map((candidate) => ({ candidateId: candidate.id }))); }

export async function generateMetadata({ params }: { params: Promise<{ candidateId: string }> }): Promise<Metadata> {
  const result = getCandidate((await params).candidateId);
  return { title: result?.candidate.full_name ?? "Кандидат" };
}

export default async function CandidatePage({ params }: { params: Promise<{ candidateId: string }> }) {
  const result = getCandidate((await params).candidateId);
  if (!result) notFound();
  const { candidate, shard, district } = result;
  const resources = shard.resources.filter((item) => item.candidate_id === candidate.id);
  const news = shard.news.filter((item) => item.candidate_id === candidate.id);
  const queries = [`"${candidate.full_name}" новости`, `"${candidate.full_name}" ${shard.region.name}`, `"${candidate.full_name}" округ ${district.number}`];
  return (
    <div className="shell content-page">
      <nav className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><Link href={`/regions/${shard.region.id}/`}>{shard.region.name}</Link><span>/</span><Link href={`/districts/${district.number}/`}>Округ № {district.number}</Link></nav>
      <header className="candidate-header"><div><h1>{candidate.full_name}</h1><p>{getPartyName(candidate.party_id)}</p></div><StatusLabel status={candidate.status} /></header>
      <DataNotice compact />
      <div className="candidate-detail-grid">
        <div>
          <section className="content-section"><h2>Официальный статус</h2><dl className="facts"><div><dt>Статус</dt><dd><StatusLabel status={candidate.status} /></dd></div><div><dt>Дата рождения</dt><dd>{candidate.birth_date ? formatDate(candidate.birth_date) : "В источнике дата указана неполно"}</dd></div><div><dt>Актуален на</dt><dd>{formatDate(candidate.status_as_of)}</dd></div><div><dt>Округ</dt><dd><Link href={`/districts/${district.number}/`}>№ {district.number}, {district.name}</Link></dd></div><div><dt>Основание</dt><dd>{candidate.official_source.url ? <a href={candidate.official_source.url} target="_blank" rel="noreferrer">{candidate.official_source.title}</a> : candidate.official_source.title}</dd></div></dl></section>
          <section className="content-section"><div className="section-title-row"><h2>Проверенные сведения</h2></div>{candidate.biography.length ? <dl className="evidence-facts">{candidate.biography.map((item) => <div key={item.id}><dt>{biographyFieldLabels[item.field]}</dt><dd><strong>{item.value}</strong><EvidenceMeta publisher={item.evidence.publisher} sourceClass={item.evidence.source_class} accessedOn={item.evidence.accessed_on} /><a className="evidence-source-link" href={item.evidence.source_url} target="_blank" rel="noreferrer">Открыть подтверждение <ExternalLink size={14} /></a></dd></div>)}</dl> : <div className="empty-state"><strong>Биографические сведения ещё не проверены.</strong><p>Мы не переносим биографии из поисковой выдачи и не связываем однофамильцев автоматически.</p></div>}</section>
          <section className="content-section"><div className="section-title-row"><h2>Публичные контакты</h2></div>{candidate.contacts.length ? <div className="evidence-list">{candidate.contacts.map((item) => <div className="evidence-card" key={item.id}><strong>{item.label}</strong><p>{item.value}</p><EvidenceMeta publisher={item.evidence.publisher} sourceClass={item.evidence.source_class} accessedOn={item.evidence.accessed_on} /></div>)}</div> : <div className="empty-state"><strong>Проверенных публичных контактов нет.</strong><p>Личные номера и адреса проект не публикует; появятся только подтверждённые служебные контакты.</p></div>}</section>
          <section className="content-section"><div className="section-title-row"><h2>Подтвержденные ресурсы</h2></div>{resources.length ? <div className="evidence-list">{resources.map((resource) => <div className="evidence-card" key={resource.url}><a className="external-row" href={resource.url} target="_blank" rel="noreferrer">{resource.title}<ExternalLink size={17} /></a><EvidenceMeta publisher={resource.publisher} sourceClass={resource.source_class} accessedOn={resource.accessed_on} /><p className="verification-note">Как проверено: {resource.verification_method}</p></div>)}</div> : <div className="empty-state"><strong>Подтверждённых ресурсов пока нет.</strong><p>Это не означает, что сайт или аккаунты кандидата отсутствуют: редакция ещё не подтвердила связь.</p></div>}</section>
          <section className="content-section"><div className="section-title-row"><h2>Проверенные публикации</h2></div>{news.length ? <div className="evidence-list">{news.map((item) => <div className="evidence-card" key={item.id}><a className="external-row" href={item.url} target="_blank" rel="noreferrer">{item.title}<ExternalLink size={17} /></a><p>{item.relation}</p><EvidenceMeta publisher={item.publisher} sourceClass={item.source_class} accessedOn={item.accessed_at} /><small>Опубликовано {formatDate(item.published_at)}</small></div>)}</div> : <div className="empty-state"><strong>Проверенных публикаций пока нет.</strong><p>Отсутствие записей не означает отсутствие новостей: материалы добавляются после ручной проверки личности и содержания.</p></div>}</section>
        </div>
        <aside className="search-links"><h2>Искать новости</h2><p>Внешняя поисковая выдача может содержать сведения об однофамильцах.</p>{queries.map((query) => <a key={query} href={`https://www.google.com/search?q=${encodeURIComponent(query)}`} target="_blank" rel="noreferrer">{query}<ExternalLink size={16} /></a>)}</aside>
      </div>
    </div>
  );
}
