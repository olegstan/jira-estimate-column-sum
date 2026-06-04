/**
 * board-api.js — разбор ответа Jira fetchBoardData в плоский список задач.
 * SRP: знает структуру ответа board API. Без DOM, без арифметики времени
 * (часы считает вызывающий код через estimate.parse) и без состояния.
 */
(function (NS) {
  "use strict";

  /**
   * @param {object} payload разобранный JSON ответа fetchBoardData
   * @returns {Array<{key:string, column:string, estimation:string}>}
   *          только видимые задачи (isVisible !== false — уважаем quick-фильтры)
   */
  function extractIssues(payload) {
    const columns = payload && payload.columns;
    if (!Array.isArray(columns)) return [];

    const issues = [];
    for (const column of columns) {
      const columnName = column.name || "";
      const list = Array.isArray(column.issues) ? column.issues : [];
      for (const issue of list) {
        if (issue.isVisible === false) continue;
        if (!issue.key) continue;
        issues.push({
          key: issue.key,
          column: columnName,
          estimation: issue.estimation || ""
        });
      }
    }
    return issues;
  }

  /** Похоже ли тело ответа на fetchBoardData (чтобы фильтровать перехваченные ответы). */
  function isBoardData(payload) {
    return !!(payload && Array.isArray(payload.columns) && payload.estimation);
  }

  NS.boardApi = { extractIssues, isBoardData };
})(window.JES = window.JES || {});
