/**
 * estimate.js — чистая логика перевода оценки в часы и форматирования.
 * Без DOM и без состояния (Single Responsibility: только арифметика времени).
 */
(function (NS) {
  "use strict";

  // Латинские (w/d/h/m) и русские (нед./дн./ч/мин.) единицы → одна из категорий.
  const UNIT_TO_KIND = {
    "нед": "w", "w": "w",
    "дн": "d", "д": "d", "d": "d",
    "мин": "m", "м": "m", "m": "m",
    "ч": "h", "час": "h", "h": "h"
  };

  // Порядок в alternation важен: более длинные варианты идут первыми.
  const TOKEN_RE = /(\d+(?:[.,]\d+)?)\s*(нед|дн|мин|час|ч|д|м|[wdhm])\.?/gi;

  /**
   * @param {string} text   например "1d 2h 30m" или "1дн. 2ч 30мин."
   * @param {{hoursPerDay:number, daysPerWeek:number}} cfg
   * @returns {number} часы
   */
  function parse(text, cfg) {
    if (!text) return 0;
    const hoursPerDay = cfg.hoursPerDay;
    const daysPerWeek = cfg.daysPerWeek;

    let total = 0;
    let matched = false;
    let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(text)) !== null) {
      const kind = UNIT_TO_KIND[m[2].toLowerCase()];
      if (!kind) continue;
      matched = true;
      const value = parseFloat(m[1].replace(",", "."));
      if (kind === "w") total += value * daysPerWeek * hoursPerDay;
      else if (kind === "d") total += value * hoursPerDay;
      else if (kind === "h") total += value;
      else if (kind === "m") total += value / 60;
    }

    if (!matched) {
      const bare = parseFloat(text.replace(",", "."));
      if (!isNaN(bare)) total = bare; // голое число трактуем как часы
    }
    return total;
  }

  /**
   * Часы → строка в Jira-формате без дробей: "2d 7h 20m", "20m", "1w 3d".
   * Разбивка по тем же единицам, что и parse (w/d/h/m), с учётом конфигурации
   * рабочего дня/недели. Нулевые компоненты опускаем; ровно 0 → "0h".
   * @param {number} hours
   * @param {{hoursPerDay:number, daysPerWeek:number}} cfg
   */
  function format(hours, cfg) {
    const hoursPerDay = (cfg && cfg.hoursPerDay) || 8;
    const daysPerWeek = (cfg && cfg.daysPerWeek) || 5;

    let mins = Math.round(hours * 60); // в минутах — дальше только целочисленно
    if (mins <= 0) return "0h";

    const perDay = hoursPerDay * 60;
    const perWeek = daysPerWeek * perDay;

    const w = Math.floor(mins / perWeek); mins -= w * perWeek;
    const d = Math.floor(mins / perDay);  mins -= d * perDay;
    const h = Math.floor(mins / 60);      mins -= h * 60;
    const m = mins;

    const parts = [];
    if (w) parts.push(w + "w");
    if (d) parts.push(d + "d");
    if (h) parts.push(h + "h");
    if (m) parts.push(m + "m");
    return parts.join(" ");
  }

  NS.estimate = { parse, format };
})(window.JES = window.JES || {});
