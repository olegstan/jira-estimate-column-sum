# Fixtures — примеры запросов/ответов Jira

Эталонные ответы API для отладки extractor'а. **Реальные данные в гит не коммитим**
(см. `.gitignore`): сырые дампы кладём в `fixtures/*.raw.json`, а в репозиторий
попадают только обезличенные `*.sample.json`.

## Источник данных для сумм: `fetchBoardData`

```
GET /rest/boards/latest/board/{boardId}?operation=fetchBoardData&...
```

Пример: `board-fetchBoardData.sample.json` (обезличенный).

Что берём из ответа:

| Путь                                   | Назначение                                         |
|----------------------------------------|----------------------------------------------------|
| `columns[].name`                       | Имя колонки — совпадает с названием на доске        |
| `columns[].issues[].key`               | Ключ задачи (`WS-1394`) — ключ кэша                 |
| `columns[].issues[].estimation`        | Оценка: `2h`, `1d`, `2h 30m`, `1d 2h 30m`, `0m`, `30m` |
| `columns[].issues[].estimationFieldId` | Подтверждает, что это `timeoriginalestimate`        |
| `columns[].issues[].isVisible`         | `false` → скрыта активным quick-фильтром, не считаем |
| `estimation.field.fieldId`             | Поле оценки доски (`timeoriginalestimate`)          |

Полнота: ответ содержит **все** задачи доски независимо от скролла/виртуализации,
поэтому сумма по `fetchBoardData` точная. Если у задачи нет `estimation` — она «без
времени» (розовая).

## Непригодный источник: `QuickFindActivitiesQuery`

```
POST /gateway/api/graphql?q=QuickFindActivitiesQuery
```

Это «недавняя активность» (выпадашка поиска). **Не использовать для сумм:**
нет поля оценки и `statusCategory` (3 статуса) не соответствует ~13 колонкам доски.

## Обезличивание

```
node tools/anonymize.mjs fixtures/board.raw.json fixtures/board-fetchBoardData.sample.json
```

Скрипт заменяет реальные имена/почты/идентификаторы/аватары на детерминированные
вымышленные (и колонки-имена людей тоже). Подробности — в `tools/anonymize.mjs`.
