# Операции и выпуск

## Обновление данных

Большой исходный GeoJSON Natural Earth не хранится в Git. Перед полным импортом загрузить и проверить его зафиксированную версию командой `pnpm data:fetch:map`; скрипт принимает файл только при совпадении SHA-256.

1. Сохранить первичный файл и URL в датированной raw-папке.
2. Зафиксировать SHA-256 в manifest.
3. Запустить соответствующий import в dry-run, проверить report и только затем apply.
4. Выполнить validation, coverage, snapshot diff, unit и browser checks.

## Выпуск

Проверить `RELEASE_CHECKLIST.md`, выполнить root и `/civicmap` export, `pnpm release:audit`, static link checker и browser suite против `out/`. Pages workflow собирает artifact и публикует его после push в `main`.

## Откат

Вернуться к предыдущему проверенному commit, пересобрать export тем же base path и повторить static/browser проверки. Данные не исправляются ручным редактированием `out/`; откат выполняется из версионированного snapshot/import.

## Custom domain

Добавлять `CNAME` только после подтверждения владельцем домена, DNS и HTTPS. До решения используется project-site path `/civicmap`.
