/**
 * board-api.js — разбор ответов Jira board API в плоский список задач.
 * SRP: знает структуру ответов. Без DOM, без арифметики времени (часы считает
 * вызывающий код через estimate.parse) и без состояния.
 *
 * Поддерживает два формата:
 *   • fetchBoardData (TMP, перехват) — { columns:[{name, issues:[{key, estimation}]}] };
 *   • allData.json   (CMP, REST)     — { columnsData:{columns}, issuesData:{issues} }.
 * Оба нормализуются в единый { key, column, estimation } — строку оценки
 * ("1d 2h 30m") дальше разбирает estimate.parse.
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

  /** Похоже ли тело ответа на greenhopper allData.json (CMP-доска). */
  function isAllData(payload) {
    return !!(payload && payload.columnsData && Array.isArray(payload.columnsData.columns) &&
              payload.issuesData && Array.isArray(payload.issuesData.issues));
  }

  /**
   * Разбор allData.json. Колонку задачи определяем по statusId → columns[].statusIds,
   * оценку берём из estimateStatistic.statFieldValue.text (тот же формат, что и
   * estimation в fetchBoardData: "2h", "1d 2h 30m", "0m", ...).
   * @returns {Array<{key:string, column:string, estimation:string}>}
   */
  function extractIssuesFromAllData(payload) {
    const columns = payload.columnsData.columns;
    const statusToColumn = new Map();
    for (const col of columns) {
      const name = col.name || "";
      for (const sid of col.statusIds || []) statusToColumn.set(String(sid), name);
    }

    const issues = [];
    for (const issue of payload.issuesData.issues) {
      if (issue.hidden === true) continue; // скрыта активным quick-фильтром
      if (!issue.key) continue;
      const stat = issue.estimateStatistic && issue.estimateStatistic.statFieldValue;
      issues.push({
        key: issue.key,
        column: statusToColumn.get(String(issue.statusId)) || "",
        estimation: (stat && stat.text) || ""
      });
    }
    return issues;
  }

  /** Единая точка: распознаёт формат и возвращает список задач, либо null если это не доска. */
  function normalize(payload) {
    if (isBoardData(payload)) return extractIssues(payload);
    if (isAllData(payload)) return extractIssuesFromAllData(payload);
    return null;
  }

  NS.boardApi = { extractIssues, extractIssuesFromAllData, isBoardData, isAllData, normalize };
})(window.JES = window.JES || {});
