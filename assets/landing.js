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
      guideWorldStructureTitle:"A world of football",
      guideWorldCountriesTitle:"Countries",
      guideWorldParticipationTitle:"Explore the competitions",
      guideWorldActive:"Active clubs",
      guideWorldInactive:"Inactive clubs",
      guideWorldCountryDetail:"Every country has two divisions. Choose a league to discover its clubs and follow the season.",
      guideWorldHeading:"What is Football Architect?",guideWorldHeadingText1:"Football Architect is a fictional football universe where you can follow clubs, leagues and international cups across multiple seasons.",guideWorldHeadingText2:"Explore eight countries, their divisions and their clubs. Follow league tables, matchdays, statistics and the stories that develop as seasons progress.",
      guideMoveIntroTitle:"How clubs move between tiers",
      guideMoveIntro:"The domestic model connects the top and second division within each country. The sporting design distinguishes automatic places from end-of-season decisions.",
      guideMoveRelegationTitle:"Top division: relegation",
      guideMoveRelegation:"Two clubs are assigned direct relegation places. The clubs finishing 13th and 14th enter a playout to determine one additional relegation place.",
      guideMovePromotionTitle:"Second division: promotion",
      guideMovePromotion:"Two clubs are assigned direct promotion places. Clubs finishing 3rd through 6th contest a promotion playoff for one additional place. The final is hosted by the better-ranked finalist.",
      guideMoveNoteTitle:"Designed rules versus current preview",
      guideMoveNote:"These are approved competition-format rules, not a statement that public standings currently calculate final placements, outcomes or tie-breakers. Development preview results must not be treated as confirmed promotion or relegation.",
      guideMoveExplore:"Explore competition rules",
      guideMovementHeading:"Movement between tiers",guideMovementHeadingText1:"Promotion and relegation connect the two domestic tiers. The planned rules distinguish direct places from playoff and playout places; consult competition Rules for the applicable format.",guideMovementHeadingText2:"These are sporting rules of the world, not a promise that a public simulation currently computes promotion, relegation or tie-breakers.",
      guideCalDays:"Days",
      guideCalWeeks:"Weeks",
      guideCalPreseason:"Preseason days",
      guideCalCycleTitle:"The season cycle",
      guideCalCycle:"Football Architect uses a conceptual 56-day calendar organized into eight weeks. It is an ordered sporting timeline rather than a promise of real-world dates or kickoff times.",
      guideCalDomesticTitle:"Preseason and domestic rounds",
      guideCalDomestic:"The cycle reserves twelve preseason days. Domestic leagues have 30 regular matchdays, with eight fixtures per division on each matchday in the shared preview model.",
      guideCalInternationalTitle:"International calendar",
      guideCalInternational:"Domestic and international event markers share one world timeline. The Sovereign Cup and Federation Cup reach their finals on separate days in the 56-day model.",
      guideCalPausesTitle:"Pauses and transitions",
      guideCalPauses:"Planned pauses and the transition day provide space between stages. A marker only identifies a stage; it does not create played games, scores or archived results.",
      guideCalDataTitle:"Calendar data and navigation",
      guideCalData:"The Calendar view presents the available season structure. DEV controls may allow inspection of different stages, but do not constitute an authoritative live clock.",
      guideCalLink:"Open calendar",
      guideCalendarHeading:"Seasons and calendar",guideCalendarHeadingText1:"The world calendar models a 56-day cycle across eight weeks: twelve preseason days, domestic and international event markers, scheduled pauses and a transition day.",guideCalendarHeadingText2:"The two international cup finals have separate days. Calendar markers describe the season structure; they do not generate kickoff times, fixtures, scores or live results.",
      guideCupMetricCups:"International cups",
      guideCupMetricClubs:"Clubs per cup",
      guideCupMetricLeague:"League matches",
      guideCupMetricSlots:"International slots",
      guideCupIntroTitle:"Two international competitions",
      guideCupIntro:"Sovereign Cup and Federation Cup each feature 24 clubs. They are separate tournaments sharing one international calendar framework.",
      guideCupLeagueTitle:"League phase",
      guideCupLeague:"Each club plays six matches in the first phase, scheduled across international slots I01–I06. This is a competition format, not a claim that current fixtures or results exist.",
      guideCupKnockoutTitle:"Knockout pathway",
      guideCupKnockout:"The designed pathway continues through two-legged playoffs (I07–I08), quarterfinals (I09–I10) and semifinals (I11–I12), followed by the finals in international slot I13.",
      guideCupTimelineTitle:"How the world calendar fits",
      guideCupTimeline:"Thirteen international slots are woven between domestic rounds. Both finals belong to slot I13, but the 56-day world calendar places them on separate days.",
      guideCupDataTitle:"Availability of competition data",
      guideCupData:"Standings, fixtures, statistics and history appear only when source data is available. An empty state does not imply a match was played or that a champion has been crowned.",
      guideCupExplore:"Explore international competitions",
      guideCupsHeading:"International cups",guideCupsHeadingText1:"The Sovereign Cup and Federation Cup bring clubs together beyond national borders. Their designed path includes a league phase and knockout rounds, ending in separate finals.",guideCupsHeadingText2:"International competition pages are evolving. Empty states mean that fixtures, standings or results have not been supplied; they must not be mistaken for completed games.",
      guideRecIntroTitle:"Understanding statistics",
      guideRecIntro:"Statistics show what has happened in the selected competition and season. Overview summarises matches played, total goals and goals per match; the latter is shown to two decimal places.",
      guideRecTeamsTitle:"Teams and players",
      guideRecTeams:"Team and player tabs show ranked Top 5 tables across seven categories, with Show all where a full table is available. An empty table indicates missing data, not zero performance.",
      guideRecHistoryTitle:"Standings versus records",
      guideRecHistory:"Standings and fixtures describe the selected season's current state. History documents completed seasons, champions, final standings and long-term records; these are different views with different data requirements.",
      guideRecAllTimeTitle:"Season and all-time history",
      guideRecAllTime:"History can distinguish individual seasons from all-time records, including team and player achievements, seasonal attack and defence, and the most wins in a season.",
      guideRecIntegrityTitle:"Data integrity",
      guideRecIntegrity:"History must not invent a champion before a season is complete. If there are no completed seasons or no authoritative records, the page displays a clear empty state instead of fictional achievements.",
      guideRecLink:"Explore competition stats",
      guideRecordsHeading:"Statistics and history",guideRecordsHeadingText1:"Competition views separate current standings and fixtures from team and player statistics. History explores completed seasons, champions and records when authoritative archive data exists.",guideRecordsHeadingText2:"Unavailable seasons and missing statistics use explicit empty states rather than invented historical results.",
      guideExpIntroTitle:"Find your way around",
      guideExpIntro:"Football Architect separates an overview of the world from its competitions, teams, calendar and settings. Start with a competition or use the dashboard to choose where to go next.",
      guideExpDashboardTitle:"Dashboard",
      guideExpDashboard:"The dashboard is an entry point to the app. It helps you navigate; it does not by itself confirm live scores or completed matches.",
      guideExpCompetitionsTitle:"Competitions",
      guideExpCompetitions:"Choose a domestic division or an available international cup. Competition pages expose Overview, Standings, Fixtures, Stats and History when the corresponding data exists.",
      guideExpCalendarTitle:"Calendar",
      guideExpCalendar:"Explore the shared season timeline in Calendar. Calendar markers are a model of events, not real-world dates or invented match results.",
      guideExpClubsTitle:"Clubs and settings",
      guideExpClubs:"The club directory helps you discover identities; club pages describe individual teams. Settings control supported app preferences such as the visual theme and language.",
      guideExpEmptyTitle:"Understanding empty states",
      guideExpEmpty:"A blank or unavailable panel means the underlying information is not available. Development-only previews are not official history or public results.",
      guideExpLinkDashboard:"Open dashboard",
      guideExpLinkCompetitions:"Browse competitions",
      guideExpLinkCalendar:"Open calendar",
      guideExpLinkClubs:"Browse clubs",
      guideExpLinkSettings:"Open settings",
      guideExploreHeading:"Explore the app",guideExploreHeadingText1:"Use Competitions to choose a division and explore its Overview, Standings, Fixtures, Stats and History. Club pages present individual identities; Calendar explains the shared season rhythm.",guideExploreHeadingText2:"The Guide explains concepts rather than listing every club or displaying provisional development results. Navigation and available views may change as the app evolves.",
      guideDivActivePlaces:"Active league places",
      guideDivDetailIntroTitle:"A two-tier national system",
      guideDivDetailIntro:"Eight countries each have one top division and one second division. Every division has sixteen places, giving the domestic world 16 divisions and 256 active league places.",
      guideDivDetailStructureTitle:"How the divisions are organized",
      guideDivDetailStructure:"The first division sits above the second division in each country. The tiers have independent standings and fixtures; club identity does not change with its league.",
      guideDivDetailFormatTitle:"League format",
      guideDivDetailFormat:"The shared competition preview uses a double round-robin: each club meets the other 15 clubs twice, once at home and once away. That means 30 regular matchdays with eight games on each matchday, or 240 matches per division.",
      guideDivDetailCaution:"Official scoring and tie-breaker implementation is not defined by this shared preview contract. Promotion and relegation are explained separately and should not be inferred from fictional development standings.",
      guideDivDetailCatalogueTitle:"Domestic divisions by country",
      guideDivTier1:"First tier",
      guideDivTier2:"Second tier",
      guideDivClubs:"16 clubs",
      guideDivRounds:"30 matchdays",
      guideDivMatches:"240 matches",
      guideDivPerRound:"8 matches per round",
      guideDivExploreTitle:"Browse domestic competitions",
      guideDivExplore:"See the current competition pages for standings, fixtures, statistics and history when data is available.",
      guideCountryIT:"Italy",
      guideCountryENG:"England",
      guideCountryES:"Spain",
      guideCountryDE:"Germany",
      guideCountryFR:"France",
      guideCountryPT:"Portugal",
      guideCountryNL:"Netherlands",
      guideCountryBR:"Brazil",
      guideDivisionsHeading:"Divisions",
      guideClubActive:"Active clubs",guideClubInactive:"Inactive clubs",
      guideClubIntroTitle:"Clubs and identity",
      guideClubIntro:"The catalogue contains 320 clubs across eight countries: 256 active and 64 inactive. Club identity is independent of division placement.",
      guideClubIdentityTitle:"What defines a club",
      guideClubIdentity:"Every club has a canonical primary name, full name, compact name and three-letter abbreviation, plus a home city, nickname and an original description.",
      guideClubColoursTitle:"Colours and crests",
      guideClubColours:"Every club has two canonical identity colours. Primary and secondary HEX values must be preserved exactly in approved artwork. Crests are introduced individually; missing artwork uses a placeholder, not an invented badge.",
      guideClubPlacesTitle:"City, ground and culture",
      guideClubPlaces:"The city and stadium name connect the club to a place. Descriptions and nicknames provide cultural context; they do not determine sporting results.",
      guideClubRivalriesTitle:"Participation and rivalries",
      guideClubRivalries:"Each country has 32 active clubs across two leagues and eight additional inactive catalogue clubs. Rivalries are part of club lore and must not be mistaken for automatic scheduled fixtures.",
      guideClubExploreTitle:"Explore club profiles",
      guideClubExplore:"Discover each club’s identity through its profile and the club directory.",
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
      guideWorldStructureTitle:"Eine Fußballwelt",
      guideWorldCountriesTitle:"Länder",
      guideWorldParticipationTitle:"Wettbewerbe entdecken",
      guideWorldActive:"Aktive Vereine",
      guideWorldInactive:"Inaktive Vereine",
      guideWorldCountryDetail:"Jedes Land hat zwei Ligen. Wähle eine Liga, entdecke ihre Vereine und verfolge die Saison.",
      guideWorldHeading:"Was ist Football Architect?",guideWorldHeadingText1:"Football Architect ist eine fiktive Fußballwelt, in der du Vereine, Ligen und internationale Pokale über mehrere Saisons verfolgen kannst.",guideWorldHeadingText2:"Entdecke acht Länder mit ihren Ligen und Vereinen. Verfolge Tabellen, Spieltage, Statistiken und Geschichten, die sich über die Saisons entwickeln.",
      guideMoveIntroTitle:"Auf- und Abstieg zwischen den Ligen",
      guideMoveIntro:"Die beiden nationalen Ligen sind sportlich verbunden. Das Format unterscheidet direkte Plätze von Entscheidungen am Saisonende.",
      guideMoveRelegationTitle:"Erste Liga: Abstieg",
      guideMoveRelegation:"Zwei Plätze führen direkt zum Abstieg. Der 13. und 14. Tabellenplatz spielen in einem Playout um einen weiteren Abstiegsplatz.",
      guideMovePromotionTitle:"Zweite Liga: Aufstieg",
      guideMovePromotion:"Zwei Plätze führen direkt zum Aufstieg. Die Plätze 3 bis 6 spielen im Aufstiegs-Playoff um einen weiteren Platz. Das Finale findet beim besser platzierten Finalisten statt.",
      guideMoveNoteTitle:"Regelmodell und aktuelle Vorschau",
      guideMoveNote:"Dies sind genehmigte Wettbewerbsregeln; öffentliche Vorschautabellen berechnen damit nicht automatisch Endplatzierungen, Ergebnisse oder Gleichstandsregeln. Entwicklungsergebnisse sind keine bestätigten Auf- oder Abstiege.",
      guideMoveExplore:"Wettbewerbsregeln erkunden",
      guideMovementHeading:"Auf- und Abstieg",guideMovementHeadingText1:"Auf- und Abstieg verbinden die beiden nationalen Ligen. Das geplante Regelwerk unterscheidet direkte Plätze sowie Playoffs und Playouts; die geltenden Details stehen unter Regeln des Wettbewerbs.",guideMovementHeadingText2:"Die Regelbeschreibung bedeutet nicht, dass die öffentliche Simulation Auf- und Abstieg oder Gleichstandsregeln bereits berechnet.",
      guideCalDays:"Tage",
      guideCalWeeks:"Wochen",
      guideCalPreseason:"Vorbereitungstage",
      guideCalCycleTitle:"Der Saisonzyklus",
      guideCalCycle:"Football Architect verwendet einen konzeptionellen Kalender von 56 Tagen in acht Wochen. Er bildet eine sportliche Reihenfolge ab, keine realen Daten oder Anstoßzeiten.",
      guideCalDomesticTitle:"Vorbereitung und nationale Spieltage",
      guideCalDomestic:"Der Zyklus enthält zwölf Vorbereitungstage. Die nationalen Ligen umfassen 30 reguläre Spieltage mit acht Spielen pro Liga und Spieltag im gemeinsamen Vorschaumodell.",
      guideCalInternationalTitle:"Internationaler Kalender",
      guideCalInternational:"Nationale und internationale Ereignisse folgen einer gemeinsamen Zeitleiste. Die Finals des Sovereign Cup und Federation Cup finden im 56-Tage-Modell an getrennten Tagen statt.",
      guideCalPausesTitle:"Pausen und Übergänge",
      guideCalPauses:"Geplante Pausen und der Übergangstag trennen die Phasen. Ein Kalendereintrag erzeugt keine gespielten Partien, Ergebnisse oder Archivdaten.",
      guideCalDataTitle:"Kalenderdaten und Navigation",
      guideCalData:"Die Kalenderansicht zeigt die verfügbare Saisonstruktur. DEV-Steuerungen können andere Phasen anzeigen, sind aber keine verbindliche Live-Uhr.",
      guideCalLink:"Kalender öffnen",
      guideCalendarHeading:"Saisons und Kalender",guideCalendarHeadingText1:"Der Weltkalender umfasst 56 Tage in acht Wochen: zwölf Vorbereitungstage, nationale und internationale Ereignismarkierungen, Pausen und einen Übergangstag.",guideCalendarHeadingText2:"Die beiden internationalen Pokalfinals haben eigene Tage. Kalendermarkierungen erzeugen keine Anstoßzeiten, Spiele oder Ergebnisse.",
      guideCupMetricCups:"Internationale Pokale",
      guideCupMetricClubs:"Vereine je Pokal",
      guideCupMetricLeague:"Ligaspiele",
      guideCupMetricSlots:"Internationale Slots",
      guideCupIntroTitle:"Zwei internationale Wettbewerbe",
      guideCupIntro:"Sovereign Cup und Federation Cup umfassen jeweils 24 Vereine. Die eigenständigen Turniere nutzen einen gemeinsamen internationalen Kalenderrahmen.",
      guideCupLeagueTitle:"Ligaphase",
      guideCupLeague:"Jeder Verein bestreitet in der ersten Phase sechs Spiele in den internationalen Slots I01–I06. Das beschreibt das Format, nicht bereits vorhandene Partien oder Ergebnisse.",
      guideCupKnockoutTitle:"K.-o.-Phase",
      guideCupKnockout:"Auf die Ligaphase folgen Playoffs mit Hin- und Rückspiel (I07–I08), Viertelfinale (I09–I10), Halbfinale (I11–I12) und die Finals in Slot I13.",
      guideCupTimelineTitle:"Einbindung in den Weltkalender",
      guideCupTimeline:"Dreizehn internationale Slots liegen zwischen nationalen Spieltagen. Beide Finals gehören zu I13, finden im 56-Tage-Weltkalender jedoch an getrennten Tagen statt.",
      guideCupDataTitle:"Verfügbarkeit von Wettbewerbsdaten",
      guideCupData:"Tabellen, Spielpläne, Statistiken und Archive erscheinen nur mit verfügbaren Quelldaten. Ein leerer Bereich bedeutet weder ein ausgetragenes Spiel noch einen feststehenden Sieger.",
      guideCupExplore:"Internationale Wettbewerbe erkunden",
      guideCupsHeading:"Internationale Pokale",guideCupsHeadingText1:"Sovereign Cup und Federation Cup verbinden Vereine über Landesgrenzen hinweg. Der vorgesehene Weg umfasst eine Ligaphase und K.-o.-Runden mit getrennten Finals.",guideCupsHeadingText2:"Die internationalen Wettbewerbsseiten befinden sich in Entwicklung. Leere Bereiche sind keine abgeschlossenen Partien.",
      guideRecIntroTitle:"Statistiken verstehen",
      guideRecIntro:"Statistiken zeigen die Daten des gewählten Wettbewerbs und der Saison. Die Übersicht enthält gespielte Spiele, Tore insgesamt und Tore pro Spiel, letztere mit zwei Dezimalstellen.",
      guideRecTeamsTitle:"Vereine und Spieler",
      guideRecTeams:"Die Bereiche Vereine und Spieler zeigen Top-5-Ranglisten in sieben Kategorien. Wo verfügbar, öffnet „Alle anzeigen“ die vollständige Tabelle. Leere Tabellen stehen für fehlende Daten, nicht für null Leistung.",
      guideRecHistoryTitle:"Tabellen und Rekorde",
      guideRecHistory:"Tabellen und Spielpläne zeigen den aktuellen Saisonstand. Die Chronik dokumentiert abgeschlossene Saisons, Meister, Abschlusstabellen und langfristige Rekorde.",
      guideRecAllTimeTitle:"Saison und ewige Bestenlisten",
      guideRecAllTime:"Die Chronik unterscheidet einzelne Saisons und Gesamtbestleistungen, darunter Vereins- und Spielerrekorde, Angriff, Abwehr und die meisten Siege in einer Saison.",
      guideRecIntegrityTitle:"Verlässliche Daten",
      guideRecIntegrity:"Vor Saisonabschluss darf kein Meister erfunden werden. Ohne abgeschlossene Saisons oder verlässliche Rekorde zeigt die Chronik einen ausdrücklichen Leerzustand.",
      guideRecLink:"Wettbewerbsstatistiken erkunden",
      guideRecordsHeading:"Statistiken und Geschichte",guideRecordsHeadingText1:"Wettbewerbsseiten trennen Tabellen und Spielpläne von Mannschafts- und Spielerstatistiken. Der Bereich Geschichte zeigt abgeschlossene Saisons, Meister und Rekorde, sofern Archivdaten vorliegen.",guideRecordsHeadingText2:"Fehlende Daten werden ausdrücklich gekennzeichnet und nicht erfunden.",
      guideExpIntroTitle:"Orientierung in der App",
      guideExpIntro:"Football Architect trennt Weltübersicht, Wettbewerbe, Vereine, Kalender und Einstellungen. Starte mit einem Wettbewerb oder nutze das Dashboard.",
      guideExpDashboardTitle:"Dashboard",
      guideExpDashboard:"Das Dashboard dient als Einstieg. Es bestätigt keine Live-Ergebnisse oder abgeschlossenen Spiele.",
      guideExpCompetitionsTitle:"Wettbewerbe",
      guideExpCompetitions:"Wähle eine nationale Liga oder einen verfügbaren internationalen Pokal. Je nach Datenlage zeigen Wettbewerbe Übersicht, Tabelle, Spielplan, Statistiken und Chronik.",
      guideExpCalendarTitle:"Kalender",
      guideExpCalendar:"Erkunde die gemeinsame Saisonzeitleiste. Kalendermarkierungen sind ein Ereignismodell, keine echten Daten oder erfundenen Ergebnisse.",
      guideExpClubsTitle:"Vereine und Einstellungen",
      guideExpClubs:"Das Vereinsverzeichnis zeigt Identitäten, Vereinsseiten einzelne Teams. Die Einstellungen steuern unterstützte Vorlieben wie Design und Sprache.",
      guideExpEmptyTitle:"Leere Ansichten verstehen",
      guideExpEmpty:"Leere oder nicht verfügbare Bereiche bedeuten, dass Daten fehlen. Reine Entwicklungsvorschauen sind keine offizielle Chronik oder öffentlichen Ergebnisse.",
      guideExpLinkDashboard:"Dashboard öffnen",
      guideExpLinkCompetitions:"Wettbewerbe ansehen",
      guideExpLinkCalendar:"Kalender öffnen",
      guideExpLinkClubs:"Vereine ansehen",
      guideExpLinkSettings:"Einstellungen öffnen",
      guideExploreHeading:"Die App erkunden",guideExploreHeadingText1:"Unter Wettbewerbe lassen sich Übersicht, Tabelle, Spielplan, Statistiken und Geschichte aufrufen. Vereinsseiten zeigen individuelle Identitäten; der Kalender erklärt den Saisonablauf.",guideExploreHeadingText2:"Dieser Leitfaden erläutert Konzepte, statt alle Vereine oder vorläufige Entwicklungsergebnisse aufzulisten.",
      guideDivActivePlaces:"Aktive Ligaplätze",
      guideDivDetailIntroTitle:"Ein nationales System mit zwei Ligen",
      guideDivDetailIntro:"Jedes der acht Länder besitzt eine erste und eine zweite Liga. Jede Liga bietet 16 Plätze; insgesamt gibt es 16 Ligen mit 256 aktiven Ligaplätzen.",
      guideDivDetailStructureTitle:"Aufbau der Ligen",
      guideDivDetailStructure:"Die erste Liga steht über der zweiten Liga. Beide Ebenen besitzen eigene Tabellen und Spielpläne; die Vereinsidentität bleibt vom Ligastatus unabhängig.",
      guideDivDetailFormatTitle:"Ligamodus",
      guideDivDetailFormat:"Das gemeinsame Vorschaumodell nutzt eine Hin- und Rückrunde: Jeder Verein spielt zweimal gegen die anderen 15 Vereine, einmal zu Hause und einmal auswärts. Daraus entstehen 30 Spieltage mit je acht Spielen, insgesamt 240 pro Liga.",
      guideDivDetailCaution:"Offizielle Punktewertung und Gleichstandsregeln sind durch dieses Vorschaumodell nicht festgelegt. Auf- und Abstieg werden gesondert erklärt; Entwicklungstabellen sind nicht verbindlich.",
      guideDivDetailCatalogueTitle:"Nationale Ligen nach Ländern",
      guideDivTier1:"Erste Liga",
      guideDivTier2:"Zweite Liga",
      guideDivClubs:"16 Vereine",
      guideDivRounds:"30 Spieltage",
      guideDivMatches:"240 Spiele",
      guideDivPerRound:"8 Spiele je Runde",
      guideDivExploreTitle:"Nationale Wettbewerbe erkunden",
      guideDivExplore:"Auf den Wettbewerbsseiten findest du verfügbare Tabellen, Spielpläne, Statistiken und Archive.",
      guideCountryIT:"Italien",
      guideCountryENG:"England",
      guideCountryES:"Spanien",
      guideCountryDE:"Deutschland",
      guideCountryFR:"Frankreich",
      guideCountryPT:"Portugal",
      guideCountryNL:"Niederlande",
      guideCountryBR:"Brasilien",
      guideDivisionsHeading:"Ligen",
      guideClubActive:"Aktive Vereine",guideClubInactive:"Inaktive Vereine",
      guideClubIntroTitle:"Vereine und Identität",
      guideClubIntro:"Das Verzeichnis umfasst 320 Vereine aus acht Ländern: 256 aktive und 64 inaktive. Die Vereinsidentität ist unabhängig von der Ligazugehörigkeit.",
      guideClubIdentityTitle:"Was einen Verein ausmacht",
      guideClubIdentity:"Jeder Verein besitzt einen kanonischen Namen, Lang- und Kurznamen sowie ein eindeutiges Kürzel aus drei Buchstaben, dazu Stadt, Spitzname und ursprüngliche Beschreibung.",
      guideClubColoursTitle:"Farben und Wappen",
      guideClubColours:"Jeder Verein hat zwei kanonische Identitätsfarben. Die HEX-Werte müssen in freigegebenen Grafiken exakt erhalten bleiben. Wappen werden einzeln ergänzt; solange sie fehlen, erscheint ein Platzhalter.",
      guideClubPlacesTitle:"Stadt, Stadion und Kultur",
      guideClubPlaces:"Stadt und Stadion verankern den Verein an einem Ort. Beschreibungen und Spitznamen liefern kulturellen Kontext, bestimmen aber keine Spielergebnisse.",
      guideClubRivalriesTitle:"Teilnahme und Rivalitäten",
      guideClubRivalries:"Jedes Land hat 32 aktive Vereine in zwei Ligen und acht weitere inaktive Vereine im Verzeichnis. Rivalitäten sind Teil der Vereinsgeschichte, nicht automatisch angesetzte Spiele.",
      guideClubExploreTitle:"Vereinsprofile erkunden",
      guideClubExplore:"Entdecke die Identität jedes Vereins in seinem Profil und im Vereinsverzeichnis.",
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
      guideWorldStructureTitle:"Un mundo de fútbol",
      guideWorldCountriesTitle:"Países",
      guideWorldParticipationTitle:"Explora las competiciones",
      guideWorldActive:"Clubes activos",
      guideWorldInactive:"Clubes inactivos",
      guideWorldCountryDetail:"Cada país tiene dos divisiones. Elige una liga, descubre sus clubes y sigue la temporada.",
      guideWorldHeading:"¿Qué es Football Architect?",guideWorldHeadingText1:"Football Architect es un universo futbolístico ficticio en el que puedes seguir clubes, ligas y copas internacionales a lo largo de varias temporadas.",guideWorldHeadingText2:"Descubre ocho países, sus divisiones y sus clubes. Sigue clasificaciones, jornadas, estadísticas e historias que evolucionan con las temporadas.",
      guideMoveIntroTitle:"Cómo cambian los clubes de división",
      guideMoveIntro:"Las dos divisiones de cada país están conectadas. El formato distingue plazas directas y decisiones al final de la temporada.",
      guideMoveRelegationTitle:"Primera división: descenso",
      guideMoveRelegation:"Dos plazas implican descenso directo. Los clubes en 13.º y 14.º lugar disputan un playout por una plaza adicional de descenso.",
      guideMovePromotionTitle:"Segunda división: ascenso",
      guideMovePromotion:"Dos plazas dan ascenso directo. Los clubes del 3.º al 6.º lugar disputan un playoff por otra plaza. La final se juega en casa del finalista mejor clasificado.",
      guideMoveNoteTitle:"Reglas diseñadas y vista previa",
      guideMoveNote:"Estas son reglas aprobadas del formato, no una indicación de que las tablas públicas calculen ya las posiciones finales, resultados o desempates. Los resultados de desarrollo no confirman ascensos ni descensos.",
      guideMoveExplore:"Ver reglas de competición",
      guideMovementHeading:"Ascensos y descensos",guideMovementHeadingText1:"Los ascensos y descensos conectan los dos niveles nacionales. Las reglas previstas distinguen plazas directas, playoffs y eliminatorias de permanencia; consulta las reglas de cada competición.",guideMovementHeadingText2:"Estas reglas no significan que la simulación pública calcule ya los ascensos, descensos o desempates.",
      guideCalDays:"Días",
      guideCalWeeks:"Semanas",
      guideCalPreseason:"Días de pretemporada",
      guideCalCycleTitle:"El ciclo de temporada",
      guideCalCycle:"Football Architect utiliza un calendario conceptual de 56 días organizado en ocho semanas. Es una secuencia deportiva, no un compromiso de fechas reales ni horarios de inicio.",
      guideCalDomesticTitle:"Pretemporada y jornadas nacionales",
      guideCalDomestic:"El ciclo reserva doce días de pretemporada. Las ligas nacionales tienen 30 jornadas regulares, con ocho partidos por división y jornada en el modelo común de vista previa.",
      guideCalInternationalTitle:"Calendario internacional",
      guideCalInternational:"Los eventos nacionales e internacionales comparten una única línea temporal. Las finales de Sovereign Cup y Federation Cup tienen días distintos en el modelo de 56 días.",
      guideCalPausesTitle:"Pausas y transición",
      guideCalPauses:"Las pausas previstas y el día de transición separan etapas. Una marca del calendario no crea partidos disputados, marcadores ni resultados históricos.",
      guideCalDataTitle:"Datos y navegación del calendario",
      guideCalData:"La vista Calendario muestra la estructura de temporada disponible. Los controles DEV permiten consultar etapas, pero no equivalen a un reloj oficial en vivo.",
      guideCalLink:"Abrir calendario",
      guideCalendarHeading:"Temporadas y calendario",guideCalendarHeadingText1:"El calendario mundial organiza 56 días en ocho semanas: doce días de pretemporada, marcadores de competiciones nacionales e internacionales, pausas y un día de transición.",guideCalendarHeadingText2:"Las dos finales internacionales se celebran en días distintos. Los marcadores no generan horarios, partidos ni resultados.",
      guideCupMetricCups:"Copas internacionales",
      guideCupMetricClubs:"Clubes por copa",
      guideCupMetricLeague:"Partidos de liga",
      guideCupMetricSlots:"Bloques internacionales",
      guideCupIntroTitle:"Dos competiciones internacionales",
      guideCupIntro:"Sovereign Cup y Federation Cup reúnen 24 clubes cada una. Son torneos independientes que comparten el marco del calendario internacional.",
      guideCupLeagueTitle:"Fase de liga",
      guideCupLeague:"Cada club disputa seis partidos en la primera fase, distribuidos entre I01 e I06. Es el formato previsto, no una afirmación de que existan ya partidos o resultados.",
      guideCupKnockoutTitle:"Eliminatorias",
      guideCupKnockout:"El recorrido continúa con playoffs a doble partido (I07–I08), cuartos (I09–I10), semifinales (I11–I12) y las finales en el bloque I13.",
      guideCupTimelineTitle:"Relación con el calendario mundial",
      guideCupTimeline:"Trece bloques internacionales se intercalan entre jornadas nacionales. Las dos finales pertenecen a I13, pero tienen días distintos en el calendario mundial de 56 días.",
      guideCupDataTitle:"Disponibilidad de datos",
      guideCupData:"Las clasificaciones, partidos, estadísticas e historia se muestran solo si hay datos. Un estado vacío no significa que se haya jugado un encuentro o proclamado un campeón.",
      guideCupExplore:"Explorar competiciones internacionales",
      guideCupsHeading:"Copas internacionales",guideCupsHeadingText1:"Sovereign Cup y Federation Cup reúnen a clubes de distintos países. Su formato previsto incluye una fase de liga y eliminatorias hasta dos finales separadas.",guideCupsHeadingText2:"Las páginas internacionales siguen en desarrollo. Un estado vacío no equivale a un partido disputado.",
      guideRecIntroTitle:"Cómo leer las estadísticas",
      guideRecIntro:"Las estadísticas reflejan la competición y temporada seleccionadas. El resumen muestra partidos jugados, goles totales y goles por partido con dos decimales.",
      guideRecTeamsTitle:"Equipos y jugadores",
      guideRecTeams:"Las pestañas de equipos y jugadores presentan tablas Top 5 de siete categorías, con «Ver todo» cuando hay una tabla completa. Una tabla vacía indica datos ausentes, no rendimiento cero.",
      guideRecHistoryTitle:"Clasificaciones y récords",
      guideRecHistory:"Las clasificaciones y el calendario muestran la temporada actual; el historial registra temporadas terminadas, campeones, clasificaciones finales y récords.",
      guideRecAllTimeTitle:"Historial por temporada y global",
      guideRecAllTime:"El historial diferencia temporadas individuales y récords de todos los tiempos, incluidos logros de equipos y jugadores, ataque, defensa y más victorias en una temporada.",
      guideRecIntegrityTitle:"Integridad de los datos",
      guideRecIntegrity:"No debe inventarse un campeón antes de terminar la temporada. Sin temporadas completas o registros fiables se muestra un estado vacío explícito.",
      guideRecLink:"Explorar estadísticas",
      guideRecordsHeading:"Estadísticas e historia",guideRecordsHeadingText1:"Las páginas separan clasificaciones y partidos de estadísticas de equipos y jugadores. Historia muestra temporadas terminadas, campeones y récords cuando hay datos de archivo.",guideRecordsHeadingText2:"Los datos ausentes aparecen como estados vacíos, sin inventar resultados.",
      guideExpIntroTitle:"Orientarse por la aplicación",
      guideExpIntro:"Football Architect separa el mundo, las competiciones, los clubes, el calendario y los ajustes. Empieza por una competición o utiliza el panel principal.",
      guideExpDashboardTitle:"Panel principal",
      guideExpDashboard:"El panel es un punto de entrada; no confirma por sí solo resultados en directo ni partidos terminados.",
      guideExpCompetitionsTitle:"Competiciones",
      guideExpCompetitions:"Elige una división nacional o una copa internacional disponible. Las páginas ofrecen Resumen, Clasificación, Partidos, Estadísticas e Historial cuando existen los datos.",
      guideExpCalendarTitle:"Calendario",
      guideExpCalendar:"Consulta la cronología común de la temporada. Las marcas son un modelo de eventos, no fechas reales ni resultados inventados.",
      guideExpClubsTitle:"Clubes y ajustes",
      guideExpClubs:"El directorio presenta las identidades de los clubes y sus perfiles describen los equipos. Los ajustes permiten cambiar preferencias como tema e idioma.",
      guideExpEmptyTitle:"Estados vacíos",
      guideExpEmpty:"Una sección vacía o no disponible indica datos ausentes. Las vistas de desarrollo no representan resultados públicos ni historial oficial.",
      guideExpLinkDashboard:"Abrir panel",
      guideExpLinkCompetitions:"Ver competiciones",
      guideExpLinkCalendar:"Abrir calendario",
      guideExpLinkClubs:"Ver clubes",
      guideExpLinkSettings:"Abrir ajustes",
      guideExploreHeading:"Explorar la aplicación",guideExploreHeadingText1:"En Competiciones puedes abrir Resumen, Clasificación, Partidos, Estadísticas e Historia. Las páginas de clubes presentan su identidad y Calendario explica el ciclo común.",guideExploreHeadingText2:"Esta guía explica conceptos, no enumera todos los clubes ni publica resultados provisionales.",
      guideDivActivePlaces:"Plazas activas en liga",
      guideDivDetailIntroTitle:"Un sistema nacional de dos niveles",
      guideDivDetailIntro:"Cada uno de los ocho países tiene una primera y una segunda división. Cada división dispone de 16 plazas: 16 divisiones y 256 plazas activas en total.",
      guideDivDetailStructureTitle:"Organización de las divisiones",
      guideDivDetailStructure:"La primera división se sitúa sobre la segunda. Cada nivel tiene su propia clasificación y calendario; la identidad de un club es independiente de su división.",
      guideDivDetailFormatTitle:"Formato de liga",
      guideDivDetailFormat:"El modelo compartido de vista previa utiliza una liga a doble vuelta: cada club se enfrenta dos veces a los otros 15, una en casa y otra fuera. Son 30 jornadas con ocho partidos cada una, 240 partidos por división.",
      guideDivDetailCaution:"El modelo de vista previa no define aún los puntos oficiales ni los criterios de desempate. Los ascensos y descensos se explican por separado y no deben deducirse de las clasificaciones ficticias de desarrollo.",
      guideDivDetailCatalogueTitle:"Divisiones nacionales por país",
      guideDivTier1:"Primera división",
      guideDivTier2:"Segunda división",
      guideDivClubs:"16 clubes",
      guideDivRounds:"30 jornadas",
      guideDivMatches:"240 partidos",
      guideDivPerRound:"8 partidos por jornada",
      guideDivExploreTitle:"Explorar competiciones nacionales",
      guideDivExplore:"Consulta las páginas de competición para ver clasificaciones, partidos, estadísticas e historia cuando haya datos.",
      guideCountryIT:"Italia",
      guideCountryENG:"Inglaterra",
      guideCountryES:"España",
      guideCountryDE:"Alemania",
      guideCountryFR:"Francia",
      guideCountryPT:"Portugal",
      guideCountryNL:"Países Bajos",
      guideCountryBR:"Brasil",
      guideDivisionsHeading:"Divisiones",
      guideClubActive:"Clubes activos",guideClubInactive:"Clubes inactivos",
      guideClubIntroTitle:"Clubes e identidad",
      guideClubIntro:"El catálogo contiene 320 clubes de ocho países: 256 activos y 64 inactivos. La identidad de un club no depende de su división.",
      guideClubIdentityTitle:"Qué define a un club",
      guideClubIdentity:"Cada club tiene un nombre principal canónico, nombre completo, nombre corto y una abreviatura única de tres letras, además de ciudad, apodo y descripción original.",
      guideClubColoursTitle:"Colores y escudos",
      guideClubColours:"Cada club tiene dos colores de identidad canónicos. Sus valores HEX deben mantenerse exactos en los diseños aprobados. Los escudos se añaden individualmente; los que faltan usan un marcador neutro.",
      guideClubPlacesTitle:"Ciudad, estadio y cultura",
      guideClubPlaces:"La ciudad y el estadio vinculan el club a un lugar. Las descripciones y los apodos aportan contexto cultural, pero no determinan resultados deportivos.",
      guideClubRivalriesTitle:"Participación y rivalidades",
      guideClubRivalries:"Cada país cuenta con 32 clubes activos en dos divisiones y otros ocho inactivos en el catálogo. Las rivalidades forman parte de la historia, no son partidos programados automáticamente.",
      guideClubExploreTitle:"Explorar perfiles de clubes",
      guideClubExplore:"Descubre la identidad de cada club en su perfil y en el directorio.",
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
      guideWorldStructureTitle:"Un monde de football",
      guideWorldCountriesTitle:"Pays",
      guideWorldParticipationTitle:"Explorer les compétitions",
      guideWorldActive:"Clubs actifs",
      guideWorldInactive:"Clubs inactifs",
      guideWorldCountryDetail:"Chaque pays compte deux divisions. Choisis un championnat pour découvrir ses clubs et suivre la saison.",
      guideWorldHeading:"Qu’est-ce que Football Architect ?",guideWorldHeadingText1:"Football Architect est un univers de football fictif où tu peux suivre clubs, championnats et coupes internationales au fil des saisons.",guideWorldHeadingText2:"Découvre huit pays, leurs divisions et leurs clubs. Suis les classements, les journées, les statistiques et les histoires qui naissent au fil des saisons.",
      guideMoveIntroTitle:"Passage entre les deux divisions",
      guideMoveIntro:"Les deux divisions nationales de chaque pays sont liées sportivement. Le format distingue les places directes et les décisions de fin de saison.",
      guideMoveRelegationTitle:"Première division : relégation",
      guideMoveRelegation:"Deux places entraînent une relégation directe. Les clubs classés 13e et 14e disputent un playout pour une place supplémentaire de relégation.",
      guideMovePromotionTitle:"Deuxième division : promotion",
      guideMovePromotion:"Deux places donnent une promotion directe. Les clubs classés de la 3e à la 6e place disputent un playoff pour une place supplémentaire. La finale se joue chez le finaliste le mieux classé.",
      guideMoveNoteTitle:"Règles prévues et aperçu actuel",
      guideMoveNote:"Ces règles de format sont approuvées, mais les classements publics de prévisualisation ne calculent pas nécessairement les positions finales, résultats ou départages. Les résultats de développement ne confirment aucune promotion ni relégation.",
      guideMoveExplore:"Explorer les règles",
      guideMovementHeading:"Montées et descentes",guideMovementHeadingText1:"Les montées et descentes relient les deux niveaux nationaux. Les règles prévues distinguent les places directes des barrages; consultez les règles de chaque compétition.",guideMovementHeadingText2:"Cette description ne signifie pas que la simulation publique calcule déjà les montées, descentes ou départages.",
      guideCalDays:"Jours",
      guideCalWeeks:"Semaines",
      guideCalPreseason:"Jours de présaison",
      guideCalCycleTitle:"Le cycle de la saison",
      guideCalCycle:"Football Architect utilise un calendrier conceptuel de 56 jours répartis sur huit semaines. Il décrit un ordre sportif, et non des dates réelles ou des heures de coup d'envoi.",
      guideCalDomesticTitle:"Présaison et journées nationales",
      guideCalDomestic:"Le cycle réserve douze jours de présaison. Les ligues nationales comptent 30 journées régulières, avec huit rencontres par division et par journée dans le modèle partagé de prévisualisation.",
      guideCalInternationalTitle:"Calendrier international",
      guideCalInternational:"Les événements nationaux et internationaux partagent une seule chronologie. Les finales de Sovereign Cup et Federation Cup se déroulent à des jours distincts dans le modèle de 56 jours.",
      guideCalPausesTitle:"Pauses et transitions",
      guideCalPauses:"Les pauses prévues et le jour de transition séparent les étapes. Un repère ne crée pas de matchs joués, de scores ni de résultats archivés.",
      guideCalDataTitle:"Données et navigation du calendrier",
      guideCalData:"La vue Calendrier présente la structure de saison disponible. Les outils DEV permettent d'examiner d'autres étapes, sans constituer une horloge officielle en direct.",
      guideCalLink:"Ouvrir le calendrier",
      guideCalendarHeading:"Saisons et calendrier",guideCalendarHeadingText1:"Le calendrier mondial couvre 56 jours en huit semaines : douze jours de présaison, des repères nationaux et internationaux, des pauses et un jour de transition.",guideCalendarHeadingText2:"Les deux finales internationales ont lieu à des jours distincts. Les repères ne génèrent ni horaires, ni rencontres, ni résultats.",
      guideCupMetricCups:"Coupes internationales",
      guideCupMetricClubs:"Clubs par coupe",
      guideCupMetricLeague:"Matchs de ligue",
      guideCupMetricSlots:"Créneaux internationaux",
      guideCupIntroTitle:"Deux compétitions internationales",
      guideCupIntro:"La Sovereign Cup et la Federation Cup réunissent chacune 24 clubs. Ces tournois distincts partagent une trame de calendrier international.",
      guideCupLeagueTitle:"Phase de ligue",
      guideCupLeague:"Chaque club dispute six matchs lors de la première phase, répartis sur les créneaux I01 à I06. Ce format ne garantit pas la présence actuelle de rencontres ou de résultats.",
      guideCupKnockoutTitle:"Phase à élimination",
      guideCupKnockout:"Le parcours comprend des barrages aller-retour (I07–I08), des quarts (I09–I10), des demies (I11–I12), puis les finales dans le créneau I13.",
      guideCupTimelineTitle:"Lien avec le calendrier mondial",
      guideCupTimeline:"Treize créneaux internationaux s'intercalent entre les journées nationales. Les deux finales relèvent de I13, mais se jouent sur deux jours distincts dans le calendrier de 56 jours.",
      guideCupDataTitle:"Disponibilité des données",
      guideCupData:"Classements, rencontres, statistiques et archives n'apparaissent qu'avec des données disponibles. Un état vide ne signifie ni match disputé ni champion désigné.",
      guideCupExplore:"Explorer les compétitions internationales",
      guideCupsHeading:"Coupes internationales",guideCupsHeadingText1:"La Sovereign Cup et la Federation Cup réunissent des clubs de plusieurs pays. Leur format prévu comprend une phase de ligue et des tours à élimination directe jusqu'à deux finales distinctes.",guideCupsHeadingText2:"Les pages de ces compétitions évoluent encore. Une zone vide ne signifie pas qu'un match a été joué.",
      guideRecIntroTitle:"Comprendre les statistiques",
      guideRecIntro:"Les statistiques concernent la compétition et la saison sélectionnées. L'aperçu résume les matchs joués, le total de buts et les buts par match, affichés à deux décimales.",
      guideRecTeamsTitle:"Équipes et joueurs",
      guideRecTeams:"Les onglets équipes et joueurs affichent des classements Top 5 dans sept catégories, avec « Tout afficher » si le tableau complet est disponible. Un tableau vide signale des données absentes.",
      guideRecHistoryTitle:"Classements et records",
      guideRecHistory:"Classements et rencontres décrivent la saison en cours. L'historique réunit les saisons terminées, champions, classements finaux et records durables.",
      guideRecAllTimeTitle:"Historique saisonnier et global",
      guideRecAllTime:"L'historique distingue les saisons particulières des records de tous les temps : performances d'équipes et de joueurs, attaque, défense et plus grand nombre de victoires en une saison.",
      guideRecIntegrityTitle:"Fiabilité des données",
      guideRecIntegrity:"Aucun champion ne doit être inventé avant la fin d'une saison. Sans saison terminée ou archive fiable, un état vide explicite est affiché.",
      guideRecLink:"Explorer les statistiques",
      guideRecordsHeading:"Statistiques et histoire",guideRecordsHeadingText1:"Les compétitions distinguent classements et rencontres des statistiques d'équipes et de joueurs. L'historique présente saisons achevées, champions et records lorsque les archives existent.",guideRecordsHeadingText2:"Les données manquantes restent explicitement indisponibles, sans résultats inventés.",
      guideExpIntroTitle:"Se repérer dans l'application",
      guideExpIntro:"Football Architect sépare la présentation du monde, les compétitions, les clubs, le calendrier et les paramètres. Commencez par une compétition ou le tableau de bord.",
      guideExpDashboardTitle:"Tableau de bord",
      guideExpDashboard:"Le tableau de bord sert de point de départ ; il ne confirme pas de scores en direct ni de matchs terminés.",
      guideExpCompetitionsTitle:"Compétitions",
      guideExpCompetitions:"Choisissez une division nationale ou une coupe internationale disponible. Les pages proposent Présentation, Classement, Rencontres, Statistiques et Historique selon les données.",
      guideExpCalendarTitle:"Calendrier",
      guideExpCalendar:"Explorez la chronologie commune de la saison. Les repères sont un modèle d'événements, pas des dates réelles ni des résultats inventés.",
      guideExpClubsTitle:"Clubs et paramètres",
      guideExpClubs:"L'annuaire permet de découvrir les identités des clubs et leurs fiches individuelles. Les paramètres gèrent les préférences disponibles comme le thème et la langue.",
      guideExpEmptyTitle:"États vides",
      guideExpEmpty:"Une section vide ou indisponible indique des données absentes. Les aperçus de développement ne sont pas des résultats publics ou des archives officielles.",
      guideExpLinkDashboard:"Ouvrir le tableau de bord",
      guideExpLinkCompetitions:"Voir les compétitions",
      guideExpLinkCalendar:"Ouvrir le calendrier",
      guideExpLinkClubs:"Voir les clubs",
      guideExpLinkSettings:"Ouvrir les paramètres",
      guideExploreHeading:"Explorer l'application",guideExploreHeadingText1:"Dans Compétitions, consultez Présentation, Classement, Rencontres, Statistiques et Historique. Les pages des clubs montrent leur identité; le Calendrier décrit le cycle commun.",guideExploreHeadingText2:"Ce guide explique les concepts sans répertorier tous les clubs ni publier de résultats provisoires.",
      guideDivActivePlaces:"Places actives en championnat",
      guideDivDetailIntroTitle:"Un système national à deux niveaux",
      guideDivDetailIntro:"Chacun des huit pays possède une première et une deuxième division. Chaque division comporte 16 places, soit 16 divisions et 256 places actives au total.",
      guideDivDetailStructureTitle:"Organisation des divisions",
      guideDivDetailStructure:"La première division se situe au-dessus de la deuxième. Chaque niveau dispose de son classement et de son calendrier ; l'identité des clubs reste indépendante du niveau.",
      guideDivDetailFormatTitle:"Format du championnat",
      guideDivDetailFormat:"Le modèle partagé de prévisualisation prévoit des matchs aller-retour : chaque club affronte les 15 autres deux fois, à domicile et à l'extérieur. Cela représente 30 journées de huit matchs, soit 240 matchs par division.",
      guideDivDetailCaution:"Le barème officiel et les critères de départage ne sont pas définis par ce modèle d'aperçu. Les montées et descentes sont expliquées séparément et ne se déduisent pas des classements fictifs de développement.",
      guideDivDetailCatalogueTitle:"Divisions nationales par pays",
      guideDivTier1:"Première division",
      guideDivTier2:"Deuxième division",
      guideDivClubs:"16 clubs",
      guideDivRounds:"30 journées",
      guideDivMatches:"240 matchs",
      guideDivPerRound:"8 matchs par journée",
      guideDivExploreTitle:"Explorer les compétitions nationales",
      guideDivExplore:"Consultez les pages des compétitions pour les classements, rencontres, statistiques et archives disponibles.",
      guideCountryIT:"Italie",
      guideCountryENG:"Angleterre",
      guideCountryES:"Espagne",
      guideCountryDE:"Allemagne",
      guideCountryFR:"France",
      guideCountryPT:"Portugal",
      guideCountryNL:"Pays-Bas",
      guideCountryBR:"Brésil",
      guideDivisionsHeading:"Divisions",
      guideClubActive:"Clubs actifs",guideClubInactive:"Clubs inactifs",
      guideClubIntroTitle:"Clubs et identité",
      guideClubIntro:"Le catalogue comprend 320 clubs répartis dans huit pays : 256 actifs et 64 inactifs. L'identité d'un club ne dépend pas de sa division.",
      guideClubIdentityTitle:"Ce qui définit un club",
      guideClubIdentity:"Chaque club possède un nom principal canonique, un nom complet, un nom court et une abréviation unique de trois lettres, ainsi qu'une ville, un surnom et une description originale.",
      guideClubColoursTitle:"Couleurs et écussons",
      guideClubColours:"Chaque club possède deux couleurs identitaires canoniques. Leurs codes HEX doivent être conservés exactement dans les créations approuvées. Les écussons sont ajoutés individuellement ; les absents utilisent un substitut neutre.",
      guideClubPlacesTitle:"Ville, stade et culture",
      guideClubPlaces:"La ville et le stade ancrent le club dans un lieu. Descriptions et surnoms donnent un contexte culturel sans déterminer les résultats sportifs.",
      guideClubRivalriesTitle:"Participation et rivalités",
      guideClubRivalries:"Chaque pays compte 32 clubs actifs dans deux divisions et huit autres clubs inactifs dans le catalogue. Les rivalités font partie de l'histoire des clubs, sans créer automatiquement de rencontres.",
      guideClubExploreTitle:"Explorer les clubs",
      guideClubExplore:"Découvrez l'identité de chaque club dans son profil et dans l'annuaire.",
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
      guideWorldStructureTitle:"Un mondo di calcio",
      guideWorldCountriesTitle:"Paesi",
      guideWorldParticipationTitle:"Esplora le competizioni",
      guideWorldActive:"Club attivi",
      guideWorldInactive:"Club inattivi",
      guideWorldCountryDetail:"Ogni Paese ha due divisioni. Scegli un campionato per scoprire i suoi club e seguire la stagione.",
      guideWorldHeading:"Che cos'è Football Architect?",guideWorldHeadingText1:"Football Architect è un universo calcistico immaginario in cui puoi seguire club, campionati e coppe internazionali nel corso delle stagioni.",guideWorldHeadingText2:"Scopri otto Paesi, le loro divisioni e i loro club. Segui classifiche, giornate, statistiche e storie che si sviluppano stagione dopo stagione.",
      guideMoveIntroTitle:"Come funzionano promozioni e retrocessioni",
      guideMoveIntro:"Le due divisioni nazionali di ogni Paese sono collegate. Il formato distingue i posti diretti dalle decisioni di fine stagione.",
      guideMoveRelegationTitle:"Prima divisione: retrocessione",
      guideMoveRelegation:"Due posti comportano la retrocessione diretta. Le squadre classificate al 13° e 14° posto disputano un playout per determinare un'ulteriore retrocessione.",
      guideMovePromotionTitle:"Seconda divisione: promozione",
      guideMovePromotion:"Due posti comportano la promozione diretta. Le squadre dal 3° al 6° posto disputano un playoff per un ulteriore posto. La finale si gioca in casa della finalista meglio classificata.",
      guideMoveNoteTitle:"Regole progettate e anteprima attuale",
      guideMoveNote:"Sono regole approvate del formato, ma non significa che le classifiche pubbliche di anteprima calcolino già posizioni finali, esiti o criteri di spareggio. I risultati DEV non attestano promozioni o retrocessioni.",
      guideMoveExplore:"Esplora le regole delle competizioni",
      guideMovementHeading:"Promozioni e retrocessioni",guideMovementHeadingText1:"Promozioni e retrocessioni collegano i due livelli nazionali. Le regole progettate distinguono posti diretti, playoff e playout; consulta la sezione Rules della competizione per il formato applicabile.",guideMovementHeadingText2:"Queste regole non implicano che la simulazione pubblica calcoli già promozioni, retrocessioni o criteri di spareggio.",
      guideCalDays:"Giorni",
      guideCalWeeks:"Settimane",
      guideCalPreseason:"Giorni di prestagione",
      guideCalCycleTitle:"Il ciclo della stagione",
      guideCalCycle:"Football Architect utilizza un calendario concettuale di 56 giorni distribuiti su otto settimane. È una sequenza sportiva, non un calendario di date reali o orari di inizio.",
      guideCalDomesticTitle:"Prestagione e giornate nazionali",
      guideCalDomestic:"Il ciclo riserva dodici giorni alla prestagione. I campionati nazionali prevedono 30 giornate regolari, con otto partite per divisione in ogni giornata nel modello condiviso di anteprima.",
      guideCalInternationalTitle:"Calendario internazionale",
      guideCalInternational:"Gli eventi nazionali e internazionali condividono un'unica linea temporale. Le finali di Sovereign Cup e Federation Cup occupano giorni distinti nel modello a 56 giorni.",
      guideCalPausesTitle:"Pause e transizione",
      guideCalPauses:"Le pause previste e il giorno di transizione separano le fasi. Un indicatore di calendario non crea partite disputate, punteggi o risultati storici.",
      guideCalDataTitle:"Dati e navigazione del calendario",
      guideCalData:"La pagina Calendario presenta la struttura disponibile della stagione. I controlli DEV consentono di consultare varie fasi, ma non rappresentano un orologio live ufficiale.",
      guideCalLink:"Apri il calendario",
      guideCalendarHeading:"Stagioni e calendario",guideCalendarHeadingText1:"Il calendario mondiale prevede un ciclo di 56 giorni in otto settimane: dodici giorni di preseason, eventi nazionali e internazionali, pause e un giorno di transizione.",guideCalendarHeadingText2:"Le finali delle due coppe internazionali si svolgono in giorni distinti. I marcatori del calendario non generano orari, partite o risultati.",
      guideCupMetricCups:"Coppe internazionali",
      guideCupMetricClubs:"Club per coppa",
      guideCupMetricLeague:"Partite fase campionato",
      guideCupMetricSlots:"Slot internazionali",
      guideCupIntroTitle:"Due competizioni internazionali",
      guideCupIntro:"Sovereign Cup e Federation Cup coinvolgono 24 club ciascuna. Sono tornei distinti che condividono la struttura del calendario internazionale.",
      guideCupLeagueTitle:"Fase campionato",
      guideCupLeague:"Ogni club disputa sei partite nella prima fase, distribuite negli slot internazionali I01–I06. Si tratta del formato previsto, non dell'affermazione che esistano già incontri o risultati.",
      guideCupKnockoutTitle:"Fase a eliminazione",
      guideCupKnockout:"Il percorso prosegue con playoff di andata e ritorno (I07–I08), quarti (I09–I10), semifinali (I11–I12) e finali nello slot internazionale I13.",
      guideCupTimelineTitle:"Rapporto con il calendario mondiale",
      guideCupTimeline:"Tredici slot internazionali sono distribuiti tra le giornate nazionali. Entrambe le finali appartengono a I13, ma nel calendario mondiale di 56 giorni si svolgono in giorni distinti.",
      guideCupDataTitle:"Disponibilità dei dati",
      guideCupData:"Classifiche, incontri, statistiche e archivio compaiono soltanto quando sono disponibili dati attendibili. Uno stato vuoto non significa che una partita sia stata disputata o che esista già una vincitrice.",
      guideCupExplore:"Esplora le competizioni internazionali",
      guideCupsHeading:"Coppe internazionali",guideCupsHeadingText1:"Sovereign Cup e Federation Cup riuniscono club di Paesi differenti. Il formato progettato comprende una fase campionato e turni a eliminazione diretta, fino a due finali distinte.",guideCupsHeadingText2:"Le pagine delle competizioni internazionali sono ancora in evoluzione. Uno stato vuoto non rappresenta una partita giocata.",
      guideRecIntroTitle:"Come leggere le statistiche",
      guideRecIntro:"Le statistiche riguardano la competizione e la stagione selezionate. Overview riepiloga partite giocate, gol totali e gol per partita, con due cifre decimali.",
      guideRecTeamsTitle:"Squadre e giocatori",
      guideRecTeams:"Le schede Teams e Players presentano classifiche Top 5 in sette categorie, con «Mostra tutti» quando è disponibile la classifica completa. Una tabella vuota segnala dati mancanti, non rendimento nullo.",
      guideRecHistoryTitle:"Classifiche e record",
      guideRecHistory:"Classifiche e incontri descrivono lo stato della stagione selezionata. History raccoglie stagioni concluse, campioni, classifiche finali e record nel tempo.",
      guideRecAllTimeTitle:"Storico stagionale e assoluto",
      guideRecAllTime:"History distingue le singole stagioni dai record all-time, con primati di squadre e giocatori, attacco e difesa stagionali e maggior numero di vittorie in una stagione.",
      guideRecIntegrityTitle:"Integrità dei dati",
      guideRecIntegrity:"Non si assegna un titolo prima che una stagione sia completata. Senza stagioni concluse o archivi attendibili, vengono mostrati stati vuoti espliciti, non risultati inventati.",
      guideRecLink:"Esplora le statistiche",
      guideRecordsHeading:"Statistiche e storia",guideRecordsHeadingText1:"Le pagine delle competizioni distinguono classifiche e partite dalle statistiche di squadre e giocatori. History raccoglie stagioni concluse, campioni e record quando esistono dati d'archivio.",guideRecordsHeadingText2:"Stagioni e statistiche non disponibili sono indicate esplicitamente, senza inventare risultati.",
      guideExpIntroTitle:"Orientarsi nell'app",
      guideExpIntro:"Football Architect distingue panoramica del mondo, competizioni, club, calendario e impostazioni. Puoi iniziare da una competizione o usare la Dashboard per scegliere dove andare.",
      guideExpDashboardTitle:"Dashboard",
      guideExpDashboard:"La Dashboard è il punto di accesso all'app: non certifica, da sola, risultati in diretta o partite concluse.",
      guideExpCompetitionsTitle:"Competizioni",
      guideExpCompetitions:"Scegli una divisione nazionale o una coppa internazionale disponibile. Le pagine offrono Overview, Standings, Fixtures, Stats e History quando esistono i relativi dati.",
      guideExpCalendarTitle:"Calendario",
      guideExpCalendar:"Esplora la linea temporale condivisa della stagione. Gli indicatori descrivono eventi, non date reali o risultati inventati.",
      guideExpClubsTitle:"Club e impostazioni",
      guideExpClubs:"La directory consente di scoprire l'identità dei club; le schede raccontano le singole squadre. Settings gestisce preferenze supportate, come tema e lingua.",
      guideExpEmptyTitle:"Come leggere gli stati vuoti",
      guideExpEmpty:"Una sezione vuota o non disponibile indica che mancano i dati. Le anteprime riservate allo sviluppo non rappresentano risultati pubblici o archivi ufficiali.",
      guideExpLinkDashboard:"Apri Dashboard",
      guideExpLinkCompetitions:"Esplora competizioni",
      guideExpLinkCalendar:"Apri Calendario",
      guideExpLinkClubs:"Esplora club",
      guideExpLinkSettings:"Apri impostazioni",
      guideExploreHeading:"Esplora l'app",guideExploreHeadingText1:"Da Competitions puoi consultare Overview, Standings, Fixtures, Stats e History. Le pagine dei club presentano le loro identità; Calendar spiega il ciclo condiviso delle stagioni.",guideExploreHeadingText2:"La guida spiega i concetti, senza catalogare ogni club né presentare risultati provvisori dell'ambiente di sviluppo.",
      guideDivActivePlaces:"Posti attivi nei campionati",
      guideDivDetailIntroTitle:"Un sistema nazionale a due livelli",
      guideDivDetailIntro:"Ciascuno degli otto Paesi ha una prima e una seconda divisione. Ogni divisione comprende 16 posti: in totale 16 divisioni e 256 posti attivi nei campionati.",
      guideDivDetailStructureTitle:"Come sono organizzate le divisioni",
      guideDivDetailStructure:"La prima divisione si trova sopra la seconda. I due livelli hanno classifiche e calendari indipendenti; l'identità dei club non dipende dalla categoria.",
      guideDivDetailFormatTitle:"Formato del campionato",
      guideDivDetailFormat:"Il modello condiviso di anteprima prevede un girone di andata e ritorno: ogni club affronta due volte gli altri 15, una in casa e una in trasferta. Ne derivano 30 giornate con otto partite ciascuna, per 240 partite a divisione.",
      guideDivDetailCaution:"Il sistema ufficiale di punteggio e i criteri di spareggio non sono definiti da questo contratto di anteprima. Promozioni e retrocessioni sono trattate separatamente e non vanno dedotte dalle classifiche fittizie DEV.",
      guideDivDetailCatalogueTitle:"Le divisioni nazionali per Paese",
      guideDivTier1:"Prima divisione",
      guideDivTier2:"Seconda divisione",
      guideDivClubs:"16 club",
      guideDivRounds:"30 giornate",
      guideDivMatches:"240 partite",
      guideDivPerRound:"8 partite per giornata",
      guideDivExploreTitle:"Esplora le competizioni nazionali",
      guideDivExplore:"Visita le pagine delle competizioni per classifiche, partite, statistiche e archivio, quando disponibili.",
      guideCountryIT:"Italia",
      guideCountryENG:"Inghilterra",
      guideCountryES:"Spagna",
      guideCountryDE:"Germania",
      guideCountryFR:"Francia",
      guideCountryPT:"Portogallo",
      guideCountryNL:"Paesi Bassi",
      guideCountryBR:"Brasile",
      guideDivisionsHeading:"Divisioni",
      guideClubActive:"Club attivi",guideClubInactive:"Club inattivi",
      guideClubIntroTitle:"Club e identità",
      guideClubIntro:"Il catalogo comprende 320 club in otto Paesi: 256 attivi e 64 inattivi. L'identità del club è indipendente dalla divisione in cui partecipa.",
      guideClubIdentityTitle:"Cosa definisce un club",
      guideClubIdentity:"Ogni club dispone di nome principale canonico, nome completo, nome compatto e abbreviazione univoca di tre lettere, oltre a città, soprannome e descrizione originale.",
      guideClubColoursTitle:"Colori e stemmi",
      guideClubColours:"Ogni club possiede due colori identitari canonici. Gli HEX primario e secondario devono essere preservati esattamente nei loghi approvati. Gli stemmi vengono integrati individualmente; dove mancano si usa un segnaposto neutro.",
      guideClubPlacesTitle:"Città, stadio e cultura",
      guideClubPlaces:"Città e stadio legano ogni club a un luogo. Descrizioni e soprannomi ne raccontano il contesto culturale, senza determinare i risultati sportivi.",
      guideClubRivalriesTitle:"Partecipazione e rivalità",
      guideClubRivalries:"Ogni Paese conta 32 club attivi in due divisioni e altri otto inattivi nel catalogo. Le rivalità appartengono alla storia dei club e non generano automaticamente partite in calendario.",
      guideClubExploreTitle:"Esplora le schede dei club",
      guideClubExplore:"Scopri l'identità dei club nelle pagine dedicate e nella directory.",
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
    if (labels.some(node => node.dataset.i18n === "guideTitle")) document.title = ((document.getElementById("page-title")?.textContent) || copy.guideTitle) + " — Football Architect";
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
