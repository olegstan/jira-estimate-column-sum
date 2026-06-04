/**
 * content.js — оркестратор. Связывает модули и решает «когда пересчитывать».
 * SRP: координация (события, debounce/throttle, ватчдог). Сама логика — в модулях:
 *   estimate (часы) · store (кэш/итоги) · board (DOM) · settings (конфиг).
 */
(function (NS) {
  "use strict";

  const { estimate, board, createStore, settings } = NS;
  const store = createStore();

  let debounceTimer = null;
  let throttleTimer = null;
  let lastRun = 0;
  let lastSignature = "";

  // ---- Пересчёт -------------------------------------------------------------
  function recalc() {
    if (!cfg.enabled) {
      board.cleanup();
      store.clear();
      return;
    }

    store.resetIfNewGeneration(board.columnsContainer());

    const cols = board.columns();

    // 1) Обновляем кэш из видимых карточек + красим те, что без оценки.
    cols.forEach((column) => {
      const name = board.columnName(column);
      board.cards(column).forEach((card) => {
        const hours = estimate.parse(board.estimateText(card), cfg);
        const hasEst = hours > 0;
        board.paintNoEstimate(card, !hasEst);
        store.upsert(board.cardKey(card), name, hours, hasEst);
      });
    });

    // 2) Итоги по колонкам из кэша (учитывают и виртуализированные карточки).
    const totals = store.totalsByColumn();
    cols.forEach((column) => {
      const t = totals.get(board.columnName(column)) || { hours: 0, noEst: 0 };
      const banner = board.ensureBanner(column);
      if (banner) board.renderBanner(banner, t.hours, t.noEst, estimate.format);
    });
  }

  function runRecalc() {
    lastRun = Date.now();
    recalc();
    lastSignature = board.signature();
  }

  // ---- Планировщики ---------------------------------------------------------
  // Debounce — для редких событий (клик, фильтр, ввод).
  function scheduleRecalc() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runRecalc, 250);
  }

  // Throttle — для скролла: снимаем карточки в кэш, пока они ещё видны.
  function throttledRecalc() {
    const since = Date.now() - lastRun;
    if (since >= 150) {
      runRecalc();
    } else {
      clearTimeout(throttleTimer);
      throttleTimer = setTimeout(runRecalc, 150 - since);
    }
  }

  // Ватчдог — пересчитывает только при реальной необходимости.
  function watchdog() {
    if (!cfg.enabled) return;
    if (!board.bannersHealthy() || board.signature() !== lastSignature) {
      scheduleRecalc();
    }
  }

  // ---- Запуск ---------------------------------------------------------------
  function init() {
    ["click", "keyup", "dragend", "drop"].forEach((ev) =>
      document.addEventListener(ev, scheduleRecalc, true)
    );
    document.addEventListener("scroll", throttledRecalc, true);
    setInterval(watchdog, 1000);
    scheduleRecalc();
  }

  // Настройки создаём после объявления scheduleRecalc — он же колбэк изменений.
  const cfg = settings.create(scheduleRecalc);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window.JES = window.JES || {});
