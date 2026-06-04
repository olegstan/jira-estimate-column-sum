const defaults = { enabled: true, hoursPerDay: 8, daysPerWeek: 5 };
const fields = ["enabled", "hoursPerDay", "daysPerWeek"];

chrome.storage.sync.get(defaults, (s) => {
  document.getElementById("enabled").checked = s.enabled;
  document.getElementById("hoursPerDay").value = s.hoursPerDay;
  document.getElementById("daysPerWeek").value = s.daysPerWeek;
});

fields.forEach((id) => {
  const el = document.getElementById(id);
  el.addEventListener("change", () => {
    const value = el.type === "checkbox" ? el.checked : parseFloat(el.value);
    chrome.storage.sync.set({ [id]: value });
  });
});
