import Link from "next/link";

export default function NotFound() { return <div className="shell not-found"><span>404</span><h1>Страница не найдена</h1><p>Проверьте адрес или вернитесь к поиску по каталогу.</p><Link className="primary-link" href="/">На главную</Link></div>; }
