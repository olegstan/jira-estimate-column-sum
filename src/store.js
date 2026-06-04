/**
 * store.js — состояние: кэш задач против виртуализации + агрегаты по колонкам.
 * SRP: хранит данные и считает суммы. Ничего не знает о DOM и о времени-в-часах.
 *
 * Каждая увиденная задача запоминается по ключу (WS-702), поэтому при скролле,
 * когда Jira удаляет невидимые карточки из DOM, их вклад в сумму не теряется.
 */
(function (NS) {
  "use strict";

  function createStore() {
    const cache = new Map(); // key -> { col, hours, hasEst }
    let generation = null;   // контейнер колонок = маркер «поколения» доски
    let lastUrl = location.href;

    /**
     * Сбрасывает кэш при смене фильтров (меняется URL) или полной перерисовке
     * доски (контейнер колонок заменяется). Обычный скролл этого не вызывает.
     * @returns {boolean} был ли сброс
     */
    function resetIfNewGeneration(container) {
      let reset = false;
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        cache.clear();
        reset = true;
      }
      if (container && container !== generation) {
        if (generation !== null) {
          cache.clear();
          reset = true;
        }
        generation = container;
      }
      return reset;
    }

    function upsert(key, col, hours, hasEst) {
      if (key) cache.set(key, { col, hours, hasEst });
    }

    /** @returns {Map<string,{hours:number,noEst:number}>} итоги по колонкам */
    function totalsByColumn() {
      const totals = new Map();
      cache.forEach(({ col, hours, hasEst }) => {
        const t = totals.get(col) || { hours: 0, noEst: 0 };
        t.hours += hours;
        if (!hasEst) t.noEst += 1;
        totals.set(col, t);
      });
      return totals;
    }

    function clear() {
      cache.clear();
    }

    return { resetIfNewGeneration, upsert, totalsByColumn, clear };
  }

  NS.createStore = createStore;
})(window.JES = window.JES || {});
