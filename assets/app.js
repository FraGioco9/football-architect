// HOME-01: presentation only. No career state, dates, or fixtures are fabricated.
(() => {
  "use strict";
  const copies = {
    en: {
      skip:"Skip to main content",
      navWorld:"World",
      divisionIntro:"Explore the 16 documented divisions across eight countries. No league season is running yet.",
      divisionTier1:"First division",
      divisionTier2:"Second division",
      allDivisions:"All divisions",
      crestPlaceholder:"Temporary division badge",
      placeholderNotice:"Temporary badge; final division identity artwork is not integrated.",
      countryLabel:"Country",
      tierLabel:"Tier",
      capacityLabel:"Planned club places",
      competitionUnavailable:"Competition not active",
      competitionNotice:"Club allocations, standings, fixtures and results have not been implemented.",
      otherDivision:"Other division in this country",
      relatedDivisions:"Other division in this country",
      standingsHeading:"Standings",
      standingsEmpty:"No standings are available because no season has started.",
      fixturesHeading:"Fixtures and results",
      fixturesEmpty:"No scheduled matches or results are available.",
      clubsHeading:"Participating clubs",
      clubsEmpty:"The 20 planned places have no confirmed club assignments yet.",
      brandHome:"Football Architect home",
      sidebarLabel:"Career navigation",pagesLabel:"Career pages",navHome:"Home",
      dashboard:"Dashboard",calendar:"Calendar",noClub:"No club selected",noSeason:"No active season",
      timeLabel:"Career date and phase",continue:"Continue",
      continueDisabled:"Continue unavailable: no active career",workspace:"Career workspace",
      intro:"The application shell is ready. Career management and match simulation have not been connected yet.",
      careerStatus:"Career status",careerStatusText:"No active career. Club selection, match dates and the Continue action will be enabled when career management is implemented.",
      openGuide:"Explore the game guide",backToSite:"Back to website",
      world:"World foundations",worldText:"The fictional world catalogues are available, but these identities are not yet an active playable league system.",
      countries:"Countries",divisions:"Divisions",clubs:"Documented clubs",
      calendarStatus:"Schedule not available",calendarStatusText:"Match scheduling has not been implemented in this app foundation. No fixtures or results are being simulated.",
      backDashboard:"Back to Dashboard",offline:"OFFLINE · SINGLE PLAYER",
      navGeneral:"General",
      settings:"Settings",
      preferences:"Preferences",
      settingsTitle:"Settings and saves",
      settingsIntro:"Manage your interface preferences. Career saves are not available in this preview.",
      languageHeading:"Language",
      languageHelp:"Choose the interface language. This preference is shared with the Landing and Guide on this device.",
      careerPanel:"Your career",
      saveStatus:"Saves",
      notAvailable:"Not available yet",
      account:"Account",
      noAccount:"Not required",
      gameplayStatus:"Game runtime",
      dataHeading:"Data management",
      dataText:"Import, export and career management will be available only when the save system is implemented. This preview does not create or modify careers.",
      aboutHeading:"About the game",
      aboutText:"Football Architect features an alternative football world with real countries and fictional clubs and divisions. This page is a UI preview, not a playable game.",
    },
    de: {
      skip:"Zum Hauptinhalt springen",
      navWorld:"Welt",
      divisionIntro:"Entdecke die 16 dokumentierten Ligen in acht Ländern. Der Ligabetrieb hat noch nicht begonnen.",
      divisionTier1:"Erste Liga",
      divisionTier2:"Zweite Liga",
      allDivisions:"Alle Ligen",
      crestPlaceholder:"Provisorisches Liga-Symbol",
      placeholderNotice:"Vorläufiges Symbol; das endgültige Liga-Wappen ist noch nicht integriert.",
      countryLabel:"Land",
      tierLabel:"Stufe",
      capacityLabel:"Geplante Vereinsplätze",
      competitionUnavailable:"Wettbewerb noch nicht aktiv",
      competitionNotice:"Vereinszuordnungen, Tabellen, Spielpläne und Ergebnisse sind noch nicht implementiert.",
      otherDivision:"Weitere Liga in diesem Land",
      relatedDivisions:"Weitere Liga in diesem Land",
      standingsHeading:"Tabelle",
      standingsEmpty:"Es gibt noch keine Tabelle, da die Saison nicht begonnen hat.",
      fixturesHeading:"Spielplan und Ergebnisse",
      fixturesEmpty:"Es sind keine Spiele oder Ergebnisse verfügbar.",
      clubsHeading:"Teilnehmende Vereine",
      clubsEmpty:"Für die 20 geplanten Plätze sind noch keine Vereine bestätigt.",
      brandHome:"Football Architect – Startseite",
      sidebarLabel:"Karrierenavigation",pagesLabel:"Karriereseiten",navHome:"Start",
      dashboard:"Dashboard",calendar:"Kalender",noClub:"Kein Verein ausgewählt",noSeason:"Keine aktive Saison",
      timeLabel:"Karrieredatum und Phase",continue:"Weiter",
      continueDisabled:"Weiter nicht verfügbar: keine aktive Karriere",workspace:"Karrierebereich",
      intro:"Die App-Oberfläche ist bereit. Karriereverwaltung und Spielsimulation sind noch nicht verbunden.",
      careerStatus:"Karrierestatus",careerStatusText:"Keine aktive Karriere. Vereinsauswahl, Spieltermine und die Schaltfläche Weiter werden erst mit der Karriereverwaltung aktiviert.",
      openGuide:"Spielführer ansehen",backToSite:"Zurück zur Website",
      world:"Grundlagen der Spielwelt",worldText:"Die fiktiven Kataloge sind vorhanden, bilden aber noch kein spielbares Ligasystem.",
      countries:"Länder",divisions:"Ligen",clubs:"Dokumentierte Vereine",
      calendarStatus:"Kein Spielplan verfügbar",calendarStatusText:"Die Spielplanung ist noch nicht implementiert. Es werden keine Begegnungen oder Ergebnisse simuliert.",
      backDashboard:"Zurück zum Dashboard",offline:"OFFLINE · EINZELSPIELER",
      navGeneral:"Allgemein",
      settings:"Einstellungen",
      preferences:"Präferenzen",
      settingsTitle:"Einstellungen und Spielstände",
      settingsIntro:"Verwalte die Sprache der Oberfläche. Karriere-Spielstände sind in dieser Vorschau noch nicht verfügbar.",
      languageHeading:"Sprache",
      languageHelp:"Wähle die Sprache der Oberfläche. Die Einstellung gilt auf diesem Gerät auch für Startseite und Leitfaden.",
      careerPanel:"Deine Karriere",
      saveStatus:"Spielstände",
      notAvailable:"Noch nicht verfügbar",
      account:"Konto",
      noAccount:"Nicht erforderlich",
      gameplayStatus:"Spielsystem",
      dataHeading:"Datenverwaltung",
      dataText:"Import, Export und Karriereverwaltung werden erst mit dem Speichersystem verfügbar. Diese Vorschau erstellt oder ändert keine Karrieren.",
      aboutHeading:"Über das Spiel",
      aboutText:"Football Architect zeigt eine alternative Fußballwelt mit realen Ländern sowie fiktiven Vereinen und Ligen. Dies ist eine Vorschau der Oberfläche, kein spielbares Spiel.",
    },
    es: {
      skip:"Saltar al contenido principal",
      navWorld:"Mundo",
      divisionIntro:"Explora las 16 divisiones documentadas en ocho países. La competición aún no ha comenzado.",
      divisionTier1:"Primera división",
      divisionTier2:"Segunda división",
      allDivisions:"Todas las divisiones",
      crestPlaceholder:"Emblema provisional de división",
      placeholderNotice:"Emblema provisional; el diseño definitivo de la división todavía no está integrado.",
      countryLabel:"País",
      tierLabel:"Nivel",
      capacityLabel:"Plazas previstas para clubes",
      competitionUnavailable:"Competición aún no activa",
      competitionNotice:"Todavía no existen asignaciones de clubes, clasificaciones, calendarios ni resultados.",
      otherDivision:"Otra división de este país",
      relatedDivisions:"Otra división de este país",
      standingsHeading:"Clasificación",
      standingsEmpty:"Todavía no hay clasificación porque la temporada no ha comenzado.",
      fixturesHeading:"Calendario y resultados",
      fixturesEmpty:"Todavía no hay partidos programados ni resultados.",
      clubsHeading:"Clubes participantes",
      clubsEmpty:"Las 20 plazas previstas aún no tienen clubes asignados.",
      brandHome:"Inicio de Football Architect",
      sidebarLabel:"Navegación de carrera",pagesLabel:"Páginas de carrera",navHome:"Inicio",
      dashboard:"Panel",calendar:"Calendario",noClub:"Ningún club seleccionado",noSeason:"Sin temporada activa",
      timeLabel:"Fecha y fase de la carrera",continue:"Continuar",
      continueDisabled:"Continuar no disponible: sin carrera activa",workspace:"Área de carrera",
      intro:"La estructura de la aplicación está lista. La gestión de carreras y la simulación aún no están conectadas.",
      careerStatus:"Estado de la carrera",careerStatusText:"No hay una carrera activa. La selección de club, las fechas y el botón Continuar se activarán al implementar las carreras.",
      openGuide:"Explorar la guía",backToSite:"Volver al sitio",
      world:"Bases del mundo",worldText:"Los catálogos del mundo ficticio están disponibles, pero aún no forman un sistema de ligas jugable.",
      countries:"Países",divisions:"Divisiones",clubs:"Clubes documentados",
      calendarStatus:"Calendario no disponible",calendarStatusText:"La programación de partidos aún no está implementada. No se simulan encuentros ni resultados.",
      backDashboard:"Volver al panel",offline:"SIN CONEXIÓN · UN JUGADOR",
      navGeneral:"General",
      settings:"Ajustes",
      preferences:"Preferencias",
      settingsTitle:"Ajustes y partidas guardadas",
      settingsIntro:"Configura el idioma de la interfaz. Las partidas de carrera no están disponibles en esta vista previa.",
      languageHeading:"Idioma",
      languageHelp:"Elige el idioma de la interfaz. La preferencia se comparte con la portada y la guía en este dispositivo.",
      careerPanel:"Tu carrera",
      saveStatus:"Partidas guardadas",
      notAvailable:"Aún no disponible",
      account:"Cuenta",
      noAccount:"No necesaria",
      gameplayStatus:"Motor del juego",
      dataHeading:"Gestión de datos",
      dataText:"La importación, exportación y gestión de carreras estarán disponibles cuando exista el sistema de guardado. Esta vista previa no crea ni modifica carreras.",
      aboutHeading:"Acerca del juego",
      aboutText:"Football Architect presenta un mundo futbolístico alternativo con países reales, clubes y divisiones ficticios. Esta página es una vista previa, no un juego funcional.",
    },
    fr: {
      skip:"Aller au contenu principal",
      navWorld:"Monde",
      divisionIntro:"Découvrez les 16 divisions répertoriées dans huit pays. Aucune compétition n'est encore en cours.",
      divisionTier1:"Première division",
      divisionTier2:"Deuxième division",
      allDivisions:"Toutes les divisions",
      crestPlaceholder:"Emblème provisoire de division",
      placeholderNotice:"Emblème provisoire ; le visuel définitif de cette division n'est pas intégré.",
      countryLabel:"Pays",
      tierLabel:"Niveau",
      capacityLabel:"Places prévues pour les clubs",
      competitionUnavailable:"Compétition inactive",
      competitionNotice:"Les affectations de clubs, classements, calendriers et résultats ne sont pas encore disponibles.",
      otherDivision:"Autre division du pays",
      relatedDivisions:"Autre division du pays",
      standingsHeading:"Classement",
      standingsEmpty:"Aucun classement n'est disponible car la saison n'a pas commencé.",
      fixturesHeading:"Calendrier et résultats",
      fixturesEmpty:"Aucun match ni résultat n'est disponible.",
      clubsHeading:"Clubs participants",
      clubsEmpty:"Aucun club n'est encore attribué aux 20 places prévues.",
      brandHome:"Accueil de Football Architect",
      sidebarLabel:"Navigation de carrière",pagesLabel:"Pages de carrière",navHome:"Accueil",
      dashboard:"Tableau de bord",calendar:"Calendrier",noClub:"Aucun club sélectionné",noSeason:"Aucune saison active",
      timeLabel:"Date et phase de carrière",continue:"Continuer",
      continueDisabled:"Continuer indisponible : aucune carrière active",workspace:"Espace carrière",
      intro:"La structure de l’application est prête. La gestion des carrières et la simulation ne sont pas encore connectées.",
      careerStatus:"État de la carrière",careerStatusText:"Aucune carrière active. Le choix du club, les dates des matchs et le bouton Continuer seront activés avec la gestion des carrières.",
      openGuide:"Explorer le guide",backToSite:"Retour au site",
      world:"Fondations de l’univers",worldText:"Les catalogues de l’univers fictif existent, mais ne forment pas encore un système de ligues jouable.",
      countries:"Pays",divisions:"Divisions",clubs:"Clubs répertoriés",
      calendarStatus:"Calendrier indisponible",calendarStatusText:"La programmation des matchs n’est pas encore implémentée. Aucun match ou résultat n’est simulé.",
      backDashboard:"Retour au tableau de bord",offline:"HORS LIGNE · SOLO",
      navGeneral:"Général",
      settings:"Paramètres",
      preferences:"Préférences",
      settingsTitle:"Paramètres et sauvegardes",
      settingsIntro:"Configurez la langue de l’interface. Les sauvegardes de carrière ne sont pas disponibles dans cet aperçu.",
      languageHeading:"Langue",
      languageHelp:"Choisissez la langue de l’interface. Ce réglage est partagé avec l’accueil et le guide sur cet appareil.",
      careerPanel:"Votre carrière",
      saveStatus:"Sauvegardes",
      notAvailable:"Pas encore disponible",
      account:"Compte",
      noAccount:"Non requis",
      gameplayStatus:"Moteur de jeu",
      dataHeading:"Gestion des données",
      dataText:"L’importation, l’exportation et la gestion des carrières seront disponibles avec le système de sauvegarde. Cet aperçu ne crée ni ne modifie de carrière.",
      aboutHeading:"À propos du jeu",
      aboutText:"Football Architect présente un univers footballistique alternatif avec de vrais pays et des clubs et divisions fictifs. Cette page est un aperçu de l’interface, pas un jeu jouable.",
    },
    it: {
      skip:"Vai al contenuto principale",
      navWorld:"Mondo",
      divisionIntro:"Esplora le 16 divisioni documentate di otto Paesi. I campionati non sono ancora attivi.",
      divisionTier1:"Prima divisione",
      divisionTier2:"Seconda divisione",
      allDivisions:"Tutte le divisioni",
      crestPlaceholder:"Emblema provvisorio della divisione",
      placeholderNotice:"Emblema temporaneo: la grafica definitiva della divisione non è ancora integrata.",
      countryLabel:"Paese",
      tierLabel:"Livello",
      capacityLabel:"Posti club previsti",
      competitionUnavailable:"Campionato non attivo",
      competitionNotice:"Le assegnazioni dei club, le classifiche, i calendari e i risultati non sono ancora implementati.",
      otherDivision:"Altra divisione del Paese",
      relatedDivisions:"Altra divisione del Paese",
      standingsHeading:"Classifica",
      standingsEmpty:"La classifica non è disponibile perché la stagione non è iniziata.",
      fixturesHeading:"Calendario e risultati",
      fixturesEmpty:"Non sono disponibili partite programmate né risultati.",
      clubsHeading:"Club partecipanti",
      clubsEmpty:"I 20 posti previsti non hanno ancora club assegnati.",
      brandHome:"Home di Football Architect",
      sidebarLabel:"Navigazione carriera",pagesLabel:"Pagine della carriera",navHome:"Inizio",
      dashboard:"Dashboard",calendar:"Calendario",noClub:"Nessun club selezionato",noSeason:"Nessuna stagione attiva",
      timeLabel:"Data e fase della carriera",continue:"Continua",
      continueDisabled:"Continua non disponibile: nessuna carriera attiva",workspace:"Area carriera",
      intro:"La struttura dell'app è pronta. La gestione delle carriere e la simulazione delle partite non sono ancora collegate.",
      careerStatus:"Stato carriera",careerStatusText:"Nessuna carriera attiva. La scelta del club, le date e il pulsante Continua saranno disponibili quando verranno implementate le carriere.",
      openGuide:"Esplora la guida al gioco",backToSite:"Torna al sito",
      world:"Fondamenti del mondo",worldText:"I cataloghi del mondo calcistico sono disponibili, ma non costituiscono ancora un sistema di campionati giocabile.",
      countries:"Paesi",divisions:"Divisioni",clubs:"Club documentati",
      calendarStatus:"Calendario non disponibile",calendarStatusText:"La programmazione delle partite non è ancora implementata. Nessun incontro o risultato viene simulato.",
      backDashboard:"Torna alla Dashboard",offline:"OFFLINE · GIOCATORE SINGOLO",
      navGeneral:"Generale",
      settings:"Impostazioni",
      preferences:"Preferenze",
      settingsTitle:"Impostazioni e salvataggi",
      settingsIntro:"Gestisci le preferenze dell'interfaccia. I salvataggi delle carriere non sono ancora disponibili in questa anteprima.",
      languageHeading:"Lingua",
      languageHelp:"Scegli la lingua dell'interfaccia. La preferenza è condivisa con Landing e Guida su questo dispositivo.",
      careerPanel:"La tua carriera",
      saveStatus:"Salvataggi",
      notAvailable:"Non ancora disponibile",
      account:"Account",
      noAccount:"Non richiesto",
      gameplayStatus:"Motore di gioco",
      dataHeading:"Gestione dati",
      dataText:"Importazione, esportazione e gestione delle carriere saranno disponibili soltanto con il sistema di salvataggio. Questa anteprima non crea né modifica carriere.",
      aboutHeading:"Informazioni sul gioco",
      aboutText:"Football Architect presenta un universo calcistico alternativo con Paesi reali e club e divisioni inventati. Questa pagina è un'anteprima dell'interfaccia, non un gioco funzionante.",
    }
  };
  const worldCountryNames = {"en":{"IT":"Italy","ENG":"England","ES":"Spain","DE":"Germany","FR":"France","PT":"Portugal","NL":"Netherlands","BR":"Brazil"},"de":{"IT":"Italien","ENG":"England","ES":"Spanien","DE":"Deutschland","FR":"Frankreich","PT":"Portugal","NL":"Niederlande","BR":"Brasilien"},"es":{"IT":"Italia","ENG":"Inglaterra","ES":"España","DE":"Alemania","FR":"Francia","PT":"Portugal","NL":"Países Bajos","BR":"Brasil"},"fr":{"IT":"Italie","ENG":"Angleterre","ES":"Espagne","DE":"Allemagne","FR":"France","PT":"Portugal","NL":"Pays-Bas","BR":"Brésil"},"it":{"IT":"Italia","ENG":"Inghilterra","ES":"Spagna","DE":"Germania","FR":"Francia","PT":"Portogallo","NL":"Paesi Bassi","BR":"Brasile"}};
  const words = [...document.querySelectorAll("[data-app-i18n]")];
  const accessible = [...document.querySelectorAll("[data-app-aria]")];
  const dashboard = document.getElementById("app-dashboard");
  const calendar = document.getElementById("app-calendar");
  const settings = document.getElementById("app-settings");
  const divisions = document.getElementById("app-divisions");
  const links = {
    dashboard: document.getElementById("app-nav-dashboard"),
    calendar: document.getElementById("app-nav-calendar"),
    settings: document.getElementById("app-nav-settings"),
    divisions: document.getElementById("app-nav-divisions")
  };
  function language() {
    return Object.hasOwn(copies, document.documentElement.lang) ? document.documentElement.lang : "en";
  }
  function activeView() {
    // Each page has its own static document for direct loading and refresh.
    const path = (window.location.pathname || "").replace(/\/+$/, "");
    if (path.includes("/app/world/divisions")) return "divisions";
    if (path.endsWith("/app/calendar")) return "calendar";
    if (path.endsWith("/app/settings")) return "settings";
    if (path.endsWith("/app/dashboard")) return "dashboard";
    return "dashboard";
  }
  function renderLanguage() {
    const strings = copies[language()];
    for (const node of words) {
      if (Object.hasOwn(strings, node.dataset.appI18n)) node.textContent = strings[node.dataset.appI18n];
    }
    for (const node of accessible) {
      if (Object.hasOwn(strings, node.dataset.appAria)) node.setAttribute("aria-label", strings[node.dataset.appAria]);
      if (node.dataset.appAria === "crestPlaceholder" && node.textContent?.trim()) node.setAttribute("aria-label", strings.crestPlaceholder + " — " + node.textContent.trim());
    }
    for (const node of document.querySelectorAll("[data-world-country]")) {
      const countryName = worldCountryNames[language()]?.[node.dataset.worldCountry];
      if (countryName) node.textContent = countryName;
    }
    const detail = document.getElementById("division-detail-name");
    document.title = (activeView() === "divisions" && detail ? detail.textContent : strings[activeView()]) + " — Football Architect";
  }
  function renderView() {
    const current = activeView();
    dashboard.hidden = current !== "dashboard";
    calendar.hidden = current !== "calendar";
    settings.hidden = current !== "settings";
    if (divisions) divisions.hidden = current !== "divisions";
    for (const [view, link] of Object.entries(links)) {
      if (!link) continue;
      const selected = current === view;
      link.classList.toggle("is-active", selected);
      if (selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    renderLanguage();
  }
  new MutationObserver(renderLanguage).observe(document.documentElement, {
    attributes: true, attributeFilter: ["lang"]
  });
  renderView();
})();
