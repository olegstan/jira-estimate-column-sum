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

  NS.boardFetch = { fetch: fetchBoard, boardId };
})(window.JES = window.JES || {});
