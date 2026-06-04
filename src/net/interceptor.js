/**
 * interceptor.js — выполняется в MAIN-мире страницы (см. manifest world:"MAIN").
 * SRP: перехватить ответы Jira board API (fetchBoardData) и передать сырой JSON
 * в изолированный мир расширения через window.postMessage. Своих запросов НЕ
 * делает — только слушает то, что запрашивает само приложение.
 *
 * Прозрачность: логирует каждый сетевой запрос (кроме статики) и вердикт —
 * перехватываю/пропускаю, удалось разобрать или нет.
 */
(function () {
  "use strict";

  const ORIGIN = window.location.origin;
  const TAG = "[jira-ext]";
  let lastPayload = null;

  // Уникальный признак нужного ответа — operation=fetchBoardData.
  function isBoardUrl(url) {
    return typeof url === "string" && url.indexOf("fetchBoardData") !== -1;
  }

  function publish(payload, url) {
    if (!payload || !Array.isArray(payload.columns)) {
      console.warn(TAG, "ответ получен, но это не board data (нет columns):", url);
      return;
    }
    lastPayload = payload;
    console.log(TAG, "✓ перехватил board API — колонок:", payload.columns.length, "|", url);
    window.postMessage({ source: "jiraext-board", payload }, ORIGIN);
  }

  function tryParse(body) {
    if (body == null) return null;
    if (typeof body === "object") return body;
    try { return JSON.parse(body); } catch (e) { return null; }
  }

  // Переотдача последнего ответа, если content-script подключился позже.
  window.addEventListener("message", (e) => {
    if (e.source === window && e.data && e.data.source === "jiraext-request" && lastPayload) {
      window.postMessage({ source: "jiraext-board", payload: lastPayload }, ORIGIN);
    }
  });

  // --- fetch ---
  const origFetch = window.fetch;
  if (typeof origFetch === "function") {
    window.fetch = function (...args) {
      const input = args[0];
      const url = typeof input === "string" ? input : (input && input.url) || "";
      const promise = origFetch.apply(this, args);
      if (isBoardUrl(url)) {
        console.log(TAG, "fetch ⟶ ПЕРЕХВАТЫВАЮ:", url);
        promise.then((res) => {
          res.clone().json()
            .then((j) => publish(j, url))
            .catch((e) => console.warn(TAG, "✗ не разобрал ответ fetch:", url, e));
        }).catch(() => {});
      }
      return promise;
    };
  }

  // --- XMLHttpRequest ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__jiraextUrl = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    const url = this.__jiraextUrl || "";
    if (isBoardUrl(url)) {
      console.log(TAG, "xhr ⟶ ПЕРЕХВАТЫВАЮ:", url);
      this.addEventListener("load", function () {
        // При responseType="json" responseText пустой — берём response.
        const body = (this.responseType === "" || this.responseType === "text")
          ? this.responseText
          : this.response;
        const parsed = tryParse(body);
        if (parsed) publish(parsed, url);
        else console.warn(TAG, "✗ не разобрал ответ XHR (responseType=" + this.responseType + "):", url);
      });
    }
    return origSend.apply(this, arguments);
  };

  console.log(TAG, "перехватчик установлен (fetch + XHR), жду запросы с fetchBoardData");
})();
