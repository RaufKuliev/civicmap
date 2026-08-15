import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <p>Гражданская карта — нейтральный справочный проект с открытой методологией.</p>
        <div><Link href="/methodology/">Методология</Link><Link href="/corrections/">Сообщить об ошибке</Link><a href="https://github.com/RaufKuliev/civicmap">Исходный код</a></div>
      </div>
    </footer>
  );
}
