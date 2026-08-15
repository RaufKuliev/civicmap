import Link from "next/link";
import { CircleHelp, Menu } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/">Гражданская карта</Link>
        <nav className="desktop-nav" aria-label="Основная навигация">
          <Link href="/address/">По адресу</Link>
          <Link href="/search/">Поиск</Link>
          <Link href="/changes/">Изменения</Link>
          <Link href="/methodology/">Методология</Link>
          <Link href="/corrections/">Исправить данные</Link>
        </nav>
        <Link className="about-link" href="/methodology/"><CircleHelp size={20} /> О проекте</Link>
        <details className="mobile-menu">
          <summary aria-label="Открыть меню"><Menu size={24} /></summary>
          <nav aria-label="Мобильная навигация"><Link href="/address/">По адресу</Link><Link href="/search/">Поиск</Link><Link href="/changes/">Изменения</Link><Link href="/methodology/">Методология</Link><Link href="/corrections/">Исправить данные</Link></nav>
        </details>
      </div>
    </header>
  );
}
