// Interface translations are intentionally kept outside the simulation model.
// In-game values and historical mail remain in their original, save-compatible format.
export const GAME_NAME = 'Football Architect';
export const LANGUAGE_KEY = 'football-architect:language';
export const PREVIOUS_LANGUAGE_KEY = 'touchline-dynasty:language';
export const locales = Object.freeze({it: 'Italiano', en: 'English'});
export function preferredLanguage(){
  try {
    const selected=localStorage.getItem(LANGUAGE_KEY)??localStorage.getItem(PREVIOUS_LANGUAGE_KEY);
    return selected==='en'?'en':'it';
  } catch { return 'it'; }
}
export function saveLanguage(language){
  const value = language==='en'?'en':'it';
  try { localStorage.setItem(LANGUAGE_KEY,value); } catch { /* Private browsing may disable storage. */ }
  return value;
}
const translations = Object.fromEntries(`
Modalità offline · Universo originale|Offline mode · Original universe
SCELTA DEL PAESE|CHOOSE A COUNTRY
Scegli nazione e campionato|Choose a country and league
Paesi e città sono reali; competizioni, squadre, stemmi e calciatori sono immaginari. Nessuna licenza sportiva reale.|Countries and cities are real; competitions, clubs, crests and players are fictional. No real-world sports licences.
8 NAZIONI · 8 CAMPIONATI|8 COUNTRIES · 8 LEAGUES
CAMPIONATO FEDERALE|FEDERAL CHAMPIONSHIP
Città reali, squadre e competizioni immaginarie. Ogni nuova carriera si svolge nel campionato selezionato.|Real cities, fictional clubs and leagues. Each new career takes place in the selected league.
NAZIONE|COUNTRY
Club e città|Clubs and cities
Le squadre immaginarie e le città reali del campionato|The fictional clubs and real cities in the league
Italia|Italy
Inghilterra|England
Germania|Germany
Portogallo|Portugal
Paesi Bassi|Netherlands
Non specificata|Not specified
LA TUA STORIA COMINCIA QUI|YOUR STORY STARTS HERE
Il calcio è fatto|Football is about
di scelte.|decisions.
Venti club. Centinaia di storie mai raccontate. Una panchina da conquistare. Scegli da dove iniziare la tua carriera.|Twenty clubs. Hundreds of untold stories. One dugout to make your own. Choose where to begin your career.
Dodici club. Centinaia di storie mai raccontate. Una panchina da conquistare. Scegli da dove iniziare la tua carriera.|Twelve clubs. Hundreds of untold stories. One dugout to make your own. Choose where to begin your career.
Scegli il tuo club|Choose your club
20 SOCIETÀ|20 CLUBS
12 SOCIETÀ|12 CLUBS
IL TUO PROSSIMO CLUB|YOUR NEXT CLUB
REPUTAZIONE|REPUTATION
IMPIANTO|STADIUM
BUDGET MERCATO|TRANSFER BUDGET
NOME DELL'ALLENATORE|MANAGER NAME
Inizia carriera|Start career
Tutti i progressi vengono salvati automaticamente su questo dispositivo.|Your progress is saved automatically on this device.
SIMULAZIONE CALCISTICA|FOOTBALL SIMULATION
SOCIETÀ E ATLETI IMMAGINARI|FICTIONAL CLUBS AND PLAYERS
SALVATAGGIO LOCALE|LOCAL SAVING
Come vuoi essere chiamato?|What should we call you?
CARRIERA ATTIVA|ACTIVE CAREER
GESTIONE CLUB|CLUB MANAGEMENT
Scrivania|Dashboard
Rosa|Squad
Tattiche|Tactics
Calendario|Fixtures
Campionato|League
Mercato|Transfers
Allenamento|Training
Finanze|Finances
Posta|Inbox
Impostazioni|Settings
Salvataggio locale attivo|Local save active
UN MONDO. MILLE STORIE.|ONE WORLD. A THOUSAND STORIES.
LEGA AURORA|AURORA LEAGUE
Lega Aurora|Aurora League
Continua|Continue
Nuova stagione|New season
Campionato concluso|Season finished
Apri menu|Open menu
Chiudi|Close
Menu principale|Main menu
Carriere|Careers
Dirigenza|Board
Analisi avanzata|Advanced analysis
Gestisci carriere|Manage careers
CENTRO DI CONTROLLO|CONTROL CENTRE
Ogni decisione conta. Ecco cosa succede nel tuo club.|Every decision counts. Here's what's happening at your club.
PROSSIMA PARTITA|NEXT MATCH
FINE CAMPIONATO|SEASON ENDED
STAGIONE COMPLETATA|SEASON COMPLETE
IN CASA|AT HOME
IN TRASFERTA|AWAY
Gioca la giornata|Play matchday
La stagione è nei libri di storia.|The season is in the history books.
POSIZIONE IN CLASSIFICA|LEAGUE POSITION
VALUTAZIONE ROSA|SQUAD RATING
Prima squadra|First team
Disponibile|Available
Per rinforzare la rosa|To strengthen your squad
ULTIME 5 PARTITE|LAST 5 MATCHES
La forma della tua squadra|Your team's recent form
Calendario della squadra|Team fixtures
Le prossime sfide da affrontare|Your next challenges
Vedi calendario|View fixtures
Classifica|Standings
La lotta per le prime posizioni|The race at the top of the table
Classifica completa|Full standings
Ultimi risultati|Recent results
Il percorso nelle giornate disputate|Results from recent matchdays
Nessuna partita giocata. La tua avventura deve ancora iniziare.|No matches played yet. Your journey is about to begin.
Dal centro sportivo|Training ground
Aggiornamenti, talento e spogliatoio|Updates, talent and dressing-room news
OSSERVATO SPECIALE|ONE TO WATCH
MESSAGGI DELLA SOCIETÀ|CLUB MESSAGES
Nessuna comunicazione|No messages
Nessun calciatore in rosa|No players in the squad
PROGRAMMA ALLENAMENTO|TRAINING PROGRAMME
Focus attuale del gruppo squadra|Current training focus
UNIVERSO DI FANTASIA|FICTIONAL UNIVERSE
IL GRUPPO|THE SQUAD
Rosa prima squadra|First-team squad
Gestisci formazione|Manage lineup
CALCIATORI|PLAYERS
MEDIA VALUTAZIONE|AVERAGE RATING
ETÀ MEDIA|AVERAGE AGE
MONTE INGAGGI / SETTIMANA|WAGE BILL / WEEK
Elenco calciatori|Player list
Seleziona un nome per aprire la scheda completa.|Select a player to open their full profile.
Tutti|All
Portieri|Goalkeepers
Difensori|Defenders
Centrocampisti|Midfielders
Attaccanti|Forwards
Ordina|Sort
Ruolo|Position
Età|Age
Valore|Value
CALCIATORE|PLAYER
RUOLO|POSITION
ETÀ|AGE
FORMA FISICA|FITNESS
MORALE|MORALE
PG|PL
Alta|High
Media|Medium
Bassa|Low
Nessun calciatore corrisponde ai filtri.|No players match these filters.
Infortunato|Injured
Assegna calciatore|Assign player
Casa|Home
Trasferta|Away
Il campionato è terminato.|The league season is over.
Hai chiuso al|You finished in
È il momento di progettare il futuro.|It's time to plan for the future.
Avvia nuova stagione|Start new season
Allenatore|Manager
Report allenamento|Training report
Richiesta non valida.|Invalid request.
Club non valido.|Invalid club.
Seleziona prima un club.|Choose a club first.
La formazione è incompleta: seleziona undici titolari prima di giocare.|Your lineup is incomplete: select eleven starters before playing.
Stagione terminata: avvia quella successiva.|Season finished: start the next one.
Modulo sconosciuto.|Unknown formation.
Giocatore non disponibile.|Player unavailable.
Posizione non valida.|Invalid position.
Non puoi acquistare questo giocatore.|You cannot sign this player.
Rosa piena: massimo 32 calciatori.|Squad full: maximum 32 players.
Il club non intende cedere altri giocatori.|The club will not sell any more players.
Il calciatore non appartiene al club.|This player does not belong to your club.
Servono almeno 19 calciatori in rosa.|Your squad must contain at least 19 players.
Nessuna offerta disponibile.|No offers available.
Termina il campionato prima di iniziare una nuova stagione.|Finish the league season before starting a new one.
Spazio browser esaurito. Esporta il salvataggio.|Browser storage full. Export your save.
Il file supera la dimensione massima consentita (5 MB).|File exceeds the maximum allowed size (5 MB).
Il file non contiene un salvataggio valido e compatibile.|The file is not a valid, compatible save.
Il JSON del salvataggio non è valido.|The save file is not valid JSON.
Salvataggio creato con una versione più recente. Aggiorna Football Architect prima di continuare.|This save was created with a newer version. Update Football Architect before continuing.
Impossibile creare il backup originale.|The original backup could not be created.
Backup non verificato. La carriera attuale non è stata sostituita.|Backup could not be verified. Your current career has not been replaced.
Il backup richiesto non è disponibile.|The requested backup is not available.
Il salvataggio non è stato verificato.|The save could not be verified.
Importare questa carriera? La carriera attuale verrà sostituita.|Import this career? Your current career will be replaced.
Carriera importata correttamente.|Career imported successfully.
Miglior undici disponibile selezionato.|Best available starting eleven selected.
Formazione aggiornata.|Lineup updated.
Slot liberato.|Position cleared.
Calciatore aggiunto agli osservati.|Player added to your watchlist.
Calciatore rimosso dagli osservati.|Player removed from your watchlist.
Tutti i messaggi sono stati letti.|All messages marked as read.
Salvataggio esportato in JSON.|Save exported as JSON.
Cancellare questa carriera e tutti i suoi progressi? Esporta prima il salvataggio se vuoi conservarlo.|Delete this career and all progress? Export your save first if you want to keep it.
Nuova carriera pronta da creare.|Ready to start a new career.
Si è verificato un errore.|An error occurred.
Cerca un calciatore...|Search for a player...
IL PIANO PARTITA|MATCH PLAN
Tattiche e formazione|Tactics and lineup
Costruisci il tuo undici titolare. Clicca un ruolo sul campo per cambiare calciatore.|Build your starting eleven. Select a position on the pitch to change the player.
Formazione automatica|Auto-select lineup
Formazione titolare|Starting lineup
Titolare|Starter
Slot libero|Empty position
Tocca un ruolo per sostituire|Select a position to make a change
Modulo di gioco|Formation
La disposizione in campo|How your team lines up
Identità tattica|Tactical identity
Come vuoi affrontare gli avversari?|How do you want to approach your opponents?
MENTALITÀ|MENTALITY
Prudente|Cautious
Equilibrata|Balanced
Offensiva|Attacking
PRESSING|PRESSING
Basso|Low
Normale|Normal
Alto|High
RITMO DI GIOCO|MATCH TEMPO
Condizione della rosa|Squad readiness
Dati aggiornati alla giornata corrente|Updated for the current matchday
Condizione media|Average fitness
Sotto il 65%|Below 65%
Indisponibili|Unavailable
Calendario e risultati|Fixtures and results
38 giornate, andata e ritorno. Tutte le gare del campionato.|38 matchdays, home and away. Every league fixture.
22 giornate, andata e ritorno. Tutte le gare del campionato.|22 matchdays, home and away. Every league fixture.
DA GIOCARE|UPCOMING
FINALE|FULL TIME
Vedi il tabellino|View match report
Seleziona una partita disputata per visualizzare le statistiche.|Select a completed match to view its statistics.
COMPETIZIONE|COMPETITION
Dodici club. Un solo campione. Classifica e protagonisti della stagione.|Twelve clubs. One champion. Standings and stars of the season.
20 club. Un solo campione. Classifica e protagonisti della stagione.|20 clubs. One champion. League standings and star performers.
Classifica generale|League table
CLUB|CLUB
V|W
N|D
P|L
GF|GF
GS|GA
DR|GD
PT|PTS
FORMA|FORM
Campione|Champion
Zona bassa|Bottom positions
Il tuo club|Your club
Classifica marcatori|Top scorers
I protagonisti sotto porta|The players finding the net
I primi marcatori appariranno dopo le partite.|Top scorers will appear after the first matches.
Come funziona|How it works
Regolamento della Lega Aurora|Aurora League rules
Ogni club affronta gli altri 11 due volte, per un totale di|Each club faces the other 11 twice, for a total of
38 giornate|38 matchdays
22 giornate|22 matchdays
3 punti|3 points
per vittoria,|for a win,
per pareggio,|for a draw,
per sconfitta.|for a loss.
In caso di parità: differenza reti, gol segnati e ordine convenzionale.|Ties are broken by goal difference, goals scored, then fixed club order.
RECLUTAMENTO|RECRUITMENT
Centro mercato|Transfer centre
Osserva i talenti della lega e costruisci la squadra che immagini.|Scout league talent and build the team you have in mind.
RISORSE A DISPOSIZIONE|AVAILABLE FUNDS
Budget trasferimenti attuale|Current transfer budget
ROSA ATTUALE|CURRENT SQUAD
Calciatori sotto contratto|Contracted players
Database calciatori|Player database
Tutti i giocatori di questo campionato sono inventati.|Every player in this league is fictional.
Tutti i ruoli|All positions
CLUB ATTUALE|CURRENT CLUB
POS.|POS.
POT.|POT.
VALORE|VALUE
Dettagli|Details
Nessun giocatore trovato con questi filtri.|No players match the current filters.
Cerca un nome o una squadra...|Search for a name or club...
CENTRO SPORTIVO|TRAINING CENTRE
Prepara la squadra, monitora le condizioni e segui la crescita dei giovani.|Prepare your squad, monitor fitness and track youth development.
CONDIZIONE MEDIA|AVERAGE FITNESS
MORALE MEDIO|AVERAGE MORALE
INFORTUNATI|INJURED
Programma di allenamento|Training programme
Scegli il focus tecnico. Lo sviluppo dei giocatori viene aggiornato durante la stagione.|Choose a training focus. Player development updates throughout the season.
Un programma completo per tutta la rosa.|A balanced programme for the whole squad.
Attacco|Attack
Finalizzazione, movimenti e rifinitura.|Finishing, movement and link-up play.
Difesa|Defence
Posizionamento, marcature e coperture.|Positioning, marking and defensive cover.
Giovani|Youth
Maggiore attenzione allo sviluppo dei talenti.|Extra attention to developing young talent.
Prospetti da seguire|Young prospects
Calciatori fino a 24 anni con margine di crescita|Players aged 24 or under with room to improve
Nessun giovane in rosa.|No young players in the squad.
Infermeria|Medical centre
Disponibilità dei calciatori|Player availability
Tutti disponibili|Everyone available
Non risultano calciatori infortunati.|No players are currently injured.
SOCIETÀ|CLUB
Situazione finanziaria|Financial overview
Controlla la liquidità, gli ingaggi e i movimenti di mercato.|Keep track of cash flow, wages and transfer activity.
DISPONIBILITÀ DEL CLUB|CLUB CASH BALANCE
BUDGET TRASFERIMENTI|TRANSFER BUDGET
INGAGGI SETTIMANALI|WEEKLY WAGES
Andamento liquidità|Cash balance trend
Evoluzione del saldo durante la stagione|How the club's balance changes over the season
I primi dati appariranno dopo aver giocato delle partite.|Your financial trend will appear after playing matches.
INIZIO STAGIONE|START OF SEASON
Bilancio stagionale|Season finances
Entrate e uscite complessive|Total income and expenses
Entrate stadio e sponsor|Matchday and sponsor income
Stipendi calciatori|Player wages
Operazioni mercato|Transfer deals
Saldo attuale|Current balance
Registro trasferimenti|Transfer history
Acquisti e cessioni effettuati nel corso della carriera|Signings and sales made during your career
STAGIONE|SEASON
GIORNATA|MATCHDAY
TIPO|TYPE
IMPORTO|AMOUNT
Nessun movimento di mercato registrato.|No transfer activity yet.
COMUNICAZIONI|COMMUNICATIONS
Posta in arrivo|Inbox
Messaggi dal club, staff tecnico e competizione.|Messages from your club, staff and league.
Segna tutto come letto|Mark all as read
MESSAGGI|MESSAGES
Nessun messaggio ricevuto.|No messages received.
Benvenuto sulla panchina|Welcome to the dugout
La stagione sta per iniziare|The season is about to begin
Situazione infermeria|Medical report
PREFERENZE|PREFERENCES
Impostazioni e salvataggi|Settings and saves
La tua carriera esiste soltanto su questo computer, senza account e senza servizi esterni.|Your career lives on this computer only, with no account or online services.
La tua carriera|Your career
Informazioni sul salvataggio attivo|Current save information
ALLENATORE|MANAGER
SQUADRA|TEAM
PARTITE GIOCATE|MATCHDAYS PLAYED
ULTIMO SALVATAGGIO|LAST SAVED
Gestione dati|Data management
Esporta una copia o importa una carriera esistente.|Export a backup or import an existing career.
Esporta carriera|Export career
Scarica un file JSON del salvataggio.|Download a JSON save file.
Importa carriera|Import career
Ripristina un salvataggio precedentemente esportato.|Restore an exported career.
Nuova carriera|New career
Elimina il salvataggio corrente e ricomincia.|Delete the current save and start again.
Informazioni sul gioco|About the game
Progetto originale, eseguibile in locale|Original project, runs locally
Universo immaginario|Fictional universe
Squadre, città, stemmi e calciatori sono stati creati per questo gioco. Nessuna licenza sportiva reale.|Clubs, cities, badges and players were created for this game. No real sports licences.
100% offline|100% offline
Nessuna registrazione, server esterno, CDN o dipendenza da servizi online. Salvataggio automatico nel browser.|No sign-up, external server, CDN or online services. Saves automatically in your browser.
Simulazione gestionale|Management simulation
38 giornate, risultati, tattiche, crescita, infortuni, contratti, bilanci, mercato e stagioni successive.|38 matchdays, results, tactics, development, injuries, contracts, finances, transfers and future seasons.
22 giornate, risultati, tattiche, crescita, infortuni, contratti, bilanci, mercato e stagioni successive.|22 matchdays, results, tactics, development, injuries, contracts, finances, transfers and future seasons.
SCHEDA CALCIATORE|PLAYER PROFILE
VALUTAZIONE|OVERALL
GENERALE|RATING
VALORE DI MERCATO|MARKET VALUE
INGAGGIO / SETTIMANA|WAGE / WEEK
CONTRATTO|CONTRACT
DISPONIBILITÀ|AVAILABILITY
PRESENZE|APPEARANCES
ASSIST|ASSISTS
Rimuovi osservato|Remove from watchlist
Segui calciatore|Add to watchlist
Partita non ancora disputata.|Match not yet played.
Statistiche|Statistics
Possesso|Possession
Tiri totali|Total shots
Expected goals|Expected goals
Marcatori|Goalscorers
Nessun gol segnato.|No goals scored.
Profilo calciatore|Player profile
Resoconto partita|Match report
Seleziona calciatore|Select player
Scegli il calciatore per il ruolo|Choose a player for the position
. Un giocatore già schierato verrà scambiato di posizione.|. A player already in the lineup will swap positions.
Naturale|Natural
Lascia vuoto|Leave empty
Portiere|Goalkeeper
Terzino destro|Right-back
Difensore centrale|Centre-back
Terzino sinistro|Left-back
Mediano|Defensive midfielder
Centrocampista|Central midfielder
Trequartista|Attacking midfielder
Ala destra|Right winger
Ala sinistra|Left winger
Attaccante|Striker
Equilibrato|Balanced
Arvenia|Arvenia
Spagna|Spain
Francia|France
Danimarca|Denmark
Croazia|Croatia
Brasile|Brazil
Destro|Right
Sinistro|Left
destro|right
sinistro|left
anno|year
anni|years
Acquisto|Signing
Cessione|Sale
Lingua|Language
LINGUA|LANGUAGE
Scegli la lingua dell'interfaccia.|Choose the interface language.
Italiano|Italian
Inglese|English
Vittoria|Win
Pareggio|Draw
Sconfitta|Loss
F I N A L E|FULL TIME
`.trim().split('\n').filter(Boolean).map(line=>{
  const divider=line.indexOf('|'); return [line.slice(0,divider),line.slice(divider+1)];
}));

