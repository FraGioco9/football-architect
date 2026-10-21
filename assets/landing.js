// LAND-01–06: five languages; shared preference for future Guide and Home.
(() => {
  "use strict";
  const STORAGE_KEY = "football-architect:language";
  const SUPPORTED = ["en","de","es","fr","it"];
  const messages = {
    en: {
      language:"Language",brandHome:"Football Architect home",guideNavigation:"Page navigation",guideSections:"Guide sections",summary:"Explore an alternative football world.",
      enter:"Explore app preview",guide:"Guide",universe:"Football world",
      countries:"Countries",divisions:"Divisions",clubs:"Documented clubs",
      footer:"Work in progress",
      guideTitle:"Guide",
      home:"Home",
      guideIntro:"Discover the structure of the world, its clubs and the rhythm of its competitions.",
      guideWorldHeading:"The football world",guideWorldHeadingText1:"Football Architect connects eight countries, sixteen domestic divisions and 320 clubs in one fictional football world. Each country has a first and second tier, with sixteen active clubs in each division.",guideWorldHeadingText2:"The club registry also includes 64 inactive clubs. Catalogue identity and sporting participation are separate: an inactive club is not automatically a league participant.",
      guideMovementHeading:"Movement between tiers",guideMovementHeadingText1:"Promotion and relegation connect the two domestic tiers. The planned rules distinguish direct places from playoff and playout places; consult competition Rules for the applicable format.",guideMovementHeadingText2:"These are sporting rules of the world, not a promise that a public simulation currently computes promotion, relegation or tie-breakers.",
      guideCalendarHeading:"Seasons and calendar",guideCalendarHeadingText1:"The world calendar models a 56-day cycle across eight weeks: twelve preseason days, domestic and international event markers, scheduled pauses and a transition day.",guideCalendarHeadingText2:"The two international cup finals have separate days. Calendar markers describe the season structure; they do not generate kickoff times, fixtures, scores or live results.",
      guideCupsHeading:"International cups",guideCupsHeadingText1:"The Sovereign Cup and Federation Cup bring clubs together beyond national borders. Their designed path includes a league phase and knockout rounds, ending in separate finals.",guideCupsHeadingText2:"International competition pages are evolving. Empty states mean that fixtures, standings or results have not been supplied; they must not be mistaken for completed games.",
      guideRecordsHeading:"Statistics and history",guideRecordsHeadingText1:"Competition views separate current standings and fixtures from team and player statistics. History explores completed seasons, champions and records when authoritative archive data exists.",guideRecordsHeadingText2:"Unavailable seasons and missing statistics use explicit empty states rather than invented historical results.",
      guideExploreHeading:"Explore the app",guideExploreHeadingText1:"Use Competitions to choose a division and explore its Overview, Standings, Fixtures, Stats and History. Club pages present individual identities; Calendar explains the shared season rhythm.",guideExploreHeadingText2:"The Guide explains concepts rather than listing every club or displaying provisional development results. Navigation and available views may change as the app evolves.",
      guideDivisionsHeading:"Divisions",
      guideClubsHeading:"Clubs",
      guideDivisionsText1:"Divisions are the competitions in which clubs are organized within each country. Every country has two levels: a first division and a second division.",
      guideDivisionsText2:"Each division is designed for 16 clubs. A division describes the level of competition; it does not define a club's identity.",
      guideClubsText1:"Clubs are the football teams in Football Architect. Each club has its own name, country and unique three-letter abbreviation.",
      guideClubsText2:"Clubs are the teams that take part in divisions. Their identity remains separate from the division in which they compete."
    },
    de: {
      language:"Sprache",brandHome:"Football Architect – Startseite",guideNavigation:"Seitennavigation",guideSections:"Leitfadenabschnitte",summary:"Entdecke eine alternative Fußballwelt.",
      enter:"App-Vorschau öffnen",guide:"Leitfaden",universe:"Fußballwelt",
      countries:"Länder",divisions:"Ligen",clubs:"Dokumentierte Vereine",
      footer:"In Entwicklung",
      guideTitle:"Leitfaden",
      home:"Startseite",
      guideIntro:"Entdecke die Fußballwelt, ihre Vereine und den Rhythmus ihrer Wettbewerbe.",
      guideWorldHeading:"Die Fußballwelt",guideWorldHeadingText1:"Football Architect verbindet acht Länder, sechzehn nationale Ligen und 320 Vereine zu einer fiktiven Fußballwelt. Jedes Land hat zwei Ligen mit jeweils sechzehn aktiven Vereinen.",guideWorldHeadingText2:"Das Verzeichnis umfasst auch 64 inaktive Vereine. Vereinsidentität und Teilnahme am Spielbetrieb sind unabhängig voneinander.",
      guideMovementHeading:"Auf- und Abstieg",guideMovementHeadingText1:"Auf- und Abstieg verbinden die beiden nationalen Ligen. Das geplante Regelwerk unterscheidet direkte Plätze sowie Playoffs und Playouts; die geltenden Details stehen unter Regeln des Wettbewerbs.",guideMovementHeadingText2:"Die Regelbeschreibung bedeutet nicht, dass die öffentliche Simulation Auf- und Abstieg oder Gleichstandsregeln bereits berechnet.",
      guideCalendarHeading:"Saisons und Kalender",guideCalendarHeadingText1:"Der Weltkalender umfasst 56 Tage in acht Wochen: zwölf Vorbereitungstage, nationale und internationale Ereignismarkierungen, Pausen und einen Übergangstag.",guideCalendarHeadingText2:"Die beiden internationalen Pokalfinals haben eigene Tage. Kalendermarkierungen erzeugen keine Anstoßzeiten, Spiele oder Ergebnisse.",
      guideCupsHeading:"Internationale Pokale",guideCupsHeadingText1:"Sovereign Cup und Federation Cup verbinden Vereine über Landesgrenzen hinweg. Der vorgesehene Weg umfasst eine Ligaphase und K.-o.-Runden mit getrennten Finals.",guideCupsHeadingText2:"Die internationalen Wettbewerbsseiten befinden sich in Entwicklung. Leere Bereiche sind keine abgeschlossenen Partien.",
      guideRecordsHeading:"Statistiken und Geschichte",guideRecordsHeadingText1:"Wettbewerbsseiten trennen Tabellen und Spielpläne von Mannschafts- und Spielerstatistiken. Der Bereich Geschichte zeigt abgeschlossene Saisons, Meister und Rekorde, sofern Archivdaten vorliegen.",guideRecordsHeadingText2:"Fehlende Daten werden ausdrücklich gekennzeichnet und nicht erfunden.",
      guideExploreHeading:"Die App erkunden",guideExploreHeadingText1:"Unter Wettbewerbe lassen sich Übersicht, Tabelle, Spielplan, Statistiken und Geschichte aufrufen. Vereinsseiten zeigen individuelle Identitäten; der Kalender erklärt den Saisonablauf.",guideExploreHeadingText2:"Dieser Leitfaden erläutert Konzepte, statt alle Vereine oder vorläufige Entwicklungsergebnisse aufzulisten.",
      guideDivisionsHeading:"Ligen",
      guideClubsHeading:"Vereine",
      guideDivisionsText1:"Ligen sind die Wettbewerbe, in denen Vereine innerhalb eines Landes organisiert werden. Jedes Land hat zwei Ebenen: eine erste und eine zweite Liga.",
      guideDivisionsText2:"Jede Liga ist für 16 Vereine vorgesehen. Die Liga beschreibt die Wettbewerbsebene, nicht die Identität eines Vereins.",
      guideClubsText1:"Vereine sind die Fußballmannschaften in Football Architect. Jeder Verein hat einen eigenen Namen, ein Land und ein eindeutiges Kürzel aus drei Buchstaben.",
      guideClubsText2:"Vereine nehmen an Ligawettbewerben teil. Ihre Identität bleibt unabhängig von der Liga, in der sie spielen."
    },
    es: {
      language:"Idioma",brandHome:"Inicio de Football Architect",guideNavigation:"Navegación de la página",guideSections:"Secciones de la guía",summary:"Explora un universo futbolístico alternativo.",
      enter:"Explorar vista previa de la app",guide:"Guía",universe:"Mundo del fútbol",
      countries:"Países",divisions:"Divisiones",clubs:"Clubes documentados",
      footer:"En desarrollo",
      guideTitle:"Guía",
      home:"Inicio",
      guideIntro:"Descubre el mundo, sus clubes y el ritmo de sus competiciones.",
      guideWorldHeading:"El mundo del fútbol",guideWorldHeadingText1:"Football Architect reúne ocho países, dieciséis divisiones nacionales y 320 clubes en un mundo ficticio. Cada país tiene dos categorías con dieciséis clubes activos por división.",guideWorldHeadingText2:"El registro también incluye 64 clubes inactivos. La identidad del club no implica su participación en una competición.",
      guideMovementHeading:"Ascensos y descensos",guideMovementHeadingText1:"Los ascensos y descensos conectan los dos niveles nacionales. Las reglas previstas distinguen plazas directas, playoffs y eliminatorias de permanencia; consulta las reglas de cada competición.",guideMovementHeadingText2:"Estas reglas no significan que la simulación pública calcule ya los ascensos, descensos o desempates.",
      guideCalendarHeading:"Temporadas y calendario",guideCalendarHeadingText1:"El calendario mundial organiza 56 días en ocho semanas: doce días de pretemporada, marcadores de competiciones nacionales e internacionales, pausas y un día de transición.",guideCalendarHeadingText2:"Las dos finales internacionales se celebran en días distintos. Los marcadores no generan horarios, partidos ni resultados.",
      guideCupsHeading:"Copas internacionales",guideCupsHeadingText1:"Sovereign Cup y Federation Cup reúnen a clubes de distintos países. Su formato previsto incluye una fase de liga y eliminatorias hasta dos finales separadas.",guideCupsHeadingText2:"Las páginas internacionales siguen en desarrollo. Un estado vacío no equivale a un partido disputado.",
      guideRecordsHeading:"Estadísticas e historia",guideRecordsHeadingText1:"Las páginas separan clasificaciones y partidos de estadísticas de equipos y jugadores. Historia muestra temporadas terminadas, campeones y récords cuando hay datos de archivo.",guideRecordsHeadingText2:"Los datos ausentes aparecen como estados vacíos, sin inventar resultados.",
      guideExploreHeading:"Explorar la aplicación",guideExploreHeadingText1:"En Competiciones puedes abrir Resumen, Clasificación, Partidos, Estadísticas e Historia. Las páginas de clubes presentan su identidad y Calendario explica el ciclo común.",guideExploreHeadingText2:"Esta guía explica conceptos, no enumera todos los clubes ni publica resultados provisionales.",
      guideDivisionsHeading:"Divisiones",
      guideClubsHeading:"Clubes",
      guideDivisionsText1:"Las divisiones son las competiciones que organizan a los clubes de cada país. Cada país tiene dos niveles: primera y segunda división.",
      guideDivisionsText2:"Cada división está pensada para 16 clubes. La división indica el nivel de competición, no la identidad del club.",
      guideClubsText1:"Los clubes son los equipos de fútbol de Football Architect. Cada club tiene su propio nombre, país y una sigla única de tres letras.",
      guideClubsText2:"Los clubes participan en las divisiones, pero su identidad es independiente de la división en la que compiten."
    },
    fr: {
      language:"Langue",brandHome:"Accueil de Football Architect",guideNavigation:"Navigation de la page",guideSections:"Sections du guide",summary:"Explorez un univers footballistique alternatif.",
      enter:"Explorer l’aperçu de l’app",guide:"Guide",universe:"Univers du football",
      countries:"Pays",divisions:"Divisions",clubs:"Clubs répertoriés",
      footer:"En développement",
      guideTitle:"Guide",
      home:"Accueil",
      guideIntro:"Découvrez le monde, ses clubs et le rythme de ses compétitions.",
      guideWorldHeading:"L'univers du football",guideWorldHeadingText1:"Football Architect réunit huit pays, seize divisions nationales et 320 clubs dans un monde fictif. Chaque pays possède deux niveaux de seize clubs actifs chacun.",guideWorldHeadingText2:"Le registre contient également 64 clubs inactifs. L'identité d'un club ne détermine pas sa participation à une compétition.",
      guideMovementHeading:"Montées et descentes",guideMovementHeadingText1:"Les montées et descentes relient les deux niveaux nationaux. Les règles prévues distinguent les places directes des barrages; consultez les règles de chaque compétition.",guideMovementHeadingText2:"Cette description ne signifie pas que la simulation publique calcule déjà les montées, descentes ou départages.",
      guideCalendarHeading:"Saisons et calendrier",guideCalendarHeadingText1:"Le calendrier mondial couvre 56 jours en huit semaines : douze jours de présaison, des repères nationaux et internationaux, des pauses et un jour de transition.",guideCalendarHeadingText2:"Les deux finales internationales ont lieu à des jours distincts. Les repères ne génèrent ni horaires, ni rencontres, ni résultats.",
      guideCupsHeading:"Coupes internationales",guideCupsHeadingText1:"La Sovereign Cup et la Federation Cup réunissent des clubs de plusieurs pays. Leur format prévu comprend une phase de ligue et des tours à élimination directe jusqu'à deux finales distinctes.",guideCupsHeadingText2:"Les pages de ces compétitions évoluent encore. Une zone vide ne signifie pas qu'un match a été joué.",
      guideRecordsHeading:"Statistiques et histoire",guideRecordsHeadingText1:"Les compétitions distinguent classements et rencontres des statistiques d'équipes et de joueurs. L'historique présente saisons achevées, champions et records lorsque les archives existent.",guideRecordsHeadingText2:"Les données manquantes restent explicitement indisponibles, sans résultats inventés.",
      guideExploreHeading:"Explorer l'application",guideExploreHeadingText1:"Dans Compétitions, consultez Présentation, Classement, Rencontres, Statistiques et Historique. Les pages des clubs montrent leur identité; le Calendrier décrit le cycle commun.",guideExploreHeadingText2:"Ce guide explique les concepts sans répertorier tous les clubs ni publier de résultats provisoires.",
      guideDivisionsHeading:"Divisions",
      guideClubsHeading:"Clubs",
      guideDivisionsText1:"Les divisions sont les compétitions qui regroupent les clubs dans chaque pays. Chaque pays comprend deux niveaux : une première et une deuxième division.",
      guideDivisionsText2:"Chaque division est prévue pour 16 clubs. Elle indique le niveau de compétition, pas l’identité d’un club.",
      guideClubsText1:"Les clubs sont les équipes de football de Football Architect. Chaque club possède un nom, un pays et un sigle unique de trois lettres.",
      guideClubsText2:"Les clubs participent aux divisions, mais leur identité reste indépendante de la division dans laquelle ils évoluent."
    },
    it: {
      language:"Lingua",brandHome:"Home di Football Architect",guideNavigation:"Navigazione della pagina",guideSections:"Sezioni della guida",summary:"Esplora un universo calcistico alternativo.",
      enter:"Esplora l’anteprima dell’app",guide:"Guida",universe:"Mondo calcistico",
      countries:"Paesi",divisions:"Divisioni",clubs:"Club documentati",
      footer:"In sviluppo",
      guideTitle:"Guida",
      home:"Home",
      guideIntro:"Scopri la struttura del mondo, i suoi club e il ritmo delle competizioni.",
      guideWorldHeading:"Il mondo del calcio",guideWorldHeadingText1:"Football Architect collega otto Paesi, sedici divisioni nazionali e 320 club in un universo calcistico immaginario. Ogni Paese ha due livelli con sedici club attivi per divisione.",guideWorldHeadingText2:"Il registro comprende anche 64 club inattivi. L'identità di un club è distinta dalla sua partecipazione ai campionati.",
      guideMovementHeading:"Promozioni e retrocessioni",guideMovementHeadingText1:"Promozioni e retrocessioni collegano i due livelli nazionali. Le regole progettate distinguono posti diretti, playoff e playout; consulta la sezione Rules della competizione per il formato applicabile.",guideMovementHeadingText2:"Queste regole non implicano che la simulazione pubblica calcoli già promozioni, retrocessioni o criteri di spareggio.",
      guideCalendarHeading:"Stagioni e calendario",guideCalendarHeadingText1:"Il calendario mondiale prevede un ciclo di 56 giorni in otto settimane: dodici giorni di preseason, eventi nazionali e internazionali, pause e un giorno di transizione.",guideCalendarHeadingText2:"Le finali delle due coppe internazionali si svolgono in giorni distinti. I marcatori del calendario non generano orari, partite o risultati.",
      guideCupsHeading:"Coppe internazionali",guideCupsHeadingText1:"Sovereign Cup e Federation Cup riuniscono club di Paesi differenti. Il formato progettato comprende una fase campionato e turni a eliminazione diretta, fino a due finali distinte.",guideCupsHeadingText2:"Le pagine delle competizioni internazionali sono ancora in evoluzione. Uno stato vuoto non rappresenta una partita giocata.",
      guideRecordsHeading:"Statistiche e storia",guideRecordsHeadingText1:"Le pagine delle competizioni distinguono classifiche e partite dalle statistiche di squadre e giocatori. History raccoglie stagioni concluse, campioni e record quando esistono dati d'archivio.",guideRecordsHeadingText2:"Stagioni e statistiche non disponibili sono indicate esplicitamente, senza inventare risultati.",
      guideExploreHeading:"Esplora l'app",guideExploreHeadingText1:"Da Competitions puoi consultare Overview, Standings, Fixtures, Stats e History. Le pagine dei club presentano le loro identità; Calendar spiega il ciclo condiviso delle stagioni.",guideExploreHeadingText2:"La guida spiega i concetti, senza catalogare ogni club né presentare risultati provvisori dell'ambiente di sviluppo.",
      guideDivisionsHeading:"Divisioni",
      guideClubsHeading:"Club",
      guideDivisionsText1:"Le divisioni sono le competizioni che organizzano i club all’interno di ciascun Paese. Ogni Paese ha due livelli: una prima e una seconda divisione.",
      guideDivisionsText2:"Ogni divisione è progettata per 16 club. La divisione indica il livello della competizione, non l’identità del club.",
      guideClubsText1:"I club sono le squadre di calcio di Football Architect. Ogni club ha un proprio nome, un Paese e una sigla univoca di tre lettere.",
      guideClubsText2:"I club partecipano alle divisioni, ma la loro identità resta indipendente dalla divisione in cui competono."
    }
  };
  const languageControl = document.getElementById("language-control");
  const trigger = document.getElementById("site-language");
  const languageValue = document.getElementById("language-value");
  const menu = document.getElementById("language-options");
  const options = [...document.querySelectorAll("[data-language]")];
  const labels = [...document.querySelectorAll("[data-i18n]")];
  const accessible = [...document.querySelectorAll("[data-i18n-aria]")];
  const actions = [...document.querySelectorAll("[data-destination]")];
  const valid = (value) => SUPPORTED.includes(value) ? value : "en";
  let language = "en";
  let activeIndex = 0;
  function translate(value, persist = false) {
    language = valid(value);
    const copy = messages[language];
    document.documentElement.lang = language;
    languageValue.textContent = options.find(option => option.dataset.language === language).textContent;
    for (const option of options) {
      option.setAttribute("aria-selected", String(option.dataset.language === language));
    }
    for (const node of labels) {
      const key = node.dataset.i18n;
      if (Object.hasOwn(copy, key)) node.textContent = copy[key];
    }
    for (const node of accessible) {
      const key = node.dataset.i18nAria;
      if (Object.hasOwn(copy, key)) node.setAttribute("aria-label", copy[key]);
    }
    if (labels.some(node => node.dataset.i18n === "guideTitle")) document.title = copy.guideTitle + " — Football Architect";
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

  // Public CTA uses app.<domain>; local and unconfigured previews use canonical paths.
  const previewHost = (window.location?.hostname || "").toLowerCase();
  const preview = [...document.querySelectorAll('a.cta-primary')][0];
  if (preview && document.documentElement.dataset.faDevAppOrigin) {
    preview.href = document.documentElement.dataset.faDevAppOrigin + "/dashboard";
  } else if (preview && previewHost.startsWith("app.")) {
    preview.href = "/dashboard";
  } else if (preview && previewHost && !/^(?:localhost|::1)$/.test(previewHost) &&
      !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(previewHost) &&
      !/\.(?:local|localhost|vercel\.app|github\.io)$/.test(previewHost)) {
    const host = previewHost.startsWith("www.") ? previewHost.slice(4) : previewHost;
    preview.href = (window.location.protocol || "https:") + "//app." + host + "/dashboard";
  }
  // The preview is a native link; only the Guide button needs scripted navigation.
  for (const button of actions) {
    if (button.dataset.destination !== "guide") continue;
    button.addEventListener("click", () => window.location.assign("/guide"));
  }
  // Highlight the Guide section selected by click or URL hash.
  const guideLinks = [...document.querySelectorAll("[data-guide-section]")];
  if (guideLinks.length) {
    const knownSections = new Set(guideLinks.map(link => link.dataset.guideSection));
    function setCurrentGuideSection(id) {
      const active = knownSections.has(id) ? id : "world";
      for (const link of guideLinks) {
        if (link.dataset.guideSection === active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      }
    }
    for (const link of guideLinks) {
      link.addEventListener("click", () => setCurrentGuideSection(link.dataset.guideSection));
    }
    window.addEventListener("hashchange", () => setCurrentGuideSection(window.location.hash.slice(1)));
    setCurrentGuideSection(window.location.hash.slice(1));
  }

  let initial = "en";
  try { initial = valid(window.localStorage.getItem(STORAGE_KEY)); }
  catch { /* Private browsing may deny storage. */ }
  translate(initial);
})(); 
