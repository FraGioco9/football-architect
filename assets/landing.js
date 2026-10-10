// LAND-01–06: five languages; shared preference for future Guide and Home.
(() => {
  "use strict";
  const STORAGE_KEY = "football-architect:language";
  const SUPPORTED = ["en","de","es","fr","it"];
  const messages = {
    en: {
      language:"Language",dismiss:"Dismiss notice",summary:"Explore an alternative football world.",
      enter:"Enter the app",guide:"Guide",universe:"Football world",
      countries:"Countries",divisions:"Divisions",clubs:"Documented clubs",
      footer:"Work in progress",
      unavailableApp:"The app is not available yet. This area is being designed.",
      unavailableGuide:"The guide is not available yet. This area is being designed."
    },
    de: {
      language:"Sprache",dismiss:"Hinweis schließen",summary:"Entdecke eine alternative Fußballwelt.",
      enter:"App öffnen",guide:"Leitfaden",universe:"Fußballwelt",
      countries:"Länder",divisions:"Ligen",clubs:"Dokumentierte Vereine",
      footer:"In Entwicklung",
      unavailableApp:"Die App ist noch nicht verfügbar. Dieser Bereich wird entwickelt.",
      unavailableGuide:"Der Leitfaden ist noch nicht verfügbar. Dieser Bereich wird entwickelt."
    },
    es: {
      language:"Idioma",dismiss:"Cerrar aviso",summary:"Explora un universo futbolístico alternativo.",
      enter:"Entrar en la aplicación",guide:"Guía",universe:"Mundo del fútbol",
      countries:"Países",divisions:"Divisiones",clubs:"Clubes documentados",
      footer:"En desarrollo",
      unavailableApp:"La aplicación aún no está disponible. Esta sección está en desarrollo.",
      unavailableGuide:"La guía aún no está disponible. Esta sección está en desarrollo."
    },
    fr: {
      language:"Langue",dismiss:"Fermer le message",summary:"Explorez un univers footballistique alternatif.",
      enter:"Accéder à l’application",guide:"Guide",universe:"Univers du football",
      countries:"Pays",divisions:"Divisions",clubs:"Clubs répertoriés",
      footer:"En développement",
      unavailableApp:"L’application n’est pas encore disponible. Cette section est en cours de conception.",
      unavailableGuide:"Le guide n’est pas encore disponible. Cette section est en cours de conception."
    },
    it: {
      language:"Lingua",dismiss:"Chiudi avviso",summary:"Esplora un universo calcistico alternativo.",
      enter:"Entra nell'app",guide:"Guida",universe:"Mondo calcistico",
      countries:"Paesi",divisions:"Divisioni",clubs:"Club documentati",
      footer:"In sviluppo",
      unavailableApp:"L'app non è ancora disponibile. Questa sezione è in progettazione.",
      unavailableGuide:"La guida non è ancora disponibile. Questa sezione è in progettazione."
    }
  };
  const languageControl = document.getElementById("language-control");
  const trigger = document.getElementById("site-language");
  const languageValue = document.getElementById("language-value");
  const menu = document.getElementById("language-options");
  const options = [...document.querySelectorAll("[data-language]")];
  const status = document.getElementById("action-status");
  const statusMessage = document.getElementById("action-status-message");
  const statusClose = document.getElementById("status-close");
  const labels = [...document.querySelectorAll("[data-i18n]")];
  const actions = [...document.querySelectorAll("[data-destination]")];
  const valid = (value) => SUPPORTED.includes(value) ? value : "en";
  let language = "en";
  let activeIndex = 0;
  let lastAction = null;

  function translate(value, persist = false) {
    language = valid(value);
    const copy = messages[language];
    document.documentElement.lang = language;
    languageValue.textContent = options.find(option => option.dataset.language === language).textContent;
    for (const option of options) {
      option.setAttribute("aria-selected", String(option.dataset.language === language));
    }
    statusClose.setAttribute("aria-label", copy.dismiss);
    for (const node of labels) {
      const key = node.dataset.i18n;
      if (Object.hasOwn(copy, key)) node.textContent = copy[key];
    }
    if (lastAction && !status.hidden) {
      statusMessage.textContent = lastAction === "app" ? copy.unavailableApp : copy.unavailableGuide;
    }
    if (persist) {
      try { window.localStorage.setItem(STORAGE_KEY, language); }
      catch { /* Language remains active if storage is unavailable. */ }
    }
  }

  function updateActive() {
    for (const [index, option] of options.entries()) {
      option.dataset.active = String(index === activeIndex);
    }
    trigger.setAttribute("aria-activedescendant", options[activeIndex].id);
  }

  function openMenu() {
    activeIndex = SUPPORTED.indexOf(language);
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    updateActive();
  }

  function closeMenu(restoreFocus = false) {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    trigger.removeAttribute("aria-activedescendant");
    for (const option of options) delete option.dataset.active;
    if (restoreFocus) trigger.focus();
  }

  function choose(value) {
    translate(value, true);
    closeMenu(true);
  }

  trigger.addEventListener("click", () => {
    if (menu.hidden) openMenu();
    else closeMenu();
  });
  trigger.addEventListener("keydown", (event) => {
    const key = event.key;
    if (key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End") {
      event.preventDefault();
      if (menu.hidden) openMenu();
      if (key === "Home") activeIndex = 0;
      else if (key === "End") activeIndex = options.length - 1;
      else activeIndex = (activeIndex + (key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      updateActive();
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      if (menu.hidden) openMenu();
      else choose(options[activeIndex].dataset.language);
    } else if (key === "Escape" && !menu.hidden) {
      event.preventDefault();
      closeMenu(true);
    } else if (key === "Tab") {
      closeMenu();
    }
  });

  for (const option of options) {
    option.addEventListener("click", () => choose(option.dataset.language));
    // Pointer hover is visual only; selecting always requires a click or Enter.
    option.addEventListener("pointermove", () => {
      if (menu.hidden) return;
      activeIndex = SUPPORTED.indexOf(option.dataset.language);
      updateActive();
    });
  }
  document.addEventListener("pointerdown", (event) => {
    if (!menu.hidden && !languageControl.contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) closeMenu(true);
  });

  for (const button of actions) {
    button.addEventListener("click", () => {
      lastAction = button.dataset.destination;
      const copy = messages[language];
      statusMessage.textContent = lastAction === "app" ? copy.unavailableApp : copy.unavailableGuide;
      status.hidden = false;
      closeMenu();
    });
  }
  statusClose.addEventListener("click", () => {
    status.hidden = true;
    lastAction = null;
  });

  let initial = "en";
  try { initial = valid(window.localStorage.getItem(STORAGE_KEY)); }
  catch { /* Private browsing may deny storage. */ }
  translate(initial);
})(); 
