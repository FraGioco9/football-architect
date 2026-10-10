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
      unavailableGuide:"The guide is not available yet. This area is being designed.",
      guideTitle:"Guide",
      home:"Home",
      guideDivisionsHeading:"Divisions",
      guideClubsHeading:"Clubs",
      guideDivisionsText1:"Divisions are the competitions in which clubs are organized within each country. Every country has two levels: a first division and a second division.",
      guideDivisionsText2:"Each division is designed for 20 clubs. A division describes the level of competition; it does not define a club's identity.",
      guideClubsText1:"Clubs are the football teams in Football Architect. Each club has its own name, country and unique three-letter abbreviation.",
      guideClubsText2:"Clubs are the teams that take part in divisions. Their identity remains separate from the division in which they compete."
    },
    de: {
      language:"Sprache",dismiss:"Hinweis schließen",summary:"Entdecke eine alternative Fußballwelt.",
      enter:"App öffnen",guide:"Leitfaden",universe:"Fußballwelt",
      countries:"Länder",divisions:"Ligen",clubs:"Dokumentierte Vereine",
      footer:"In Entwicklung",
      unavailableApp:"Die App ist noch nicht verfügbar. Dieser Bereich wird entwickelt.",
      unavailableGuide:"Der Leitfaden ist noch nicht verfügbar. Dieser Bereich wird entwickelt.",
      guideTitle:"Leitfaden",
      home:"Startseite",
      guideDivisionsHeading:"Ligen",
      guideClubsHeading:"Vereine",
      guideDivisionsText1:"Ligen sind die Wettbewerbe, in denen Vereine innerhalb eines Landes organisiert werden. Jedes Land hat zwei Ebenen: eine erste und eine zweite Liga.",
      guideDivisionsText2:"Jede Liga ist für 20 Vereine vorgesehen. Die Liga beschreibt die Wettbewerbsebene, nicht die Identität eines Vereins.",
      guideClubsText1:"Vereine sind die Fußballmannschaften in Football Architect. Jeder Verein hat einen eigenen Namen, ein Land und ein eindeutiges Kürzel aus drei Buchstaben.",
      guideClubsText2:"Vereine nehmen an Ligawettbewerben teil. Ihre Identität bleibt unabhängig von der Liga, in der sie spielen."
    },
    es: {
      language:"Idioma",dismiss:"Cerrar aviso",summary:"Explora un universo futbolístico alternativo.",
      enter:"Entrar en la aplicación",guide:"Guía",universe:"Mundo del fútbol",
      countries:"Países",divisions:"Divisiones",clubs:"Clubes documentados",
      footer:"En desarrollo",
      unavailableApp:"La aplicación aún no está disponible. Esta sección está en desarrollo.",
      unavailableGuide:"La guía aún no está disponible. Esta sección está en desarrollo.",
      guideTitle:"Guía",
      home:"Inicio",
      guideDivisionsHeading:"Divisiones",
      guideClubsHeading:"Clubes",
      guideDivisionsText1:"Las divisiones son las competiciones que organizan a los clubes de cada país. Cada país tiene dos niveles: primera y segunda división.",
      guideDivisionsText2:"Cada división está pensada para 20 clubes. La división indica el nivel de competición, no la identidad del club.",
      guideClubsText1:"Los clubes son los equipos de fútbol de Football Architect. Cada club tiene su propio nombre, país y una sigla única de tres letras.",
      guideClubsText2:"Los clubes participan en las divisiones, pero su identidad es independiente de la división en la que compiten."
    },
    fr: {
      language:"Langue",dismiss:"Fermer le message",summary:"Explorez un univers footballistique alternatif.",
      enter:"Accéder à l’application",guide:"Guide",universe:"Univers du football",
      countries:"Pays",divisions:"Divisions",clubs:"Clubs répertoriés",
      footer:"En développement",
      unavailableApp:"L’application n’est pas encore disponible. Cette section est en cours de conception.",
      unavailableGuide:"Le guide n’est pas encore disponible. Cette section est en cours de conception.",
      guideTitle:"Guide",
      home:"Accueil",
      guideDivisionsHeading:"Divisions",
      guideClubsHeading:"Clubs",
      guideDivisionsText1:"Les divisions sont les compétitions qui regroupent les clubs dans chaque pays. Chaque pays comprend deux niveaux : une première et une deuxième division.",
      guideDivisionsText2:"Chaque division est prévue pour 20 clubs. Elle indique le niveau de compétition, pas l’identité d’un club.",
      guideClubsText1:"Les clubs sont les équipes de football de Football Architect. Chaque club possède un nom, un pays et un sigle unique de trois lettres.",
      guideClubsText2:"Les clubs participent aux divisions, mais leur identité reste indépendante de la division dans laquelle ils évoluent."
    },
    it: {
      language:"Lingua",dismiss:"Chiudi avviso",summary:"Esplora un universo calcistico alternativo.",
      enter:"Entra nell'app",guide:"Guida",universe:"Mondo calcistico",
      countries:"Paesi",divisions:"Divisioni",clubs:"Club documentati",
      footer:"In sviluppo",
      unavailableApp:"L'app non è ancora disponibile. Questa sezione è in progettazione.",
      unavailableGuide:"La guida non è ancora disponibile. Questa sezione è in progettazione.",
      guideTitle:"Guida",
      home:"Home",
      guideDivisionsHeading:"Divisioni",
      guideClubsHeading:"Club",
      guideDivisionsText1:"Le divisioni sono le competizioni che organizzano i club all’interno di ciascun Paese. Ogni Paese ha due livelli: una prima e una seconda divisione.",
      guideDivisionsText2:"Ogni divisione è progettata per 20 club. La divisione indica il livello della competizione, non l’identità del club.",
      guideClubsText1:"I club sono le squadre di calcio di Football Architect. Ogni club ha un proprio nome, un Paese e una sigla univoca di tre lettere.",
      guideClubsText2:"I club partecipano alle divisioni, ma la loro identità resta indipendente dalla divisione in cui competono."
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
    if (statusClose) statusClose.setAttribute("aria-label", copy.dismiss);
    for (const node of labels) {
      const key = node.dataset.i18n;
      if (Object.hasOwn(copy, key)) node.textContent = copy[key];
    }
    if (lastAction && status && statusMessage && !status.hidden) {
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
      if (button.dataset.destination === "guide") {
        window.location.assign("./guide/");
        return;
      }
      lastAction = button.dataset.destination;
      const copy = messages[language];
      statusMessage.textContent = lastAction === "app" ? copy.unavailableApp : copy.unavailableGuide;
      status.hidden = false;
      closeMenu();
    });
  }
  if (statusClose) statusClose.addEventListener("click", () => {
    status.hidden = true;
    lastAction = null;
  });

  let initial = "en";
  try { initial = valid(window.localStorage.getItem(STORAGE_KEY)); }
  catch { /* Private browsing may deny storage. */ }
  translate(initial);
})(); 
