/**
 * store.js — состояние: задачи доски и агрегаты по колонкам.
 * SRP: хранит данные и считает суммы. Источник данных — ответ board API
 * (см. net/board-api.js), а не DOM, поэтому виртуализация на суммы не влияет.
 */
(function (NS) {
  "use strict";

  function createStore() {
    const cache = new Map(); // key -> { col, hours, hasEst, spent }

    function set(key, col, hours, hasEst) {
      if (key) cache.set(key, { col, hours, hasEst, spent: 0 });
    }

    // Потраченное время приходит отдельным запросом (см. boardFetch.fetchSpent),
    // уже после первичного заполнения — дописываем в существующую запись.
    function setSpent(key, spent) {
      const e = key && cache.get(key);
      if (e) e.spent = spent || 0;
    }

    function get(key) {
      return key ? cache.get(key) : undefined;
    }

    function clear() {
      cache.clear();
    }

    /** @returns {Map<string,{hours:number,noEst:number,spent:number}>} итоги по колонкам */
    function totalsByColumn() {
      const totals = new Map();
      cache.forEach(({ col, hours, hasEst, spent }) => {
        const t = totals.get(col) || { hours: 0, noEst: 0, spent: 0 };
        t.hours += hours;
        t.spent += spent || 0;
        if (!hasEst) t.noEst += 1;
        totals.set(col, t);
      });
      return totals;
    }

    return { set, setSpent, get, clear, totalsByColumn };
  }

  NS.createStore = createStore;
})(window.JES = window.JES || {});
