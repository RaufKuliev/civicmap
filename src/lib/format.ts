import type { CandidateStatus } from "./schemas";

export const statusLabels: Record<CandidateStatus, string> = {
  nominated: "Выдвинут",
  certified_list: "В заверенном списке",
  registered: "Зарегистрирован",
  registration_denied: "Отказано в регистрации",
  registration_cancelled: "Регистрация отменена",
  withdrawn: "Снял кандидатуру",
  lost_status: "Утратил статус",
  elected: "Избран",
  not_elected: "Не избран",
  status_pending_verification: "Статус уточняется",
};

export const inactiveStatuses: CandidateStatus[] = [
  "registration_denied",
  "registration_cancelled",
  "withdrawn",
  "lost_status",
  "not_elected",
];

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

export function normalizeSearch(value: string) {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").trim();
}
