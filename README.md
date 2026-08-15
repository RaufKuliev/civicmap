# CIVIC MAP · Гражданская карта

Нейтральный статический справочник по 225 одномандатным округам и кандидатам на выборах депутатов Государственной Думы 2026 года.

Срез содержит 89 регионов, 225 округов и 1 670 реальных кандидатов из заверенных партийных списков на 18 июля 2026 года. Для 16 кандидатов округов № 201–202 статусы регистрации дополнены решениями ОИК и актуальны на 14 августа 2026 года. Это промежуточный, а не окончательный перечень зарегистрированных кандидатов.

## Быстрый старт

Требования: Node.js 22, pnpm 11.17.0.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Откройте `http://localhost:3000`. Внешний адресный геокодер по умолчанию отключён; для локального low-traffic demo скопируйте `.env.example` в `.env.local` и укажите Nominatim-совместимый endpoint.

## Проверка

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm data:validate
pnpm data:coverage
pnpm build
pnpm static:check
```

Сборка GitHub Pages project site:

```powershell
$env:NEXT_PUBLIC_BASE_PATH='/civicmap'
pnpm build
pnpm static:check:subpath
```

## Данные и ограничения

- Партийный список подтверждает выдвижение, но не регистрацию.
- Юридически проверенных полигонов округов пока 0/225; адресный поиск не выдаёт текстовые совпадения за точный округ.
- Биографические сведения подтверждены для 4/1 670 кандидатов, служебный контакт — для 1/1 670, ресурсы — для 4/1 670, публикации — для 1/1 670.
- Исходные документы имеют checksum и provenance; публичный export не содержит raw-архивы.

Методология: [docs/data-methodology.md](docs/data-methodology.md). Источники и условия: [docs/sources-and-attribution.md](docs/sources-and-attribution.md). Политика адресного поиска: [docs/geocoding-policy.md](docs/geocoding-policy.md).

## Участие и выпуск

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [docs/corrections.md](docs/corrections.md)
- [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)

Код и оригинальные тексты распространяются по `AGPL-3.0-only`; сторонние источники сохраняют собственные условия. См. [LICENSE](LICENSE), [LICENSE-STATUS.md](LICENSE-STATUS.md) и [источники](docs/sources-and-attribution.md). Канонический репозиторий: https://github.com/RaufKuliev/civicmap.
