# Fixtures — Jira request/response samples

Reference API responses for debugging the extractor. **We never commit real data
to git** (see `.gitignore`): raw dumps go into `fixtures/*.raw.json`, and only the
anonymized `*.sample.json` files make it into the repository.

## Data source for sums: `fetchBoardData`

```
GET /rest/boards/latest/board/{boardId}?operation=fetchBoardData&...
```

Example: `board-fetchBoardData.sample.json` (anonymized).

What we take from the response:

| Path                                   | Purpose                                              |
|----------------------------------------|------------------------------------------------------|
| `columns[].name`                       | Column name — matches the title shown on the board    |
| `columns[].issues[].key`               | Issue key (`WS-1394`) — cache key                     |
| `columns[].issues[].estimation`        | Estimate: `2h`, `1d`, `2h 30m`, `1d 2h 30m`, `0m`, `30m` |
| `columns[].issues[].estimationFieldId` | Confirms it is `timeoriginalestimate`                 |
| `columns[].issues[].isVisible`         | `false` → hidden by an active quick filter, not counted |
| `estimation.field.fieldId`             | Board's estimation field (`timeoriginalestimate`)     |

Completeness: the response contains **all** of the board's issues regardless of
scroll/virtualization, so the sum from `fetchBoardData` is exact. If an issue has
no `estimation`, it is "without time" (pink).

## Unusable source: `QuickFindActivitiesQuery`

```
POST /gateway/api/graphql?q=QuickFindActivitiesQuery
```

This is "recent activity" (the search dropdown). **Do not use it for sums:** it has
no estimation field, and its `statusCategory` (3 statuses) does not match the ~13
board columns.

## Anonymization

```
node tools/anonymize.mjs fixtures/board.raw.json fixtures/board-fetchBoardData.sample.json
```

The script replaces real names/emails/identifiers/avatars with deterministic
fictional ones (and people-named columns too). Details — in `tools/anonymize.mjs`.
