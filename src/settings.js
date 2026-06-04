/**
 * settings.js — загрузка/наблюдение настроек из chrome.storage.
 * SRP: единственный источник конфигурации, остальной код просто читает поля.
 */
(function (NS) {
  "use strict";

  const defaults = { enabled: true, hoursPerDay: 8, daysPerWeek: 5 };

  /**
   * Возвращает мутируемый объект настроек, который сам обновляется из storage.
   * @param {() => void} onChange вызывается после любой загрузки/изменения
   */
  function create(onChange) {
    const state = Object.assign({}, defaults);

    if (!(chrome && chrome.storage && chrome.storage.sync)) return state;

    chrome.storage.sync.get(defaults, (stored) => {
      Object.assign(state, stored);
      onChange();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      let changed = false;
      for (const key in changes) {
        if (key in state) {
          state[key] = changes[key].newValue;
          changed = true;
        }
      }
      if (changed) onChange();
    });

    return state;
  }

  NS.settings = { defaults, create };
})(window.JES = window.JES || {});
