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
})();
