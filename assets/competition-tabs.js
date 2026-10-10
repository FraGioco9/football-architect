/* Static competition views: only one panel at a time. No gameplay data is inferred. */
(() => {
  "use strict";
  const tablist = document.querySelector(".app-competition-tabs");
  if (!tablist) return;
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute("aria-controls")));
  if (tabs.length !== 6 || panels.some(panel => !panel)) return;
  function select(index, focus = false) {
    for (let i = 0; i < tabs.length; i++) {
      const active = i === index;
      tabs[i].setAttribute("aria-selected", String(active));
      tabs[i].tabIndex = active ? 0 : -1;
      tabs[i].classList.toggle("is-active", active);
      panels[i].hidden = !active;
    }
    if (focus) {
      tabs[index].focus();
      tabs[index].scrollIntoView?.({block:"nearest", inline:"nearest"});
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(index));
    tab.addEventListener("keydown", event => {
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      select(next, true);
    });
  });
  select(0);
  const filterRoot = document.querySelector(".app-standing-filters");
  if (filterRoot) {
    const buttons = [...filterRoot.querySelectorAll("[data-standing-filter]")];
    const status = document.getElementById("app-standing-filter-status");
    const selections = {leg:"all",venue:"all",form:"all"};
    const expected = {leg:["all","first","second"],venue:["all","home","away"],form:["all","last5","last10"]};
    if (status && buttons.length === 9 && buttons.every(button =>
      Object.hasOwn(expected, button.dataset.standingFilter) &&
      expected[button.dataset.standingFilter].includes(button.dataset.standingValue))) {
      function applyFilter(group,value) {
        selections[group] = value;
        for (const button of buttons) {
          const active = selections[button.dataset.standingFilter] === button.dataset.standingValue;
          button.classList.toggle("is-active",active);
          button.setAttribute("aria-pressed",String(active));
        }
        // No match database exists yet: selections never create statistics.
        status.hidden = Object.values(selections).every(value => value === "all");
      }
      buttons.forEach(button => button.addEventListener("click", () =>
        applyFilter(button.dataset.standingFilter,button.dataset.standingValue)));
    }
  }
})();
