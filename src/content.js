/**
 * content.js — оркестратор. Источник данных: ответ Jira board API, перехваченный
 * в MAIN-мире (net/interceptor.js) и присланный сюда через postMessage.
 *
 * DOM при виртуализации отдаёт неполные/неверные оценки, поэтому из HTML мы их
 * НЕ читаем: суммы считаем из API, а DOM используем только чтобы разместить
 * баннер в шапке колонки и подсветить видимые карточки без оценки.
 *
 * Зависимости: estimate (часы) · store (кэш/итоги) · board (DOM) ·
 *              boardApi (разбор ответа) · settings (конфиг).
 */
(function (NS) {
  "use strict";

  const { estimate, board, boardApi, boardFetch, createStore, settings } = NS;
  const store = createStore();

  // Отладка: включена по умолчанию; выключить — localStorage['jiraext-debug']='0'.
  const DEBUG = (() => {
    try { return localStorage.getItem("jiraext-debug") !== "0"; } catch (e) { return true; }
  })();
  const log = (...a) => { if (DEBUG) console.log("[jira-ext]", ...a); };

  let lastPayload = null;
  let debounceTimer = null;
  let lastSignature = "";
  let lastFilterSig = "";

  // Объект для ручного осмотра из консоли: window.__jes
  window.__jes = {
    get lastPayload() { return lastPayload; },
    totals() { return Object.fromEntries(store.totalsByColumn()); },
    domColumns() { return [...board.columns()].map(board.columnName); },
    recalc() { runRecalc(); }
  };

  // ---- Применение данных из board API ---------------------------------------
  function applyBoardData(payload) {
    const issues = boardApi.normalize(payload);
    if (!issues) {
      log("payload is NOT board data (ни fetchBoardData, ни allData) — пропускаю", payload);
      return;
    }
    lastPayload = payload;

    store.clear();
    for (const issue of issues) {
      const hours = estimate.parse(issue.estimation, cfg);
      store.set(issue.key, issue.column, hours, hours > 0, issue.assignee);
    }
    log("применил данные API: задач(видимых) =", issues.length,
      "| колонки API:", [...store.totalsByColumn().keys()]);
    runRecalc();
    enrichSpent(issues.map((i) => i.key));
  }

  // Догрузка потраченного времени: в board API его нет (там только оценка),
  // поэтому timespent забираем отдельным REST-поиском по ключам и дописываем
  // в store. spentToken отсекает ответы для уже сменившейся доски.
  let spentToken = 0;
  function enrichSpent(keys) {
    if (!boardFetch || !boardFetch.fetchSpent) return;
    const token = ++spentToken;
    boardFetch.fetchSpent(keys).then((map) => {
      if (token !== spentToken) return; // доска успела смениться — ответ устарел
      map.forEach((sec, key) => store.setSpent(key, sec / 3600));
      log("догрузил потраченное время: задач с timespent =", map.size);
      runRecalc();
    }).catch((e) => log("ошибка догрузки timespent:", e));
  }

  // ---- Отрисовка из store ---------------------------------------------------
  function recalc() {
    if (!cfg.enabled) {
      board.cleanup();
      store.clear();
      return;
    }

    const totals = store.totalsByColumn(assigneeAccept());

    board.columns().forEach((column) => {
      const apiCol = resolveApiColumn(column);
      const t = totals.get(apiCol) || { hours: 0, noEst: 0, spent: 0, noSpent: 0 };

      const banner = board.ensureBanner(column);
      if (banner) {
        board.renderBanner(banner, t.hours, t.noEst, (h) => estimate.format(h, cfg), t.spent, t.noSpent);
      }

      // Красим только видимые карточки — по данным из store (не из DOM).
      board.cards(column).forEach((card) => {
        const entry = store.get(board.cardKey(card));
        if (entry) board.paintNoEstimate(card, !entry.hasEst);
      });
    });
  }

  // Сопоставляет DOM-колонку с колонкой из API.
  // Основной способ — по ключам карточек внутри (key → колонка из store):
  // это устойчиво к локализации/обрезке/регистру названия. Запасной — по имени.
  function resolveApiColumn(column) {
    const counts = new Map();
    board.cards(column).forEach((card) => {
      const entry = store.get(board.cardKey(card));
      if (entry && entry.col) counts.set(entry.col, (counts.get(entry.col) || 0) + 1);
    });

    let best = null;
    let bestN = 0;
    counts.forEach((n, col) => { if (n > bestN) { best = col; bestN = n; } });

    const name = board.columnName(column);
    const resolved = best || name; // нет видимых карточек (пустая колонка) → по имени
    if (DEBUG && best && best !== name) {
      log('колонка DOM "' + name + '" → API "' + best + '" (по ключам карточек)');
    }
    return resolved;
  }

  // ---- Фильтр по исполнителю (URL ?assignee=...) ----------------------------
  // Доска применяет фильтр по исполнителю клиентски через параметр(ы) URL, а
  // allData.json его не отражает. Поэтому суммы фильтруем сами: оставляем только
  // задачи, чей assigneeAccountId есть среди выбранных. Несколько ?assignee=
  // означают объединение. Нет параметра — показываем всех (accept = null).
  function assigneeFilter() {
    const vals = new URLSearchParams(location.search).getAll("assignee");
    return vals.length ? new Set(vals) : null;
  }

  function assigneeAccept() {
    const set = assigneeFilter();
    return set ? (entry) => set.has(entry.assignee) : null;
  }

  // Отпечаток фильтра — чтобы пересчитать суммы при смене ?assignee= без F5.
  function filterSignature() {
    return new URLSearchParams(location.search).getAll("assignee").sort().join(",");
  }

  function runRecalc() {
    recalc();
    lastSignature = board.visibleSignature();
    lastFilterSig = filterSignature();
  }

  function scheduleRecalc() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runRecalc, 200);
  }

  // ---- Триггеры -------------------------------------------------------------
  // Основной источник — сообщения от перехватчика. Ватчдог: (1) ловит SPA-смену
  // доски (URL меняется без перезагрузки скрипта) и перезабирает данные;
  // (2) восстанавливает баннеры после перерисовки и докрашивает появившиеся при
  // скролле карточки (данные берутся из уже загруженного store, DOM не читаем).
  let loadedBoardId = null;

  // Сброс состояния и забор данных текущей доски. Вызывается при старте и при
  // переходе между досками в SPA (имена колонок могут совпадать — ориентируемся
  // строго на boardId из URL, а не на DOM).
  function acquire() {
    loadedBoardId = boardFetch ? boardFetch.boardId() : null;
    lastPayload = null;
    lastSignature = "";
    lastFilterSig = "";
    spentToken++; // отбросить незавершённую догрузку timespent прошлой доски
    store.clear();
    board.cleanup(); // снять баннеры прошлой доски, recalc отрисует заново
    fetchFallback();
  }

  function watchdog() {
    if (!cfg.enabled) return;
    if (boardFetch) {
      const id = boardFetch.boardId();
      if (id && id !== loadedBoardId) {
        log("SPA-смена доски:", loadedBoardId, "→", id, "— перезабираю данные");
        acquire();
        return;
      }
    }
    if (!board.bannersHealthy() ||
        board.visibleSignature() !== lastSignature ||
        filterSignature() !== lastFilterSig) {
      scheduleRecalc();
    }
  }

  // Единственный источник данных — перехваченные ответы board API.
  function onMessage(event) {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "jiraext-board") return;
    log("получен ответ board API от перехватчика");
    applyBoardData(data.payload);
  }

  // Основной источник: ответ board API нигде не кэшируется (no-store), поэтому
  // вместо сканирования хранилищ сами запрашиваем данные через REST allData.json.
  function fetchFallback() {
    if (lastPayload || !boardFetch) return;
    boardFetch.fetch().then((found) => {
      if (lastPayload) return; // за время запроса прилетел живой перехваченный ответ
      if (found) {
        log("получил board data REST-запросом:", found.source);
        applyBoardData(found.payload);
      } else {
        log("REST-запрос board data не дал результата (нет boardId / ошибка сети)");
      }
    }).catch((e) => log("ошибка REST-запроса board data:", e));
  }

  function init() {
    window.addEventListener("message", onMessage);
    setInterval(watchdog, 1000); // смена доски / восстановление баннеров / докраска
    // Если board API прилетел до загрузки этого скрипта — попросим переотдать.
    window.postMessage({ source: "jiraext-request" }, window.location.origin);
    log("init: жду перехваченные ответы board API");
    // Забираем данные текущей доски. CMP — REST-запросом; TMP — через перехват
    // (fetchFallback для TMP вернёт null, данные придут от interceptor.js).
    acquire();
  }

  window.__jes.fetch = () => boardFetch && boardFetch.fetch();

  // Настройки: при смене hoursPerDay/daysPerWeek пересчитываем из последнего ответа.
  const cfg = settings.create(() => {
    if (lastPayload) applyBoardData(lastPayload);
    else scheduleRecalc();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window.JES = window.JES || {});
