import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Исправить данные" };

export default function CorrectionsPage() {
  return <div className="shell prose-page"><nav className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Исправить данные</span></nav><h1>Исправить данные</h1><p className="lead">В публичной версии исправления будут проходить через открытый issue и проверку редактора.</p><section><h2>Что указать</h2><ol><li>Страницу кандидата или округа.</li><li>Что именно неверно или отсутствует.</li><li>Ссылку на первичный источник.</li><li>Дату, когда источник был доступен.</li></ol><p>До подключения GitHub-репозитория форма не отправляет данные: это намеренное безопасное пустое состояние.</p></section><Link className="primary-link" href="/methodology/">Открыть методологию</Link></div>;
}
