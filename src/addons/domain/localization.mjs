/** QOL02.01/03 — Static bilingual catalogs and strict parameterized localization.
 * Presentation-only; no world mutation or external translation service.
 */
export const worldLabels={
 it:{title:'Mondo calcistico',subtitle:'Otto campionati, un solo calendario',preview:'Anteprima WRD01: i risultati non aggiornano la carriera ufficiale.',day:'Giorno',season:'Stagione',countries:'Campionati',standing:'Classifica',fixtures:'Risultati',scorers:'Marcatori',player:'Calciatore',club:'Club',played:'G',win:'V',draw:'N',loss:'P',goals:'GF',against:'GS',points:'Pt',round:'Giornata',home:'Casa',away:'Trasferta',score:'Risultato',unplayed:'Da giocare',locked:'Lega storica protetta: continua a usare il salvataggio originale.',search:'Ricerca globale',searchHelp:'Cerca club e calciatori in tutte le nazioni',noResults:'Nessun risultato',noScorers:'Nessun marcatore disponibile',country:{IT:'Italia',ENG:'Inghilterra',ESP:'Spagna',GER:'Germania',FRA:'Francia',NED:'Paesi Bassi',POR:'Portogallo',BEL:'Belgio'}},
 en:{title:'Football world',subtitle:'Eight leagues, one common timeline',preview:'Standalone WRD01 preview: results do not change the official career.',day:'Day',season:'Season',countries:'Leagues',standing:'Standings',fixtures:'Results',scorers:'Scorers',player:'Player',club:'Club',played:'P',win:'W',draw:'D',loss:'L',goals:'GF',against:'GA',points:'Pts',round:'Round',home:'Home',away:'Away',score:'Score',unplayed:'Upcoming',locked:'Protected legacy league: the original save remains authoritative.',search:'Global search',searchHelp:'Search clubs and players across all countries',noResults:'No results',noScorers:'No scorers available',country:{IT:'Italy',ENG:'England',ESP:'Spain',GER:'Germany',FRA:'France',NED:'Netherlands',POR:'Portugal',BEL:'Belgium'}}
};
export const historyLabels={
 it:{title:'Storia del mondo',subtitle:'Risultati archiviati delle competizioni immaginarie',preview:'Modulo WRD05: dati del kit, non risultati ufficiali della tua carriera.',season:'Stagione',country:'Campionato',winner:'Campione',scorer:'Capocannoniere',palmares:'Albo d’oro',record:'Record stagionali',rivalries:'Rivalità',identities:'Identità dei club',standing:'Classifica finale',club:'Società',played:'G',points:'Pt',goals:'GF',against:'GS',history:'Cronologia',noArchive:'Non ci sono ancora stagioni concluse.',noLeague:'Competizione legacy protetta: archivio non disponibile.',noRecord:'Nessuna statistica storica verificata.',noScorers:'Marcatori non disponibili',noRivalries:'Nessuna rivalità registrata.',fictional:'Profilo narrativo immaginario',city:'Città',founded:'Fondazione fittizia',reputation:'Reputazione stimata',cityDerby:'Derby cittadino',sporting:'Rivalità sportiva',meetings:'Sfide registrate',wins:'Vittorie',draws:'Pareggi',source:'I dati derivano da partite archiviate. Coppe, promozioni e premi non simulati non vengono inventati.',values:{points:'Punti',wins:'Vittorie',goals:'Reti segnate',defence:'Meno reti subite',goal_difference:'Differenza reti',top_scorer:'Reti capocannoniere'},countries:{IT:'Italia',ENG:'Inghilterra',ESP:'Spagna',GER:'Germania',FRA:'Francia',NED:'Paesi Bassi',POR:'Portogallo',BEL:'Belgio'}},
 en:{title:'World history',subtitle:'Archived results of fictional competitions',preview:'WRD05 module: kit data, not official results in your career.',season:'Season',country:'League',winner:'Champion',scorer:'Top scorer',palmares:'Honours',record:'Season records',rivalries:'Rivalries',identities:'Club identity',standing:'Final table',club:'Club',played:'P',points:'Pts',goals:'GF',against:'GA',history:'Timeline',noArchive:'No completed seasons have been archived yet.',noLeague:'Protected legacy league: history unavailable.',noRecord:'No verified historical statistics.',noScorers:'No recorded scorers',noRivalries:'No recorded rivalries.',fictional:'Fictional club profile',city:'City',founded:'Fictional foundation',reputation:'Estimated reputation',cityDerby:'City derby',sporting:'Sporting rivalry',meetings:'Recorded meetings',wins:'Wins',draws:'Draws',source:'Data comes from recorded matches. Unsimulated cups, promotions and awards are not invented.',values:{points:'Points',wins:'Wins',goals:'Goals for',defence:'Fewest conceded',goal_difference:'Goal difference',top_scorer:'Top scorer goals'},countries:{IT:'Italy',ENG:'England',ESP:'Spain',GER:'Germany',FRA:'France',NED:'Netherlands',POR:'Portugal',BEL:'Belgium'}}
};
export const LANGUAGES=Object.freeze(['it','en']);
export const EXTRA_MESSAGES=Object.freeze({
 it:{
  'app.language':'Lingua','app.reset':'Ripristina','app.preview':'Anteprima autonoma · non modifica la carriera',
  'app.history':'Storia','app.world':'Mondo','app.notifications':'Notifiche','app.currency':'Valute',
  'app.player':'Calciatore','app.country':'Nazione','app.balance':'Bilancio','app.open':'Apri',
  'event.personality.weekly':'Dinamiche spogliatoio: {player}, variazione morale {change} punti.',
  'mail.subject.personality.weekly':'Spogliatoio',
  'event.board.update':'Valutazione dirigenza: fiducia {trust}/100, stato {status}; motivo: {reason}.',
  'mail.subject.board.update':'Comunicazione dirigenza',
  'event.finance.alert':'Avviso finanziario: {type}. Importo indicativo {amountEUR} EUR.',
  'mail.subject.finance.alert':'Allerta finanziaria',
  'event.facilities.completed':'Struttura completata: {type}, livello {level}.',
  'mail.subject.facilities.completed':'Struttura completata',
  'event.facilities.payroll':'Compensi staff da saldare: {amountEUR} EUR.',
  'mail.subject.facilities.payroll':'Compensi staff',
  'finance.alert.insolvency_risk':'rischio liquidità insufficiente',
  'finance.alert.wage_cap':'superamento tetto ingaggi',
  'finance.alert.forecast':'previsione negativa',
  'board.status.active':'in carica','board.status.dismissed':'esonerato','board.status.retired':'ritirato',
  'board.reason.appointment':'nomina',  'board.reason.win':'vittoria',  'board.reason.draw':'pareggio',  'board.reason.loss':'sconfitta',  'board.reason.cautious':'obiettivi prudenti',  'board.reason.balanced':'obiettivi equilibrati',  'board.reason.ambitious':'obiettivi ambiziosi',  'board.reason.low_confidence':'fiducia bassa',  'board.reason.contract_review':'revisione contrattuale',  'board.reason.persistent_underperformance':'risultati insufficienti',  'board.reason.season_review':'valutazione stagionale',  'board.reason.annual_assessment':'valutazione annuale',  'board.reason.renewal':'rinnovo',  'board.reason.contract_extended':'contratto esteso',  'board.reason.new_club':'nuovo club',  'board.reason.new_season':'nuova stagione',
  'history.cup.missing':'La coppa non è stata simulata. Nessun titolo registrato.',
  'event.match.final':'{home}–{away}: risultato finale {homeGoals}–{awayGoals}.',
  'event.match.official':'Giornata {round}: {home} {homeGoals}–{awayGoals} {away}. {outcome}',
  'event.season.new':'Stagione {season}: conclusa la precedente al {position} posto, con {prize} in premi e nuovi fondi.',
  'event.youth.turnover':'Ricambio generazionale: {retirements} e {promotions} nuovi. Il vivaio continua a produrre prospetti.',
  'event.training.progress':'Progressi tecnici rilevati: {players}. Il lavoro sul campo inizia a dare risultati.',
  'event.welcome':'La dirigenza di {club} ti ha affidato la prima squadra nella competizione {league}.',
  'event.calendar.start':'Il campionato comprende {clubs} club e {rounds} giornate. La prima sfida sarà contro {opponent}.',
  'mail.subject.match.official':'Risultato ufficiale',
  'mail.subject.season.new':'Nuova stagione',
  'mail.subject.youth.turnover':'Ricambio generazionale',
  'mail.subject.training.progress':'Rapporto allenamento',
  'mail.subject.welcome':'Benvenuto sulla panchina',
  'mail.subject.calendar.start':'Calendario di campionato',
  'mail.subject.transfer.completed':'Trasferimento ufficiale',
  'mail.subject.transfer.booked':'Trasferimento prenotato',
  'mail.subject.transfer.window_closing':'Chiusura del mercato',
  'mail.subject.transfer.free_agent':'Svincolato ingaggiato',
  'mail.subject.transfer.released':'Calciatore svincolato',
  'mail.subject.injury.reported':'Situazione infermeria',
  'mail.subject.match.final':'Risultato finale',
  'mail.subject.season.champion':'Campione',
  'mail.subject.contract.renewed':'Rinnovo contratto',
  'mail.subject.contract.enabled':'Gestione contratti',
  'mail.subject.contract.expired':'Contratto in scadenza',
  'mail.subject.contract.promise':'Ruolo promesso',
  'mail.subject.youth.promoted':'Promozione dal vivaio',
  'mail.subject.scouting.updated':'Aggiornamento osservatori',
  'mail.subject.continental.winner':'Campione continentale',
  'mail.subject.divisions.changes':'Promozioni e retrocessioni',
  'event.continental.winner':'{club} ha conquistato la Coppa delle Costellazioni nella stagione {season}.',
  'event.divisions.changes':'Stagione {season}: promozioni, retrocessioni e playoff registrati negli otto Paesi.',
  'mail.subject.cup.winner':'Vincitrice della coppa',
  'event.cup.winner':'La squadra {club} ha vinto la coppa nazionale di {country} nella stagione {season}.',
  'time.retirement.one':'ritiro','time.retirement.many':'ritiri',
  'time.player.one':'giocatore','time.player.many':'giocatori',
  'mail.outcome.win':'La squadra ha conquistato tre punti.',
  'mail.outcome.draw':'Un punto aggiunto alla classifica.',
  'mail.outcome.loss':'Ora il gruppo deve reagire.',
  'event.season.champion':'{club} ha vinto il campionato {league} nella stagione {season}.',
  'event.contract.renewed':'{player}: contratto rinnovato fino alla stagione {until}.',
  'event.contract.enabled':'Contratti strutturati attivati nella carriera.',
  'event.contract.expired':'{player}: scadenza contrattuale, verifica il rinnovo.',
  'event.contract.promise':'{player}: verifica del ruolo promesso.',
  'event.youth.promoted':'{player} è stato promosso in prima squadra ({club}).',
  'event.transfer.completed':'{player}: trasferimento da {from} a {to} per {amount}.',
  'event.transfer.booked':'{player}: trasferimento a {to} prenotato per il giorno {day}.',
  'event.transfer.window_closing':'La finestra di mercato di {country} è terminata al giorno {day}.',
  'event.transfer.free_agent':'{player}: contratto da svincolato registrato con {to}.',
  'event.transfer.released':'{player}: contratto concluso consensualmente con {from}.',
  'event.scouting.updated':'Nuovo rapporto disponibile per {club}.',
  'event.injury.reported':'{player} è indisponibile per {days} {daysLabel}.',
  'time.day.one':'giorno','time.day.many':'giorni','time.match.one':'partita','time.match.many':'partite',
  'currency.policy':'Tassi interni fissi · versione {version}',
  'currency.base':'Importo canonico in EUR','currency.converted':'Visualizzazione in {code}',
  'notifications.legacy':'Notifica storica: testo originale non ritraducibile',
  'table.wins':'V','table.draws':'N','table.losses':'P','table.record':'Record',
 },
 en:{
  'app.language':'Language','app.reset':'Reset','app.preview':'Standalone preview · does not change the career',
  'app.history':'History','app.world':'World','app.notifications':'Notifications','app.currency':'Currencies',
  'app.player':'Player','app.country':'Country','app.balance':'Balance','app.open':'Open',
  'event.personality.weekly':'Dressing-room dynamics: {player}, morale change {change} points.',
  'mail.subject.personality.weekly':'Dressing room',
  'event.board.update':'Board assessment: confidence {trust}/100, status {status}; reason: {reason}.',
  'mail.subject.board.update':'Board communication',
  'event.finance.alert':'Financial warning: {type}. Estimated amount {amountEUR} EUR.',
  'mail.subject.finance.alert':'Financial alert',
  'event.facilities.completed':'Facility completed: {type}, level {level}.',
  'mail.subject.facilities.completed':'Facility completed',
  'event.facilities.payroll':'Unpaid staff wages: {amountEUR} EUR.',
  'mail.subject.facilities.payroll':'Staff wages',
  'finance.alert.insolvency_risk':'cash shortfall risk',
  'finance.alert.wage_cap':'wage budget exceeded',
  'finance.alert.forecast':'negative cash forecast',
  'board.status.active':'active','board.status.dismissed':'dismissed','board.status.retired':'retired',
  'board.reason.appointment':'appointment',  'board.reason.win':'win',  'board.reason.draw':'draw',  'board.reason.loss':'loss',  'board.reason.cautious':'cautious objectives',  'board.reason.balanced':'balanced objectives',  'board.reason.ambitious':'ambitious objectives',  'board.reason.low_confidence':'low confidence',  'board.reason.contract_review':'contract review',  'board.reason.persistent_underperformance':'persistent underperformance',  'board.reason.season_review':'season review',  'board.reason.annual_assessment':'annual assessment',  'board.reason.renewal':'renewal',  'board.reason.contract_extended':'contract extension',  'board.reason.new_club':'new club',  'board.reason.new_season':'new season',
  'history.cup.missing':'The cup has not been simulated. No title recorded.',
  'event.match.final':'{home}–{away}: full-time score {homeGoals}–{awayGoals}.',
  'event.match.official':'Matchday {round}: {home} {homeGoals}–{awayGoals} {away}. {outcome}',
  'event.season.new':'Season {season}: you finished the previous one in {position} place, with {prize} in prize money and new funds.',
  'event.youth.turnover':'Squad renewal: {retirements} and {promotions} recruited or promoted. The academy keeps producing prospects.',
  'event.training.progress':'Technical improvements recorded: {players}. The work on the training pitch is paying off.',
  'event.welcome':'The board of {club} has put you in charge of the first team in {league}.',
  'event.calendar.start':'The league has {clubs} clubs and {rounds} matchdays. Your first opponent is {opponent}.',
  'mail.subject.match.official':'Official result',
  'mail.subject.season.new':'New season',
  'mail.subject.youth.turnover':'Squad renewal',
  'mail.subject.training.progress':'Training report',
  'mail.subject.welcome':'Welcome to the dugout',
  'mail.subject.calendar.start':'League calendar',
  'mail.subject.transfer.completed':'Official transfer',
  'mail.subject.transfer.booked':'Transfer booking',
  'mail.subject.transfer.window_closing':'Transfer window closing',
  'mail.subject.transfer.free_agent':'Free agent signed',
  'mail.subject.transfer.released':'Player released',
  'mail.subject.injury.reported':'Injury report',
  'mail.subject.match.final':'Full-time result',
  'mail.subject.season.champion':'League champions',
  'mail.subject.contract.renewed':'Contract extension',
  'mail.subject.contract.enabled':'Contract management',
  'mail.subject.contract.expired':'Contract expiring',
  'mail.subject.contract.promise':'Promised playing time',
  'mail.subject.youth.promoted':'Academy promotion',
  'mail.subject.scouting.updated':'Scouting update',
  'mail.subject.continental.winner':'Continental cup champions',
  'mail.subject.divisions.changes':'Promotion and relegation',
  'event.continental.winner':'{club} won the Constellations Cup in season {season}.',
  'event.divisions.changes':'Season {season}: promotion, relegation and playoffs recorded across eight countries.',
  'mail.subject.cup.winner':'National cup winner',
  'event.cup.winner':'Club {club} won the {country} national cup in season {season}.',
  'time.retirement.one':'retirement','time.retirement.many':'retirements',
  'time.player.one':'player','time.player.many':'players',
  'mail.outcome.win':'Your team earned three points.',
  'mail.outcome.draw':'One point added to the table.',
  'mail.outcome.loss':'The team needs to bounce back.',
  'event.season.champion':'{club} won the {league} in season {season}.',
  'event.contract.renewed':'{player}: contract renewed until season {until}.',
  'event.contract.enabled':'Structured contracts enabled for this career.',
  'event.contract.expired':'{player}: contract expiring, review renewal.',
  'event.contract.promise':'{player}: promised playing time review.',
  'event.youth.promoted':'{player} was promoted to the first team ({club}).',
  'event.transfer.completed':'{player}: transfer from {from} to {to} for {amount}.',
  'event.transfer.booked':'{player}: transfer to {to} booked for day {day}.',
  'event.transfer.window_closing':'The transfer window in {country} ended on day {day}.',
  'event.transfer.free_agent':'{player}: registered as a free agent at {to}.',
  'event.transfer.released':'{player}: contract mutually terminated with {from}.',
  'event.scouting.updated':'A new scouting report is available for {club}.',
  'event.injury.reported':'{player} is unavailable for {days} {daysLabel}.',
  'time.day.one':'day','time.day.many':'days','time.match.one':'match','time.match.many':'matches',
  'currency.policy':'Fixed internal rates · version {version}',
  'currency.base':'Canonical amount in EUR','currency.converted':'Display in {code}',
  'notifications.legacy':'Historical notification: original text cannot be retranslated',
  'table.wins':'W','table.draws':'D','table.losses':'L','table.record':'Record',
 }
});
const plainObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const keyPattern=/^[a-zA-Z0-9_.-]+$/;
const reserved=new Set(['__proto__','prototype','constructor']);
const placeholders=text=>new Set([...text.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map(x=>x[1]));
export function normalizeLanguage(lang){
 if(typeof lang!=='string'||!lang.trim())throw Error('QOL02_LANGUAGE');
 const key=lang.toLowerCase().replace('_','-').split('-')[0];
 if(!LANGUAGES.includes(key))throw Error('QOL02_LANGUAGE');
 return key;
}
function flatten(value,prefix='',out={}){
 if(!plainObject(value))throw Error('QOL02_CATALOG_STRUCTURE');
 for(const [key,item] of Object.entries(value)){
  if(!keyPattern.test(key)||reserved.has(key))throw Error('QOL02_CATALOG_KEY');
  const name=prefix?`${prefix}.${key}`:key;
  if(typeof item==='string')out[name]=item;
  else flatten(item,name,out);
 }
 return out;
}

export const contractLabels=Object.freeze({
 it:{title:'Contratti',balance:'Disponibilità',wages:'Monte ingaggi',expiry:'Scadenze',free:'Svincolati',player:'Calciatore',role:'Ruolo promesso',end:'Fine contratto',salary:'Ingaggio annuo',status:'Trattative',none:'Nessun elemento',offer:'Offerta',counter:'Controproposta',accept:'Accettata',reject:'Rifiutata',awaiting:'In attesa',promise:'Promessa',sample:'Campione insufficiente',met:'Rispettata',broken:'Non rispettata',captain:'Leadership',notice:'Demo locale: non modifica la carriera.'},
 en:{title:'Contracts',balance:'Cash balance',wages:'Wage bill',expiry:'Expiring contracts',free:'Free agents',player:'Player',role:'Promised role',end:'Contract end',salary:'Annual wage',status:'Negotiations',none:'No entries',offer:'Offer',counter:'Counteroffer',accept:'Accepted',reject:'Rejected',awaiting:'Pending',promise:'Promise',sample:'Not enough matches',met:'Fulfilled',broken:'Unfulfilled',captain:'Leadership',notice:'Local demo: does not modify your career.'}
});

export const negotiationStatusLabels={it:{awaiting_player:'In attesa del calciatore',awaiting_club:'In attesa del club',accepted:'Accettata',rejected:'Rifiutata',expired:'Scaduta'},en:{awaiting_player:'Awaiting player',awaiting_club:'Awaiting club',accepted:'Accepted',rejected:'Rejected',expired:'Expired'}};

export const promisedRoleLabels={it:{starter:'Titolare',rotation:'Rotazione',prospect:'Giovane',leader:'Leader'},en:{starter:'Starter',rotation:'Rotation',prospect:'Prospect',leader:'Leader'}};

export const marketLabels=Object.freeze({
 it:{title:'Calciomercato',subtitle:'Offerte e trattative tra gli otto campionati',preview:'Anteprima MKT01: non modifica la carriera ufficiale.',buyer:'Acquirente',seller:'Venditore',player:'Calciatore',fee:'Indennizzo',bonus:'Bonus',salary:'Ingaggio annuo',balance:'Disponibilità',wageBill:'Monte ingaggi',contract:'Accordo personale',status:'Stato',value:'Valutazione',asking:'Prezzo richiesto',availability:'Disponibilità del club',desiredWage:'Ingaggio richiesto',type:'Formula',transfer:'Definitivo',loan:'Prestito',loanShare:'Quota stipendio',loanEnd:'Fine prestito',installments:'Rate',release:'Clausola di uscita',due:'Scadenza',offers:'Trattative',events:'Cronologia',noDeals:'Nessuna trattativa',roster:'Rosa',total:'Totale',accounting:'Movimenti',baseAmount:'Importo canonico in EUR',ready:'Pronto alla conclusione',done:'Concluso',rejected:'Rifiutata',reset:'Ripristina',step:'Avanza trattativa',language:'Lingua',country:'Nazione',export:'Esporta JSON',none:'—',role:'Ruolo promesso',season:'Stagione',day:'Giorno',phase:'Fase',clubAccepted:'Accordo tra club',playerAccepted:'Accordo col calciatore',loanNote:'Proprietà del contratto conservata dal club d’origine',decision:'Decisione',readOnly:'Demo guidata: gli stati sono generati dal motore reale del kit.',notAvailable:'Non in vendita',negotiable:'Trattabile',open:'Disponibile',revision:'Revisione',fx:'Cambio interno fisso',actors:{buyer:'Acquirente',seller:'Venditore',player:'Calciatore',system:'Sistema'},actions:{club_offer:'Offerta iniziale',club_counter:'Controproposta club',club_agreed:'Accordo tra club',personal_offer:'Offerta contrattuale',personal_counter:'Controproposta personale',personal_agreed:'Accordo personale',rejected:'Rifiuto',personal_rejected:'Rifiuto del giocatore',completed:'Operazione conclusa',expired:'Scadenza'},statuses:{awaiting_seller:'In attesa del venditore',awaiting_buyer:'In attesa dell’acquirente',club_agreed:'Club d’accordo',awaiting_player:'In attesa del calciatore',player_counter:'Controproposta personale',ready:'Pronta',rejected:'Rifiutata',expired:'Scaduta',completed:'Completata'}},
 en:{title:'Transfer market',subtitle:'Offers and negotiations across eight leagues',preview:'MKT01 preview: the official career is unchanged.',buyer:'Buying club',seller:'Selling club',player:'Player',fee:'Transfer fee',bonus:'Bonus',salary:'Annual wage',balance:'Cash balance',wageBill:'Wage bill',contract:'Personal agreement',status:'Status',value:'Valuation',asking:'Asking price',availability:'Club availability',desiredWage:'Desired wage',type:'Type',transfer:'Permanent',loan:'Loan',loanShare:'Salary share',loanEnd:'Loan end',installments:'Instalments',release:'Release clause',due:'Deadline',offers:'Negotiations',events:'Timeline',noDeals:'No negotiations',roster:'Squad',total:'Total',accounting:'Movements',baseAmount:'Canonical amount in EUR',ready:'Ready to finalise',done:'Completed',rejected:'Rejected',reset:'Reset',step:'Advance negotiation',language:'Language',country:'Country',export:'Export JSON',none:'—',role:'Promised role',season:'Season',day:'Day',phase:'Phase',clubAccepted:'Clubs agreed',playerAccepted:'Player agreed',loanNote:'Original club retains contract ownership',decision:'Decision',readOnly:'Guided demo: states are generated by the actual kit engine.',notAvailable:'Not for sale',negotiable:'Negotiable',open:'Available',revision:'Revision',fx:'Fixed internal exchange rate',actors:{buyer:'Buyer',seller:'Seller',player:'Player',system:'System'},actions:{club_offer:'Initial offer',club_counter:'Club counteroffer',club_agreed:'Clubs agree',personal_offer:'Contract offer',personal_counter:'Personal counteroffer',personal_agreed:'Personal terms agreed',rejected:'Rejected',personal_rejected:'Player rejected',completed:'Deal completed',expired:'Expired'},statuses:{awaiting_seller:'Awaiting selling club',awaiting_buyer:'Awaiting buying club',club_agreed:'Clubs agreed',awaiting_player:'Awaiting player',player_counter:'Personal counteroffer',ready:'Ready',rejected:'Rejected',expired:'Expired',completed:'Completed'}}
});

export const TRANSLATIONS=Object.freeze(Object.fromEntries(LANGUAGES.map(lang=>[
 lang,Object.freeze({...flatten(worldLabels[lang],'world'),...flatten(historyLabels[lang],'history'),...flatten(contractLabels[lang],'contract'),...flatten(marketLabels[lang],'market'),...flatten(negotiationStatusLabels[lang],'negotiation.status'),...flatten(promisedRoleLabels[lang],'contract.role'),...EXTRA_MESSAGES[lang]})
])));
export function auditCatalog(catalog=TRANSLATIONS){
 if(!plainObject(catalog)||!LANGUAGES.every(lang=>plainObject(catalog[lang])))throw Error('QOL02_CATALOG_STRUCTURE');
 const all=[...new Set(LANGUAGES.flatMap(lang=>Object.keys(catalog[lang])))].sort(),issues=[];
 for(const name of all){
  let base;
  for(const lang of LANGUAGES){
   const value=catalog[lang][name];
   if(typeof value!=='string'||!value.trim()){issues.push(`${lang}:${name}:MISSING`);continue;}
   if(/\{[^{}]*\}/.test(value.replace(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g,'')))issues.push(`${lang}:${name}:INVALID_PLACEHOLDER`);
   const vars=[...placeholders(value)].sort().join(',');
   if(base!==undefined&&vars!==base)issues.push(`${lang}:${name}:PLACEHOLDER_MISMATCH`);
   base=vars;
  }
 }
 return {ok:issues.length===0,keys:all.length,issues};
}
export function t(key,params={},lang='it'){
 lang=normalizeLanguage(lang);
 if(typeof key!=='string'||!keyPattern.test(key)||reserved.has(key)||!Object.hasOwn(TRANSLATIONS[lang],key))throw Error('QOL02_MISSING_KEY');
 if(!plainObject(params))throw Error('QOL02_PARAMS');
 const template=TRANSLATIONS[lang][key],expected=placeholders(template);
 for(const name of expected)if(!Object.hasOwn(params,name))throw Error('QOL02_MISSING_PARAM');
 for(const name of Object.keys(params))if(!expected.has(name))throw Error('QOL02_UNKNOWN_PARAM');
 return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,(_,name)=>{
  const value=params[name];if(!['string','number','boolean'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value)||String(value).length>300)throw Error('QOL02_PARAM_VALUE');return String(value);
 });
}
export function formatNumber(value,{lang='it',minimumFractionDigits=0,maximumFractionDigits=minimumFractionDigits}={}){
 lang=normalizeLanguage(lang);
 if(typeof value!=='number'||!Number.isFinite(value)||!Number.isInteger(minimumFractionDigits)||!Number.isInteger(maximumFractionDigits)||minimumFractionDigits<0||maximumFractionDigits>8||maximumFractionDigits<minimumFractionDigits)throw Error('QOL02_NUMBER');
 return new Intl.NumberFormat(lang==='it'?'it-IT':'en-GB',{minimumFractionDigits,maximumFractionDigits}).format(value);
}
export function formatDate(isoDate,{lang='it',dateStyle='medium'}={}){
 lang=normalizeLanguage(lang);
 if(typeof isoDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(isoDate))throw Error('QOL02_DATE');
 const date=new Date(`${isoDate}T12:00:00.000Z`);
 if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==isoDate||!['short','medium','long','full'].includes(dateStyle))throw Error('QOL02_DATE');
 return new Intl.DateTimeFormat(lang==='it'?'it-IT':'en-GB',{dateStyle,timeZone:'UTC'}).format(date);
}
export function plural(count,noun,{lang='it'}={}){
 lang=normalizeLanguage(lang);
 if(!Number.isSafeInteger(count)||count<0||!['day','match','retirement','player'].includes(noun))throw Error('QOL02_PLURAL');
 const category=new Intl.PluralRules(lang==='it'?'it-IT':'en-GB').select(count);
 const form=category==='one'?'one':'many';
 return `${formatNumber(count,{lang})} ${t(`time.${noun}.${form}`,{},lang)}`;
}
export function formatStanding(place,{lang='it'}={}){
 lang=normalizeLanguage(lang);
 if(!Number.isSafeInteger(place)||place<1||place>100000)throw Error('QOL02_RANK');
 return lang==='it'?`${formatNumber(place,{lang})}º`:`${formatNumber(place,{lang})}${place%100>=11&&place%100<=13?'th':({1:'st',2:'nd',3:'rd'}[place%10]??'th')}`;
}
// The locale is a UI/session preference. No writes to a World/Save object are performed.
export function createLocaleSession({lang='it',world,view='history',country,season,clubId}={}){
 lang=normalizeLanguage(lang);
 if(!['world','history'].includes(view))throw Error('QOL02_VIEW');
 let selected={lang,view,country,season,clubId};
 return Object.freeze({
  snapshot:()=>structuredClone(selected),
  switchLanguage:next=>{selected={...selected,lang:normalizeLanguage(next)};return structuredClone(selected);},
  select:updates=>{
   if(!plainObject(updates)||Object.keys(updates).some(k=>!['view','country','season','clubId'].includes(k)))throw Error('QOL02_SELECTION');
   if(updates.view!==undefined&&!['world','history'].includes(updates.view))throw Error('QOL02_VIEW');
   selected={...selected,...updates};return structuredClone(selected);
  },
  world:()=>world,
 });
}