const dynamicPatterns = [
  [/^(\d+) club\. Un solo campione\. Classifica e protagonisti della stagione\.$/,'$1 clubs. One champion. League standings and star performers.'],
  [/^Ogni club affronta gli altri (\d+) due volte, per un totale di\s*$/,'Each club faces the other $1 twice, for a total of '],
  [/^Il file non contiene/i,'The file does not contain'],
  [/^Stagione (\d+): si riparte!$/,'Season $1: a fresh start!'],
  [/^Ufficiale: (.+)$/,'Confirmed: $1'],
  [/^Cessione completata: (.+)$/,'Transfer completed: $1'],
  [/^Progressi tecnici rilevati: (.+)\. Il lavoro sul campo inizia a dare risultati\.$/,'Player development: $1. Training sessions are paying off.'],
  [/^(.+) arriva da (.+) per (.+)\. È già disponibile per la prima squadra\.$/,'$1 joins from $2 for $3. He is ready for the first team.'],
  [/^(.+) passa al (.+) per (.+)\.$/,'$1 moves to $2 for $3.'],
  [/^Hai chiuso la precedente stagione al (\d+)° posto\. La società ha stanziato (.+) in premi e nuovi fondi\.$/,'You finished last season in position $1. The board has allocated $2 in prize money and new funds.'],
  [/^Budget insufficiente: servono (.+)\.$/,'Not enough transfer budget: $1 needed.'],
  [/^Benvenuto al (.+)!$/,'Welcome to $1!'],
  [/^Giornata (\d+) completata · (.+)$/,'Matchday $1 completed · $2'],
  [/^Avviare la stagione (\d+)\? La classifica e le statistiche stagionali ripartiranno da zero\.$/,'Start season $1? League standings and seasonal stats will reset.'],
  [/^Nuova stagione! (\d+)° posto e premio (.+) milioni €\.$/,'New season! Finished $1th and earned €$2 million in prize money.'],
  [/^Modulo (\S+) applicato\.$/,'Formation $1 applied.'],
  [/^Mentalità: (.+)\.$/,(m,v)=>`Mentality: ${translations[v]||v}.`],
  [/^Pressing: (.+)\.$/,(m,v)=>`Pressing: ${translations[v]||v}.`],
  [/^Ritmo: (.+)\.$/,(m,v)=>`Tempo: ${translations[v]||v}.`],
  [/^Programma (.+) selezionato\.$/,(m,v)=>`${translations[v]||v} training programme selected.`],
  [/^Acquistare (.+) per il tuo club\?$/,'Sign $1 for your club?'],
  [/^Acquisto completato · (.+) M€\.$/,'Signing completed · €$1m.'],
  [/^Confermi la cessione di (.+)\? Il trasferimento è immediato\.$/,'Sell $1? The transfer takes effect immediately.'],
  [/^(.+) ceduto con successo\.$/,'$1 sold successfully.'],
  [/^Fondato nel (\d+)$/,'Founded in $1'],
  [/^(.+?) · Fondato nel (\d+)$/,'$1 · Founded in $2'],
  [/^Bentornato, (.+)\.$/,'Welcome back, $1.'],
  [/^Stagione (\d+)$|^STAGIONE (\d+)$/,(m,a,b)=>a?`Season ${a}`:`SEASON ${b}`],
  [/^(\d+) NAZIONI · (\d+) CAMPIONATI$/,'$1 COUNTRIES · $2 LEAGUES'],
  [/^Giornata (\d+) di (\d+)$/,'Matchday $1 of $2'],
  [/^Stagione (\d+) · Giornata (\d+)$/,'Season $1 · Matchday $2'],
  [/^Giornata (\d+)$/,'Matchday $1'],
  [/^GIORNATA (\d+)$/,'MATCHDAY $1'],
  [/^Offline · Stagione (\d+)$/,'Offline · Season $1'],
  [/^(.+) · Giornata (\d+)$/,'$1 · Matchday $2'],
  [/^(.+) · GIORNATA (\d+)$/,'$1 · MATCHDAY $2'],
  [/^LEGA AURORA · GIORNATA (\d+)$/,'AURORA LEAGUE · MATCHDAY $1'],
  [/^COMUNICAZIONE · STAGIONE (\d+), GIORNATA (\d+)$/,'MESSAGE · SEASON $1, MATCHDAY $2'],
  [/^LA TUA PARTITA · (FINALE|DA GIOCARE)$/,(m,s)=>`YOUR MATCH · ${s==='FINALE'?'FULL TIME':'UPCOMING'}`],
  [/^Tutte le partite · giornata (\d+)$/,'All matches · matchday $1'],
  [/^Aggiornata dopo (\d+) \/ (\d+) giornate$/,'Updated after $1 / $2 matchdays'],
  [/^Modulo (\S+) · (\d+) titolari$/,'Formation $1 · $2 starters'],
  [/^Modulo (\S+)$/,'Formation $1'],
  [/^(\d+) club\. Centinaia di storie mai raccontate\. Una panchina da conquistare\. Scegli da dove iniziare la tua carriera\.$/,'$1 clubs. Hundreds of untold stories. One dugout to make your own. Choose where to begin your career.'],
  [/^Gestisci (\d+) calciatori sotto contratto con (.+)\.$/,'Manage $1 contracted players at $2.'],
  [/^(\d+) giocatori visualizzati su (\d+)$/,'Showing $1 of $2 players'],
  [/^(\d+) di (\d+) risultati visualizzati · Ricerche limitate al campionato attuale$/,'Showing $1 of $2 results · Search limited to the current league'],
  [/^(\d+) risultati visualizzati · Ricerche limitate al campionato attuale$/,'$1 results shown · Search limited to the current league'],
  [/^Osservati \((\d+)\)$/,'Watchlist ($1)'],
  [/^(\d+) non letti$/,'$1 unread'],
  [/^(\d+) da leggere$/,'$1 unread'],
  [/^(\d+) calciatori$/,'$1 players'],
  [/^(\d+) punti$/,'$1 points'],
  [/^dopo (\d+) giornate$/,'after $1 matchdays'],
  [/^(\d+) PG$/,'$1 PL'],
  [/^su (\d+)$/,'of $1'],
  [/^(\d+) gol · (\d+) valutazione generale$/,'$1 goals · $2 overall rating'],
  [/^Saldo aggiornato dopo la giornata (\d+)$/,'Balance updated after matchday $1'],
  [/^(.+) · (\d+) anni · Piede (destro|sinistro)$/,(m,n,a,foot)=>`${n} · ${a} years old · ${foot==='destro'?'Right':'Left'}-footed`],
  [/^(\d+) anni$/,'$1 years'],
  [/^(\d+) anno$/,'$1 year'],
  [/^(\d+) giorn\. di stop$/,'$1 matchdays out'],
  [/^(\d+) giorn\.$/,'$1 matchdays'],
  [/^(POR|TD|DC|TS|MED|CC|COC|AD|AS|ATT) · (\d+) anni( · Titolare)?$/,(m,p,a,starter)=>`${p} · ${a} years${starter?' · Starter':''}`],
  [/^(\d+)° posto$/,'$1th place'],
  [/^Cedi · (.+)$/,'Sell · $1'],
  [/^Acquista · (.+)$/,'Sign · $1'],
  [/^Vittoria contro (.+)$/,'Win against $1'],
  [/^Pareggio contro (.+)$/,'Draw against $1'],
  [/^Sconfitta contro (.+)$/,'Loss against $1'],
  [/^Il campionato comprende (\d+) club e (\d+) giornate\. La prima partita sarà contro (.+)\.$/,'The league has $1 clubs and $2 matchdays. Your first match is against $3.'],
  [/^La dirigenza di (.+) ti ha affidato la prima squadra\. Il tuo obiettivo è costruire un progetto competitivo nella (.+)\.$/,(m,club,league)=>`The board at ${club} has put you in charge of the first team. Your goal is to build a competitive project in ${league==='Lega Aurora'?'the Aurora League':league}.`],
  [/^Regolamento · (.+)$/,'$1 rules'],
  [/^La dirigenza di (.+) ti ha affidato la prima squadra\. Il tuo obiettivo è costruire un progetto competitivo nella competizione (.+)\.$/,(m,club,league)=>`The board at ${club} has put you in charge of the first team. Your goal is to build a competitive project in ${league}.`],
  [/^Giornata (\d+): (.+)\. La squadra ha conquistato tre punti\.$/,'Matchday $1: $2. Your team earned three points.'],
  [/^Giornata (\d+): (.+)\. Un punto aggiunto alla classifica\.$/,'Matchday $1: $2. One point added to the table.'],
  [/^Giornata (\d+): (.+)\. Ora il gruppo deve reagire\.$/,'Matchday $1: $2. The squad needs to bounce back.'],
  [/^I giocatori indisponibili non verranno convocati\.$/,'Unavailable players will not be selected.'],
  [/^(.+)\. I giocatori indisponibili non verranno convocati\.$/,(m,n)=>`${n.replace(/(\d+) giornat[ae]/g,'$1 matchdays')}. Unavailable players will not be selected.`],
  [/^([+-]?\s*\d+(?:,\d+)?) M€$/,(m,n)=>`${n.replace(',','.')} M€`],
  [/^([+-]?\s*\d+) mila €$/,'$1k €']
];
export function translate(text,language='it'){
  if(language!=='en'||text==null)return String(text??'');
  const string=String(text),trimmed=string.trim();
  if(!trimmed)return string;
  let english=translations[trimmed];
  if(english===undefined){
    english=trimmed;
    for(const [pattern,replacement] of dynamicPatterns){
      if(pattern.test(trimmed)){english=trimmed.replace(pattern,replacement);break;}
    }
  }
  // Preserve whitespace, including leading/trailing spaces from HTML templates.
  if(english!==trimmed)english=english.replace(/(\d+),(\d+) M€/g,'$1.$2 M€');
  return string.slice(0,string.indexOf(trimmed))+english+string.slice(string.indexOf(trimmed)+trimmed.length);
}
export function translateUi(root,language){
  if(language!=='en')return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const texts=[];let node;
  while((node=walker.nextNode())){if(!node.parentElement?.closest('script,style'))texts.push(node);}
  for(const textNode of texts)textNode.nodeValue=translate(textNode.nodeValue,language);
  for(const dot of root.querySelectorAll('.form-dot')){
    dot.textContent=dot.classList.contains('form-V')?'W':dot.classList.contains('form-P')?'D':'L';
  }
  for(const el of root.querySelectorAll('[placeholder],[title],[aria-label]')){
    for(const attr of ['placeholder','title','aria-label'])if(el.hasAttribute(attr))el.setAttribute(attr,translate(el.getAttribute(attr),language));
  }
}
export function pageTitle(page,language){
  const names={dashboard:'Scrivania',club:'Club',squad:'Rosa',tactics:'Tattiche',calendar:'Calendario',league:'Campionato',world:'Mondo',market:'Mercato',training:'Allenamento',advanced:'Analisi avanzata',finance:'Finanze',board:'Dirigenza',inbox:'Posta',settings:'Impostazioni',careers:'Carriere'};
  return `${translate(names[page]||'Scrivania',language)} | ${GAME_NAME}`;
}
