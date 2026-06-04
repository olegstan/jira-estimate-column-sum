/**
 * anonymize.mjs — обезличивание дампа ответа Jira fetchBoardData.
 *
 *   node tools/anonymize.mjs <input.json> [output.json]
 *
 * Заменяет на детерминированные вымышленные значения:
 *   - displayName / emailAddress / accountId / userKey людей из data.people;
 *   - те же идентификаторы во всех issue (assigneeKey/assigneeAccountId);
 *   - токены имён (напр. колонка-статус «Олег» → «Сотрудник 1»);
 *   - avatarUrl / gravatar и любые e-mail в тексте.
 *
 * Логика расчёта оценок данные о людях не использует, поэтому обезличивание
 * не влияет на отладку extractor'а — меняются только PII-поля.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , inPath, outPath] = process.argv;
if (!inPath) {
  console.error("usage: node tools/anonymize.mjs <input.json> [output.json]");
  process.exit(1);
}

const FIRST = ["Алексей", "Борис", "Виктор", "Галина", "Дмитрий", "Егор", "Жанна", "Зоя", "Игорь", "Ксения"];
const LAST = ["Смирнов", "Кузнецов", "Попов", "Соколова", "Лебедев", "Новиков", "Морозова", "Волков", "Зайцев", "Орлова"];

const raw = readFileSync(inPath, "utf8");
const data = JSON.parse(raw);

// 1) Собираем реальные идентичности и строим замены.
const replacements = new Map(); // realString -> fakeString
let n = 0;
const people = (data.data && data.data.people) || data.people || {};
for (const key of Object.keys(people)) {
  const p = people[key];
  const first = FIRST[n % FIRST.length];
  const last = LAST[n % LAST.length];
  const fakeName = `${first} ${last}`;
  const fakeId = `acc${String(n + 1).padStart(4, "0")}`;
  const fakeKey = `user-${n + 1}`;
  const fakeEmail = `user${n + 1}@example.com`;

  if (p.displayName) {
    replacements.set(p.displayName, fakeName);
    // Токены имени: чтобы колонки/статусы вида «Олег», «Максим DEV» тоже сменились.
    for (const token of p.displayName.split(/\s+/)) {
      if (token.length > 2) replacements.set(token, first);
    }
  }
  if (p.emailAddress) replacements.set(p.emailAddress, fakeEmail);
  if (p.accountId) replacements.set(p.accountId, fakeId);
  if (p.userKey) replacements.set(p.userKey, fakeKey);
  n += 1;
}

// 2) Глобальная замена по сериализованному JSON (длинные строки — первыми).
let text = JSON.stringify(data);
const pairs = [...replacements.entries()].sort((a, b) => b[0].length - a[0].length);
for (const [from, to] of pairs) {
  text = text.split(from).join(to);
}

// 3) Зачищаем оставшиеся PII обобщённо: e-mail, gravatar/avatar-URL.
text = text
  .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "anon@example.com")
  .replace(/https:\/\/[^"]*(gravatar|avatar)[^"]*/gi, "https://example.com/avatar.png");

writeFileSync(outPath || inPath.replace(/\.json$/, ".sample.json"), text);
console.log(`anonymized ${replacements.size / 1} identities → ${outPath || "(sample)"}`);
