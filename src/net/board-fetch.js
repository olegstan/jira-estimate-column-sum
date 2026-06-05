/**
 * board-fetch.js — самостоятельный забор данных доски через REST.
 *
 * Зачем не сканируем кэш: ответы board API отдаются с заголовком
 * `Cache-Control: no-store, no-cache`, поэтому браузер их НИГДЕ не сохраняет
 * (нет ни Cache Storage, ни service worker, ни записи в localStorage/IndexedDB).
 * После загрузки данные живут только в памяти приложения. Значит «забрать из
 * кэша» нельзя — надёжнее повторно запросить тот же GET самим: раз no-store,
 * сервер всегда отдаёт свежий ответ, запрос дешёвый и идемпотентный.
 *
 * Источник единый для обоих типов досок (CMP и TMP) и любого поля оценки
 * (timeoriginalestimate, story points и т.п.):
 *   GET /rest/greenhopper/1.0/xboard/work/allData.json?rapidViewId={boardId}
 *
 * Возвращает { source, payload } или null. Разбор payload — в board-api.js.
 */
(function (NS) {
  "use strict";

  const TAG = "[jira-ext]";

  function boardId() {
    const m = location.pathname.match(/\/boards\/(\d+)/) ||
              location.search.match(/[?&]rapidView=(\d+)/);
    return m ? m[1] : null;
  }

  async function fetchBoard() {
    const id = boardId();
    if (!id) {
      console.warn(TAG, "boardId не найден в URL — REST-запрос пропущен");
      return null;
    }
    const url = "/rest/greenhopper/1.0/xboard/work/allData.json?rapidViewId=" +
                encodeURIComponent(id);
    let res;
    try {
      res = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
    } catch (e) {
      console.warn(TAG, "✗ сетевая ошибка allData.json:", e);
      return null;
    }
    if (!res.ok) {
      console.warn(TAG, "✗ allData.json вернул", res.status, "для доски", id);
      return null;
    }
    const payload = await res.json().catch(() => null);
    if (!payload) {
      console.warn(TAG, "✗ не разобрал JSON allData.json");
      return null;
    }
    console.log(TAG, "✓ забрал board data REST-запросом allData.json | доска", id);
    return { source: "REST:allData.json#" + id, payload };
  }

  /**
   * Догрузка потраченного (logged) времени по задачам. В allData.json его нет —
   * там только оценка (estimateStatistic, обычно timeoriginalestimate). Реальный
   * timespent берём поиском по ключам через /rest/api/3/search/jql пачками.
   * @param {string[]} keys ключи задач ("WS-101", ...)
   * @returns {Promise<Map<string, number>>} key → потраченные секунды (только >0)
   */
  async function fetchSpent(keys) {
    const map = new Map();
    if (!Array.isArray(keys) || !keys.length) return map;

    const BATCH = 100;
    for (let i = 0; i < keys.length; i += BATCH) {
      const chunk = keys.slice(i, i + BATCH);
      const body = {
        jql: "key in (" + chunk.join(",") + ")",
        fields: ["timespent"],
        maxResults: chunk.length
      };
      let res;
      try {
        res = await fetch("/rest/api/3/search/jql", {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      } catch (e) {
        console.warn(TAG, "✗ сетевая ошибка search/jql:", e);
        continue;
      }
      if (!res.ok) {
        console.warn(TAG, "✗ search/jql вернул", res.status);
        continue;
      }
      const data = await res.json().catch(() => null);
      const list = data && Array.isArray(data.issues) ? data.issues : [];
      for (const issue of list) {
        const sec = issue.fields && issue.fields.timespent;
        if (sec) map.set(issue.key, sec);
      }
    }
    return map;
  }

  NS.boardFetch = { fetch: fetchBoard, fetchSpent, boardId };
})(window.JES = window.JES || {});
