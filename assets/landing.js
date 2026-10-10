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
  const select = document.getElementById("site-language");
  const status = document.getElementById("action-status");
  const statusMessage = document.getElementById("action-status-message");
  const statusClose = document.getElementById("status-close");
  const labels = [...document.querySelectorAll("[data-i18n]")];
  const actions = [...document.querySelectorAll("[data-destination]")];
  const valid = (language) => SUPPORTED.includes(language) ? language : "en";
  let lastAction = null;

  function translate(language) {
    const copy = messages[language];
    document.documentElement.lang = language;
    select.value = language;
    statusClose.setAttribute("aria-label",copy.dismiss);
    for (const node of labels) {
      const key = node.dataset.i18n;
      if (Object.hasOwn(copy,key)) node.textContent = copy[key];
    }
    if (lastAction && !status.hidden) {
      statusMessage.textContent = lastAction === "app" ? copy.unavailableApp : copy.unavailableGuide;
    }
  }

  let initial = "en";
  try { initial = valid(window.localStorage.getItem(STORAGE_KEY)); }
  catch { /* Private browsing may deny storage. */ }
  select.addEventListener("change", () => {
    const language = valid(select.value);
    translate(language);
    try { window.localStorage.setItem(STORAGE_KEY,language); }
    catch { /* Keep language active for the current visit. */ }
  });
  for (const button of actions) {
    button.addEventListener("click", () => {
      if (button.dataset.destination === "guide") {
        window.location.assign("./guide/");
        return;
      }
      lastAction = button.dataset.destination;
      const copy = messages[valid(select.value)];
      statusMessage.textContent = lastAction === "app" ? copy.unavailableApp : copy.unavailableGuide;
      status.hidden = false;
    });
  }
  statusClose.addEventListener("click", () => {
    status.hidden = true;
    lastAction = null;
  });
  translate(initial);
})();
