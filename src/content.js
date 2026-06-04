/**
 * Jira Estimate Summary
 * --------------------------------------------------------------------------
 * Проходит по всем колонкам доски, извлекает Original estimate каждой карточки
 * (значения вида 30m / 10h / 1h / 1d / "1d 2h 30m"), переводит всё в часы,
 * суммирует по колонке и показывает сумму в шапке колонки.
 * Карточки без оценки подсвечиваются розовым, а их количество выводится в шапке.
 */
(() => {
  "use strict";

  // ---- Селекторы Jira (board-kit) -----------------------------------------
  const SEL = {
    column: '[data-testid="platform-board-kit.ui.column.draggable-column.styled-wrapper"]',
    header: '[data-testid="platform-board-kit.common.ui.column-header.header.column-header-container"]',
    columnName: '[data-testid$="column-title.column-name"]',
    card: '[data-testid="platform-board-kit.ui.card.card"]',
    estimate: '[data-testid="software-board.common.fields.estimate-field.static.estimate-wrapper"]'
  };

  const BANNER_CLASS = "jiraext-banner";
  const NO_EST_CLASS = "jiraext-no-estimate";

  // ---- Настройки (перевод дней/недель в часы) ------------------------------
  const settings = {
    enabled: true,
    hoursPerDay: 8,
    daysPerWeek: 5
  };

  // ---- Парсинг оценки в часы ------------------------------------------------
  // Поддерживает латинские (w/d/h/m) и русские (нед./дн./ч/мин.) единицы,
  // в т.ч. составные "1d 2h 30m" или "1дн. 2ч 30мин.". Возвращает число часов.
  //
  // Единицы нормализуются к одной из категорий: w (неделя), d (день),
  // h (час), m (минута). Порядок в alternation важен — более длинные/
  // специфичные варианты идут первыми (мин перед м, нед перед д и т.п.).
  const UNIT_TO_KIND = {
    "нед": "w", "w": "w",
    "дн": "d", "д": "d", "d": "d",
    "мин": "m", "м": "m", "m": "m",
    "ч": "h", "час": "h", "h": "h"
  };

  function parseEstimateToHours(text) {
    if (!text) return 0;
    const re = /(\d+(?:[.,]\d+)?)\s*(нед|дн|мин|час|ч|д|м|[wdhm])\.?/gi;
    let total = 0;
    let m;
    let matched = false;
    while ((m = re.exec(text)) !== null) {
      const kind = UNIT_TO_KIND[m[2].toLowerCase()];
      if (!kind) continue;
      matched = true;
      const value = parseFloat(m[1].replace(",", "."));
      switch (kind) {
        case "w": total += value * settings.daysPerWeek * settings.hoursPerDay; break;
        case "d": total += value * settings.hoursPerDay; break;
        case "h": total += value; break;
        case "m": total += value / 60; break;
      }
    }
    // Голое число без единицы трактуем как часы.
    if (!matched) {
      const bare = parseFloat(text.replace(",", "."));
      if (!isNaN(bare)) total = bare;
    }
    return total;
  }

  function formatHours(hours) {
    const rounded = Math.round(hours * 100) / 100;
    // Убираем лишние нули: 12.00 -> 12, 12.50 -> 12.5
    return String(rounded);
  }

  // ---- Создание / обновление баннера в шапке колонки -----------------------
  function getBanner(column) {
    const header = column.querySelector(SEL.header);
    if (!header) return null;

    // Шапку помечаем классом — CSS даёт ей перенос строки, авто-высоту и
    // отступ снизу, чтобы баннер не перекрывал ни название, ни карточки.
    header.classList.add("jiraext-header");

    let banner = header.querySelector("." + BANNER_CLASS);
    if (!banner) {
      banner = document.createElement("div");
      banner.className = BANNER_CLASS;
      // Кладём баннер последним элементом шапки — он переносится на свою строку.
      header.appendChild(banner);
    }
    return banner;
  }

  function renderBanner(banner, totalHours, noEstimateCount) {
    banner.innerHTML = "";

    // Первая строка — сумма часов.
    const sum = document.createElement("span");
    sum.className = "jiraext-sum";
    sum.textContent = "Σ " + formatHours(totalHours) + " ч";
    banner.appendChild(sum);

    // Вторая строка — количество карточек без времени (всегда показываем,
    // при нуле — нейтральным цветом).
    const warn = document.createElement("span");
    warn.className = "jiraext-warn" + (noEstimateCount === 0 ? " jiraext-zero" : "");
    warn.textContent = noEstimateCount + " без времени";
    banner.appendChild(warn);
  }

  // ---- Основной пересчёт ----------------------------------------------------
  function recalc() {
    if (!settings.enabled) {
      cleanup();
      return;
    }

    const columns = document.querySelectorAll(SEL.column);
    columns.forEach((column) => {
      const cards = column.querySelectorAll(SEL.card);
      let totalHours = 0;
      let noEstimateCount = 0;

      cards.forEach((card) => {
        const estEl = card.querySelector(SEL.estimate);
        const hours = estEl ? parseEstimateToHours(estEl.textContent.trim()) : 0;

        if (hours > 0) {
          totalHours += hours;
          card.classList.remove(NO_EST_CLASS);
        } else {
          noEstimateCount++;
          card.classList.add(NO_EST_CLASS);
        }
      });

      const banner = getBanner(column);
      if (banner) renderBanner(banner, totalHours, noEstimateCount);
    });
  }

  function cleanup() {
    document.querySelectorAll("." + BANNER_CLASS).forEach((b) => b.remove());
    document.querySelectorAll("." + NO_EST_CLASS).forEach((c) => c.classList.remove(NO_EST_CLASS));
  }

  // ---- Наблюдение за изменениями доски --------------------------------------
  // Jira при смене фильтра заменяет весь контейнер доски новым DOM-узлом,
  // из-за чего наш баннер пропадает, а подписка на старый узел перестаёт
  // работать. Поэтому пересчёт делаем:
  //   1) по событиям пользователя (клик, ввод, drag&drop) — это покрывает
  //      смену фильтров, перетаскивание карточек и инлайн-правку оценок;
  //   2) лёгким ватчдогом раз в секунду, который ЗАПУСКАЕТ пересчёт только
  //      если баннеров нет или «отпечаток» доски изменился (асинхронная
  //      дозагрузка карточек, не привязанная к клику).
  let debounceTimer = null;
  let lastSignature = "";

  function scheduleRecalc() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      recalc();
      lastSignature = boardSignature();
    }, 250);
  }

  // Дешёвый «отпечаток» состояния доски: число колонок, число карточек и
  // тексты всех оценок. Меняется при любой значимой перерисовке.
  function boardSignature() {
    const cols = document.querySelectorAll(SEL.column).length;
    let sig = cols + "|";
    document.querySelectorAll(SEL.card).forEach((c) => {
      const est = c.querySelector(SEL.estimate);
      sig += (est ? est.textContent.trim() : "·") + ",";
    });
    return sig;
  }

  // Проверка, что у каждой колонки есть баннер с суммой сверху.
  function bannersHealthy() {
    const columns = document.querySelectorAll(SEL.column);
    if (!columns.length) return true; // доски нет — чинить нечего
    for (const col of columns) {
      const header = col.querySelector(SEL.header);
      if (header && !header.querySelector("." + BANNER_CLASS)) return false;
    }
    return true;
  }

  function watchdog() {
    if (!settings.enabled) return;
    if (!bannersHealthy() || boardSignature() !== lastSignature) {
      scheduleRecalc();
    }
  }

  function init() {
    // Пересчёт по пользовательским событиям (с дебаунсом внутри scheduleRecalc).
    ["click", "keyup", "dragend", "drop"].forEach((ev) =>
      document.addEventListener(ev, scheduleRecalc, true)
    );
    // Ватчдог-страховка: запускает пересчёт только при реальной необходимости.
    setInterval(watchdog, 1000);
    scheduleRecalc();
  }

  // ---- Связь с popup (настройки) -------------------------------------------
  if (chrome?.storage?.sync) {
    chrome.storage.sync.get(settings, (stored) => {
      Object.assign(settings, stored);
      scheduleRecalc();
    });
    chrome.storage.onChanged?.addListener((changes, area) => {
      if (area !== "sync") return;
      for (const key in changes) {
        if (key in settings) settings[key] = changes[key].newValue;
      }
      scheduleRecalc();
    });
  }

  // Ждём появления доски (SPA-навигация Jira).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
