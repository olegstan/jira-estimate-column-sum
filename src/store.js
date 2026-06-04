/**
 * store.js — состояние: задачи доски и агрегаты по колонкам.
 * SRP: хранит данные и считает суммы. Источник данных — ответ board API
 * (см. net/board-api.js), а не DOM, поэтому виртуализация на суммы не влияет.
 */
(function (NS) {
  "use strict";

  function createStore() {
    const cache = new Map(); // key -> { col, hours, hasEst }

    function set(key, col, hours, hasEst) {
      if (key) cache.set(key, { col, hours, hasEst });
    }

    function get(key) {
      return key ? cache.get(key) : undefined;
    }

    function clear() {
      cache.clear();
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

    return { set, get, clear, totalsByColumn };
  }

  NS.createStore = createStore;
})(window.JES = window.JES || {});
