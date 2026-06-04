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

  /** Часы → компактная строка ("12.5", "12"). */
  function format(hours) {
    return String(Math.round(hours * 100) / 100);
  }

  NS.estimate = { parse, format };
})(window.JES = window.JES || {});
