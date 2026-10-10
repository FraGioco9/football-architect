/* HOME-02 SEARCH-01: local app navigation only. No fabricated careers, fixtures, or data. */
(() => {
  "use strict";
  const trigger = document.getElementById("app-search-trigger");
  const dialog = document.getElementById("app-search-dialog");
  const input = document.getElementById("app-search-input");
  const list = document.getElementById("app-search-results");
  const status = document.getElementById("app-search-status");
  const empty = document.getElementById("app-search-empty");
  const closeButton = document.getElementById("app-search-close");
  const heading = document.getElementById("app-search-heading");
  const scope = document.getElementById("app-search-scope");
  if (![trigger,dialog,input,list,status,empty,closeButton,heading,scope].every(Boolean)) return;

  const translations = {
    en: {trigger:"Search the app",placeholder:"Find a page or setting…",close:"Close search",scope:"Search available app pages and sections only.",empty:"No matching pages or sections.",page:"Page",section:"Section",results:"results",suggestions:"suggestions"},
    de: {trigger:"App durchsuchen",placeholder:"Seite oder Einstellung suchen…",close:"Suche schließen",scope:"Nur verfügbare App-Seiten und Bereiche durchsuchen.",empty:"Keine passenden Seiten oder Bereiche.",page:"Seite",section:"Bereich",results:"Ergebnisse",suggestions:"Vorschläge"},
    es: {trigger:"Buscar en la app",placeholder:"Buscar página o ajuste…",close:"Cerrar búsqueda",scope:"Busca solo páginas y secciones disponibles de la app.",empty:"No hay páginas ni secciones coincidentes.",page:"Página",section:"Sección",results:"resultados",suggestions:"sugerencias"},
    fr: {trigger:"Rechercher dans l’app",placeholder:"Chercher une page ou un réglage…",close:"Fermer la recherche",scope:"Recherche limitée aux pages et sections disponibles.",empty:"Aucune page ou section correspondante.",page:"Page",section:"Section",results:"résultats",suggestions:"suggestions"},
    it: {trigger:"Cerca nell’app",placeholder:"Cerca pagina o impostazione…",close:"Chiudi ricerca",scope:"Cerca solo nelle pagine e sezioni disponibili.",empty:"Nessuna pagina o sezione corrispondente.",page:"Pagina",section:"Sezione",results:"risultati",suggestions:"suggerimenti"}
  };
  // Exact, real in-app destinations. Expand only when the underlying pages exist.
  const entries = [
    ["page","dashboard-title","careerStatusText","/app/"],
    ["page","calendar-title","calendarStatusText","/app/calendar/"],
    ["page","settings-title","languageHelp","/app/settings/"],
    ["section","career-status-heading","careerStatusText","/app/#career-status-heading"],
    ["section","world-heading","worldText","/app/#world-heading"],
    ["section","app-language-heading","languageHelp","/app/settings/#app-language-heading"],
    ["section","app-career-heading","dataText","/app/settings/#app-career-heading"],
    ["section","app-data-heading","dataText","/app/settings/#app-data-heading"],
    ["section","app-about-heading","aboutText","/app/settings/#app-about-heading"]
  ];
  const fold = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase().trim();
  const words = () => translations[document.documentElement.lang] || translations.en;
  const links = () => [...list.querySelectorAll("a.app-search-result")];
  let closingTimer = null;
  let suppressReturnFocusHighlight = false;
  // Closing on a backdrop click requires a matching pointer gesture, not only
  // a click retargeted to the dialog after an inside/outside drag.
  const backdropDragThreshold = 8;
  let backdropStart = null;
  let validBackdropClick = false;
  function resetBackdropPointer() {
    backdropStart = null;
    validBackdropClick = false;
  }

  function render() {
    const query = fold(input.value);
    const strings = words();
    const matches = entries.map(([kind,id,descriptionKey,href]) => {
      const label = document.getElementById(id)?.textContent?.trim() || "";
      const detail = document.querySelector('[data-app-i18n="' + descriptionKey + '"]')?.textContent?.trim() || "";
      const name = fold(label);
      const searchable = fold(label + " " + detail);
      const score = !query ? (kind === "page" ? 1 : 0)
        : name === query ? 4 : name.startsWith(query) ? 3
        : name.includes(query) ? 2 : searchable.includes(query) ? 1 : 0;
      return {kind,label,detail,href,score};
    }).filter(item => item.label && item.score > 0)
      .sort((a,b) => b.score - a.score).slice(0,8);
    const nodes = matches.map(item => {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.className = "app-search-result";
      link.href = item.href;
      const kind = document.createElement("span");
      kind.className = "app-search-kind";
      kind.textContent = strings[item.kind];
      const label = document.createElement("strong");
      label.className = "app-search-name";
      label.textContent = item.label;
      link.append(label,kind);
      li.append(link);
      return li;
    });
    list.replaceChildren(...nodes);
    list.hidden = !matches.length;
    empty.hidden = !!matches.length;
    status.textContent = matches.length + " " + (query ? strings.results : strings.suggestions);
  }

  function translate() {
    const strings = words();
    trigger.setAttribute("aria-label",strings.trigger);
    const triggerText = trigger.querySelector("span");
    if (triggerText) triggerText.textContent = strings.trigger;
    heading.textContent = strings.trigger;
    input.setAttribute("aria-label",strings.trigger);
    input.placeholder = strings.placeholder;
    closeButton.setAttribute("aria-label",strings.close);
    scope.textContent = strings.scope;
    empty.textContent = strings.empty;
    list.setAttribute("aria-label",strings.trigger);
    if (dialog.open) render();
  }
  function open() {
    if (dialog.open || closingTimer !== null) return;
    suppressReturnFocusHighlight = false;
    trigger.classList.remove("app-search-escape-return");
    input.value = "";
    translate();
    render();
    dialog.showModal();
    input.focus({preventScroll:true});
  }
  function finishClose() {
    if (closingTimer !== null) clearTimeout(closingTimer);
    closingTimer = null;
    resetBackdropPointer();
    dialog.classList.remove("is-closing");
    if (dialog.open) dialog.close();
  }
  function close(fromEscape = false) {
    if (!dialog.open || closingTimer !== null) return;
    suppressReturnFocusHighlight = fromEscape;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishClose();
      return;
    }
    dialog.classList.add("is-closing");
    closingTimer = setTimeout(finishClose,150);
  }
  trigger.addEventListener("click",open);
  trigger.addEventListener("blur",() => trigger.classList.remove("app-search-escape-return"));
  closeButton.addEventListener("click",close);
  // Capture Escape before the native search input can consume it to clear text.
  dialog.addEventListener("keydown",event => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close(true);
  },true);
  dialog.addEventListener("cancel",event => { event.preventDefault(); close(true); });
  dialog.addEventListener("pointerdown",event => {
    validBackdropClick = false;
    backdropStart = event.target === dialog
      ? {pointerId:event.pointerId,x:event.clientX,y:event.clientY} : null;
  });
  dialog.addEventListener("pointermove",event => {
    if (!backdropStart || backdropStart.pointerId !== event.pointerId) return;
    if (event.target !== dialog ||
        Math.hypot(event.clientX - backdropStart.x,event.clientY - backdropStart.y) > backdropDragThreshold) {
      backdropStart = null;
    }
  });
  dialog.addEventListener("pointerup",event => {
    validBackdropClick = !!backdropStart && event.target === dialog &&
      event.pointerId === backdropStart.pointerId &&
      Math.hypot(event.clientX - backdropStart.x,event.clientY - backdropStart.y) <= backdropDragThreshold;
    backdropStart = null;
  });
  dialog.addEventListener("pointercancel",resetBackdropPointer);
  dialog.addEventListener("click",event => {
    const shouldClose = event.target === dialog && validBackdropClick;
    validBackdropClick = false;
    if (shouldClose) close();
  });
  dialog.addEventListener("close",() => {
    resetBackdropPointer();
    if (closingTimer !== null) clearTimeout(closingTimer);
    closingTimer = null;
    dialog.classList.remove("is-closing");
    if (suppressReturnFocusHighlight) trigger.classList.add("app-search-escape-return");
    else trigger.classList.remove("app-search-escape-return");
    trigger.focus({preventScroll:true});
    suppressReturnFocusHighlight = false;
  });
  input.addEventListener("input",render);
  input.addEventListener("keydown",event => {
    const found = links();
    if (!found.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      found[event.key === "ArrowDown" ? 0 : found.length - 1].focus();
    } else if (event.key === "Enter") {
      event.preventDefault();
      found[0].click();
    }
  });
  list.addEventListener("keydown",event => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const found = links();
    const current = found.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    if (event.key === "ArrowUp" && current === 0) input.focus();
    else found[(current + (event.key === "ArrowDown" ? 1 : -1) + found.length) % found.length].focus();
  });
  list.addEventListener("click",event => {
    if (event.target.closest("a.app-search-result")) finishClose();
  });
  new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  translate();
})();
