# Статическая доставка

Проект использует `output: "export"` и один build-time base path — `NEXT_PUBLIC_BASE_PATH`. Для корневого сайта переменная пустая; для GitHub Pages project site задаётся `/civicmap`. `assetPrefix` намеренно не используется.

Публичные данные генерируются командой `pnpm data:public`. Клиентский поиск загружает только `public/data/search-index.json` через централизованный `withBasePath()`. В `out/` не допускаются исходные архивы, DOCX и ZIP.

## Бюджеты

| Артефакт | Raw-бюджет |
|---|---:|
| `search/index.html` | 250 KB |
| `data/search-index.json` | 800 KB |

Проверка: `pnpm static:check` для корня или `pnpm static:check:subpath` для `/civicmap`. Отчёт сохраняется в `data/reports/static-artifacts.json`.

Локальный просмотр экспорта: `pnpm static:serve`. Для subpath в PowerShell: `$env:STATIC_BASE_PATH='/civicmap'; pnpm static:serve`.
