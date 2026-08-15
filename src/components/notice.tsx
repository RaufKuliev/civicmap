import { Info } from "lucide-react";

export function DataNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`notice ${compact ? "notice-compact" : ""}`}>
      <Info aria-hidden="true" />
      <p><strong>Промежуточный срез.</strong> Основа — заверенные партийные списки на 18 июля 2026 года; отдельно добавлены 16 решений ОИК по округам №201–202. Для остальных кандидатов «в заверенном списке» не означает «зарегистрирован».</p>
    </div>
  );
}
