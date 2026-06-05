/**
 * board.js — доступ к DOM доски Jira: размещение баннеров и покраска карточек.
 * SRP: знает селекторы board-kit. Оценки из DOM НЕ читаем (виртуализация даёт
 * неверные данные) — суммы приходят из board API. DOM нужен лишь чтобы найти
 * шапку колонки по имени и подсветить видимые карточки по данным из store.
 */
(function (NS) {
  "use strict";

  const SEL = {
    column: '[data-testid="platform-board-kit.ui.column.draggable-column.styled-wrapper"]',
    header: '[data-testid="platform-board-kit.common.ui.column-header.header.column-header-container"]',
    columnName: '[data-testid$="column-title.column-name"]',
    card: '[data-testid="platform-board-kit.ui.card.card"]',
    keyLink: 'a[href^="/browse/"]'
  };

  const BANNER_CLASS = "jiraext-banner";
  const HEADER_CLASS = "jiraext-header";
  const NO_EST_CLASS = "jiraext-no-estimate";

  // ---- Чтение DOM (только структура, без оценок) ----------------------------

  const columns = () => document.querySelectorAll(SEL.column);
  const cards = (column) => column.querySelectorAll(SEL.card);

  function columnName(column) {
    const el = column.querySelector(SEL.columnName);
    return el ? el.textContent.trim() : "";
  }

  function cardKey(card) {
    const a = card.querySelector(SEL.keyLink);
    const href = a && a.getAttribute("href"); // "/browse/WS-702"
    return href ? href.split("/").pop() : null;
  }

  function paintNoEstimate(card, isMissing) {
    card.classList.toggle(NO_EST_CLASS, isMissing);
  }

  // ---- Отрисовка ------------------------------------------------------------

  function ensureBanner(column) {
    const header = column.querySelector(SEL.header);
    if (!header) return null;

    header.classList.add(HEADER_CLASS); // CSS даёт перенос строки и отступ снизу

    let banner = header.querySelector("." + BANNER_CLASS);
    if (!banner) {
      banner = document.createElement("div");
      banner.className = BANNER_CLASS;
      header.appendChild(banner);
    }
    return banner;
  }

  // Две строки: 1) сумма часов, 2) число карточек без времени.
  function renderBanner(banner, totalHours, noEstimateCount, formatHours) {
    banner.innerHTML = "";

    const sum = document.createElement("span");
    sum.className = "jiraext-sum";
    sum.textContent = "Σ " + formatHours(totalHours) + " h";
    banner.appendChild(sum);

    const warn = document.createElement("span");
    warn.className = "jiraext-warn" + (noEstimateCount === 0 ? " jiraext-zero" : "");
    warn.textContent = noEstimateCount + " no estimate";
    banner.appendChild(warn);
  }

  function bannersHealthy() {
    const cols = columns();
    if (!cols.length) return true;
    for (const col of cols) {
      const header = col.querySelector(SEL.header);
      if (header && !header.querySelector("." + BANNER_CLASS)) return false;
    }
    return true;
  }

  // Отпечаток видимых карточек — чтобы перекрашивать по мере их появления.
  function visibleSignature() {
    let sig = columns().length + "|";
    document.querySelectorAll(SEL.card).forEach((card) => {
      sig += (cardKey(card) || "?") + ",";
    });
    return sig;
  }

  function cleanup() {
    document.querySelectorAll("." + BANNER_CLASS).forEach((b) => b.remove());
    document.querySelectorAll("." + HEADER_CLASS).forEach((h) => h.classList.remove(HEADER_CLASS));
    document.querySelectorAll("." + NO_EST_CLASS).forEach((c) => c.classList.remove(NO_EST_CLASS));
  }

  NS.board = {
    columns, cards, columnName, cardKey, paintNoEstimate,
    ensureBanner, renderBanner, bannersHealthy, visibleSignature, cleanup
  };
})(window.JES = window.JES || {});
