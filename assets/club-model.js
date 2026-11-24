/* CLUB-01: pure presentation shared by generation tests and the browser. */
((root,factory)=>{
 const routes=typeof module!=='undefined'&&module.exports&&typeof require==='function'?require('./routes-registry.js'):root.faRoutesRegistry;
 const model=factory(routes);root.faClubModel=model;
 if(typeof module!=='undefined'&&module.exports)module.exports=model;
})(typeof window!=='undefined'?window:globalThis,(routes)=>{
 'use strict';
 // Classic-script companion to public-image-urls.mjs; only immutable published domestic IDs.
 const domesticLogoUrl=id=>typeof id==='string'&&/^(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$/.test(id)
  ?'/assets/competitions/'+id+'/compact.svg':null;
 const compactPlayerName=full=>{const m=/^(\S+)\s+(.+)$/u.exec(String(full||'').trim());return m&&!/^\p{L}\.$/u.test(m[1])?Array.from(m[1])[0]+'. '+m[2]:String(full||'').trim()};
 const marketUI=typeof module!=='undefined'&&module.exports&&typeof require==='function'?require('./market-value-format.js'):globalThis.faMarketValue;
 const fixtureUI=typeof module!=='undefined'&&module.exports&&typeof require==='function'?require('./club-fixtures.js'):globalThis.faClubFixtures;
 const recordsUI=typeof module!=='undefined'&&module.exports&&typeof require==='function'?require('./club-records.js'):globalThis.faClubRecords;
 const views=['overview','roster','fixtures','records','history'];
 const rosterFlags=Object.freeze({
  ESP:'es',ARG:'ar',FRA:'fr',ENG:'gb-eng',POR:'pt',BRA:'br',MAR:'ma',BEL:'be',NED:'nl',MEX:'mx',
  COL:'co',SUI:'ch',GER:'de',CRO:'hr',ITA:'it',USA:'us',JPN:'jp',SEN:'sn',NOR:'no',URU:'uy',
  DEN:'dk',AUT:'at',IRN:'ir',ECU:'ec',EGY:'eg',AUS:'au',CAN:'ca',ALG:'dz',CIV:'ci',NGA:'ng',
  TUR:'tr',KOR:'kr',PAR:'py',SWE:'se',RUS:'ru',UKR:'ua',POL:'pl',HUN:'hu',WAL:'gb-wls',COD:'cd',
  GRE:'gr',CMR:'cm',SCO:'gb-sct',SRB:'rs',SVK:'sk',PAN:'pa',MLI:'ml',RSA:'za',VEN:'ve',CHI:'cl'
 });
 const keys=['overview','roster','fixtures','records','history','identity','profile','competition','primaryName','fullName','compactName','abbr','nickname','city','country','primaryColor','secondaryColor','stadium','division','provisional','outside','emptyRoster','emptyFixtures','emptyRecords','emptyHistory','navigation','crest','error','skip'];
 const rows={
  en:['Overview','Roster','Fixtures','Records','History','Club identity','Club profile','Competitions','Primary name','Full name','Compact name','Abbreviation','Nickname','City','Country','Primary color','Secondary color','Stadium','Division','Provisional allocation · no active season','Outside the current playing structure','No roster is available.','No fixtures are available.','No club records are available.','No club history is available.','Club pages','Club crest','Club information is unavailable. Please reload the page.','Skip to content'],
  de:['Übersicht','Kader','Spielplan','Rekorde','Historie','Vereinsidentität','Vereinsprofil','Wettbewerbe','Hauptname','Vollständiger Name','Kurzname','Kürzel','Spitzname','Stadt','Land','Primärfarbe','Sekundärfarbe','Stadion','Liga','Vorläufige Zuordnung · keine aktive Saison','Außerhalb der aktuellen Spielstruktur','Kein Kader verfügbar.','Kein Spielplan verfügbar.','Keine Vereinsrekorde verfügbar.','Keine Vereinshistorie verfügbar.','Vereinsseiten','Vereinswappen','Vereinsinformationen sind nicht verfügbar. Bitte lade die Seite erneut.','Zum Inhalt springen'],
  es:['Resumen','Plantilla','Partidos','Récords','Historial','Identidad del club','Perfil del club','Competiciones','Nombre principal','Nombre completo','Nombre corto','Abreviatura','Apodo','Ciudad','País','Color primario','Color secundario','Estadio','División','Asignación provisional · sin temporada activa','Fuera de la estructura de juego actual','No hay plantilla disponible.','No hay partidos disponibles.','No hay récords del club disponibles.','No hay historial del club disponible.','Páginas del club','Escudo del club','La información del club no está disponible. Recarga la página.','Saltar al contenido'],
  fr:['Présentation','Effectif','Matchs','Records','Historique','Identité du club','Profil du club','Compétitions','Nom principal','Nom complet','Nom court','Abréviation','Surnom','Ville','Pays','Couleur principale','Couleur secondaire','Stade','Division','Affectation provisoire · aucune saison active','Hors de la structure de jeu actuelle','Aucun effectif disponible.','Aucun match disponible.','Aucun record du club disponible.','Aucun historique du club disponible.','Pages du club','Écusson du club','Les informations du club sont indisponibles. Rechargez la page.','Aller au contenu'],
  it:['Panoramica','Rosa','Partite','Record','Storia','Identità del club','Profilo del club','Competizioni','Nome principale','Nome completo','Nome breve','Abbreviazione','Soprannome','Città','Paese','Colore primario','Colore secondario','Stadio','Divisione','Assegnazione provvisoria · nessuna stagione attiva','Fuori dalla struttura di gioco corrente','Nessuna rosa disponibile.','Nessuna partita disponibile.','Nessun record del club disponibile.','Nessuna storia del club disponibile.','Pagine del club','Stemma del club','Le informazioni del club non sono disponibili. Ricarica la pagina.','Vai al contenuto']
 };
 const copies=Object.fromEntries(Object.entries(rows).map(([lang,row])=>[lang,Object.fromEntries(keys.map((key,i)=>[key,row[i]]))]));
 const extraLabels={"en":["Name","Colors","Description","Rivalries","Kits","Kits not yet available","Translate","Show original","Tier","First division","Second division","No rivalries recorded"],"de":["Name","Farben","Beschreibung","Rivalitäten","Trikots","Noch keine Trikots verfügbar","Übersetzen","Original anzeigen","Spielklasse","Erste Liga","Zweite Liga","Keine Rivalitäten eingetragen"],"es":["Nombre","Colores","Descripción","Rivalidades","Equipaciones","Equipaciones aún no disponibles","Traducir","Mostrar original","Categoría","Primera división","Segunda división","Sin rivalidades registradas"],"fr":["Nom","Couleurs","Description","Rivalités","Maillots","Maillots pas encore disponibles","Traduire","Afficher l’original","Niveau","Première division","Deuxième division","Aucune rivalité répertoriée"],"it":["Nome","Colori","Descrizione","Rivalità","Divise","Divise non ancora disponibili","Traduci","Mostra originale","Livello","Prima divisione","Seconda divisione","Nessuna rivalità registrata"]};
 for(const [locale,values] of Object.entries(extraLabels))for(let i=0;i<values.length;i++)copies[locale][["nameLabel","colorsLabel","descriptionLabel","rivalriesLabel","kitsLabel","kitsPending","translateLabel","originalLabel","tierLabel","tier1Label","tier2Label","noRivalries"][i]]=values[i];
 const summaryLabels={
  en:['Status','Next match','No scheduled match available.','No upcoming match.','Season','Matchday','Playoffs','Playout','Preview'],
  de:['Status','Nächstes Spiel','Kein angesetztes Spiel verfügbar.','Kein weiteres Spiel.','Saison','Spieltag','Playoffs','Relegation','Vorschau'],
  es:['Estado','Próximo partido','No hay partidos programados.','No hay próximos partidos.','Temporada','Jornada','Playoffs','Promoción','Vista previa'],
  fr:['Statut','Prochain match','Aucun match programmé.','Aucun match à venir.','Saison','Journée','Barrages de promotion','Barrages de maintien','Aperçu'],
  it:['Stato','Prossima partita','Nessuna partita programmata disponibile.','Nessuna prossima partita.','Stagione','Giornata','Playoff','Playout','Anteprima']
 };
 for(const [lang,values] of Object.entries(summaryLabels))values.forEach((value,i)=>copies[lang][['statusLabel','nextMatchLabel','noScheduledMatch','noUpcomingMatch','seasonLabel','matchdayLabel','playoffsLabel','playoutLabel','previewLabel'][i]]=value);
 const competitionAvailability={
  en:['Competition information is temporarily unavailable. Please reload the page.','Competition data has not yet been published for this season.'],
  de:['Wettbewerbsinformationen sind vorübergehend nicht verfügbar. Bitte lade die Seite erneut.','Für diese Saison wurden noch keine Wettbewerbsdaten veröffentlicht.'],
  es:['La información de las competiciones no está disponible temporalmente. Recarga la página.','Todavía no se han publicado datos de competiciones para esta temporada.'],
  fr:['Les informations sur les compétitions sont temporairement indisponibles. Rechargez la page.','Les données des compétitions ne sont pas encore publiées pour cette saison.'],
  it:['Le informazioni sulle competizioni sono temporaneamente non disponibili. Ricarica la pagina.','I dati delle competizioni non sono ancora stati pubblicati per questa stagione.']
 };
 for(const [lang,values] of Object.entries(competitionAvailability)){
  copies[lang].competitionUnavailable=values[0];
  copies[lang].competitionUnpublished=values[1];
 }
 const noActiveCompetitionLabels={
  en:'No active competitions.',
  de:'Keine aktiven Wettbewerbe.',
  es:'No hay competiciones activas.',
  fr:'Aucune compétition active.',
  it:'Nessuna competizione attiva.'
 };
 for(const [lang,label] of Object.entries(noActiveCompetitionLabels))copies[lang].noActiveCompetitions=label;
 const internationalCategoryLabels={en:'International',de:'International',es:'Internacional',fr:'International',it:'Internazionale'};
 for(const [lang,label] of Object.entries(internationalCategoryLabels))copies[lang].internationalLabel=label;
 const internationalStatusLabels={
  en:{groupStage:'Group Stage',playoffs:'Playoffs',quarterfinals:'Quarter-finals',semifinals:'Semi-finals',final:'Final',winner:'Winner',runnerUp:'Runner-up'},
  de:{groupStage:'Gruppenphase',playoffs:'Playoffs',quarterfinals:'Viertelfinale',semifinals:'Halbfinale',final:'Finale',winner:'Sieger',runnerUp:'Zweiter'},
  es:{groupStage:'Fase de grupos',playoffs:'Playoffs',quarterfinals:'Cuartos de final',semifinals:'Semifinales',final:'Final',winner:'Campeón',runnerUp:'Subcampeón'},
  fr:{groupStage:'Phase de groupes',playoffs:'Barrages',quarterfinals:'Quarts de finale',semifinals:'Demi-finales',final:'Finale',winner:'Vainqueur',runnerUp:'Finaliste'},
  it:{groupStage:'Fase a gironi',playoffs:'Playoff',quarterfinals:'Quarti di finale',semifinals:'Semifinali',final:'Finale',winner:'Vincitore',runnerUp:'Finalista'}
 };
 function ordinal(position,lang){
  if(!Number.isInteger(position)||position<1||position>24)return '—';
  if(lang==='en'){const suffix=position%100>=11&&position%100<=13?'th':({1:'st',2:'nd',3:'rd'}[position%10]||'th');return position+suffix;}
  if(lang==='de')return position+'.';
  if(lang==='fr')return position===1?'1er':position+'e';
  return position+'º';
 }
 const countryNames={en:['Italy','England','Spain','Germany','France','Portugal','Netherlands','Brazil'],de:['Italien','England','Spanien','Deutschland','Frankreich','Portugal','Niederlande','Brasilien'],es:['Italia','Inglaterra','España','Alemania','Francia','Portugal','Países Bajos','Brasil'],fr:['Italie','Angleterre','Espagne','Allemagne','France','Portugal','Pays-Bas','Brésil'],it:['Italia','Inghilterra','Spagna','Germania','Francia','Portogallo','Paesi Bassi','Brasile']};
 const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function route(path){
  if(typeof path!=='string')throw new TypeError('Club path must be a string');
  const parsed=routes.parseRoute(path);
  if(parsed?.kind!=='club'||parsed.redirect)return null;
  const [, ,country,id]=parsed.base.split('/');
  return {countryId:country.toUpperCase(),clubId:Number(id),view:parsed.view,base:parsed.base};
 }
 const indexCache=new WeakMap();
 function getIndex(manifest){
  let index=indexCache.get(manifest);
  if(index)return index;
  const clubs=new Map(),divisions=new Map(),rivalries=new Map();
  for(const club of manifest.clubs)clubs.set(club.countryId+'-'+club.clubId,club);
  for(const division of manifest.divisions)divisions.set(division.id,division);
  for(const rivalry of manifest.rivalries||[])for(const id of [rivalry.clubAId,rivalry.clubBId]){
   if(!rivalries.has(id))rivalries.set(id,[]);
   rivalries.get(id).push(rivalry);
  }
  index={clubs,divisions,rivalries};
  indexCache.set(manifest,index);
  return index;
 }
 const rosterGroups=Object.freeze({
  technical:['passing','technique','dribbling','shooting','crossing','tackling','marking','heading'],
  mental:['vision','positioning','decisions','composure'],
  physical:['speed','strength','stamina','agility'],
  goalkeeping:['gk_reflexes','gk_handling','gk_positioning','gk_aerial']
 });
 const rosterAllAttributes=['speed','strength','stamina','agility','passing','technique','dribbling','shooting','crossing','tackling','marking','heading','vision','positioning','decisions','composure','gk_reflexes','gk_handling','gk_positioning','gk_aerial'];
 // Keep exactly the public /players primary-position rank (descending: GK to ST).
 const rosterPitchPositions=Object.freeze(['GK','RB','RWB','CB','LWB','LB','DM','RM','CM','LM','RW','AM','LW','ST']);
 const rosterPositionRank=new Map(rosterPitchPositions.map((code,index)=>[code,rosterPitchPositions.length-index]));
 const rosterSortCommon=Object.freeze(['nationality','name','positions']);
 const rosterSortInfo=Object.freeze(['nationality','name','positions','age','height','foot','market_value_arc']);
 function rosterStatValue(stats,key){
  // Unknown legacy awards cannot be inferred as zero; played-and-covered is zero.
  if(key==='mvpAwards'&&stats?.appearances>0)return stats.mvpAwards??
   (stats.mvpCoveredAppearances===stats.appearances?0:null);
  return stats?.[key];
 }
 function rosterSortValue(player,key){
  if(key==='positions')return rosterPositionRank.get(player.primary_position)??0;
  if(key==='name')return player.display_name;
  if(key==='nationality')return player.nationality;
  if(key==='age')return player.age;
  if(key==='height')return player.height_cm;
  if(key==='market_value_arc')return Number.isSafeInteger(player.market_value_arc)&&player.market_value_arc>=0?player.market_value_arc:null;
  if(key==='foot')return player.preferred_foot;
  return statKeys.includes(key)?rosterStatValue(player.stats,key):player.attributes?.[key];
 }
 function sortedRosterPlayers(players,key,order){
  const direction=order==='desc'?-1:1;
  return [...players].sort((a,b)=>{
   const x=rosterSortValue(a,key),y=rosterSortValue(b,key);
   if(x==null||y==null)return x==null&&y==null?a.id-b.id:x==null?1:-1;
   const comparison=typeof x==='number'&&typeof y==='number'?Math.sign(x-y):
    String(x).localeCompare(String(y),'en',{sensitivity:'base'});
   return comparison?direction*comparison:a.id-b.id;
  });
 }
 const rosterSortChevron='<svg class="app-players-sort-chevron" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 const rosterAttributeNames={
  en:'Speed|Strength|Stamina|Agility|Passing|Technique|Dribbling|Shooting|Crossing|Tackling|Marking|Heading|Vision|Positioning|Decisions|Composure|Reflexes|Handling|Positioning|Aerial',
  it:'Velocità|Forza|Resistenza|Agilità|Passaggio|Tecnica|Dribbling|Tiro|Cross|Contrasto|Marcatura|Colpo di testa|Visione|Posizionamento|Decisioni|Freddezza|Riflessi|Presa|Posizionamento|Uscite alte',
  de:'Tempo|Stärke|Ausdauer|Beweglichkeit|Passen|Technik|Dribbling|Schuss|Flanken|Zweikampf|Deckung|Kopfball|Übersicht|Stellungsspiel|Entscheidungen|Ruhe|Reflexe|Fangen|Stellungsspiel|Luftraum',
  es:'Velocidad|Fuerza|Resistencia|Agilidad|Pases|Técnica|Regate|Tiro|Centros|Entradas|Marcaje|Cabeceo|Visión|Colocación|Decisiones|Serenidad|Reflejos|Blocaje|Colocación|Juego aéreo',
  fr:'Vitesse|Force|Endurance|Agilité|Passes|Technique|Dribble|Tir|Centres|Tacles|Marquage|Jeu de tête|Vision|Placement|Décisions|Sang-froid|Réflexes|Prise de balle|Placement|Jeu aérien'
 };
 const rosterWords={
  en:{name:'Player',age:'Age',positions:'Positions',height:'Height',foot:'Foot',nationality:'Nationality',one:'player',many:'players',left:'Left',right:'Right',tabs:['Info','Stats'],groups:['Technical','Mental','Physical','Goalkeeper'],empty:'No players are currently assigned to this club.',unavailable:'The roster is temporarily unavailable.',missingApi:'Roster API is unavailable in this build. Restart the local development server from this branch.',loading:'Loading roster'},
  de:{name:'Spieler',age:'Alter',positions:'Positionen',height:'Größe',foot:'Fuß',nationality:'Nationalität',one:'Spieler',many:'Spieler',left:'Links',right:'Rechts',tabs:['Info','Statistiken'],groups:['Technisch','Mental','Physisch','Torwart'],empty:'Diesem Verein sind derzeit keine Spieler zugeordnet.',unavailable:'Der Kader ist vorübergehend nicht verfügbar.',missingApi:'Die Kader-API fehlt in diesem Build. Starte den lokalen Entwicklungsserver mit diesem Branch neu.',loading:'Kader wird geladen'},
  es:{name:'Jugador',age:'Edad',positions:'Posiciones',height:'Altura',foot:'Pie',nationality:'Nacionalidad',one:'jugador',many:'jugadores',left:'Izquierdo',right:'Derecho',tabs:['Info','Estadísticas'],groups:['Técnicos','Mentales','Físicos','Portero'],empty:'Actualmente no hay jugadores asignados a este club.',unavailable:'La plantilla no está disponible temporalmente.',missingApi:'La API de la plantilla no está disponible en esta versión. Reinicia el servidor local desde esta rama.',loading:'Cargando plantilla'},
  fr:{name:'Joueur',age:'Âge',positions:'Postes',height:'Taille',foot:'Pied',nationality:'Nationalité',one:'joueur',many:'joueurs',left:'Gauche',right:'Droit',tabs:['Info','Statistiques'],groups:['Techniques','Mentaux','Physiques','Gardien'],empty:'Aucun joueur n’est actuellement affecté à ce club.',unavailable:'L’effectif est temporairement indisponible.',missingApi:'L’API de l’effectif manque dans cette version. Redémarrez le serveur local depuis cette branche.',loading:'Chargement de l’effectif'},
  it:{name:'Giocatore',age:'Età',positions:'Posizioni',height:'Altezza',foot:'Piede',nationality:'Nazionalità',one:'giocatore',many:'giocatori',left:'Sinistro',right:'Destro',tabs:['Info','Statistiche'],groups:['Tecnici','Mentali','Fisici','Portiere'],empty:'Nessun giocatore è attualmente assegnato a questo club.',unavailable:'La rosa è temporaneamente non disponibile.',missingApi:'L’API della rosa non è disponibile in questa versione. Riavvia il server locale dal branch corrente.',loading:'Caricamento rosa'}
 };
 const rosterTabs=Object.fromEntries(Object.entries(rosterWords).map(([lang,words])=>[lang,words.tabs]));
 // Match the Player Detail Stats ordering first; append Roster-only metrics.
 const statKeys=['appearances','minutes','goals','assists','goalsAssistsPer90','yellowCards','redCards','cleanSheets','mvpAwards','averageRating'];
 const rosterLabels={
  en:['Attributes','Apps (Subs)','Min','Gls','Ast','G+A/90','YC','RC','CS','MVP','Rat.','Domestic','International','Not recorded'],
  it:['Attributi','Pres. (Sub.)','Min','Gol','Assist','G+A/90','Gialli','Rossi','CS','MVP','Val.','Nazionali','Internazionali','Dato non registrato'],
  de:['Attribute','Sp. (Einw.)','Min','Tor.','Vor.','G+A/90','Gelb','Rot','CS','MVP','Bew.','National','International','Nicht erfasst'],
  fr:['Attributs','MJ (Entr.)','Min','Bts','PdD','G+A/90','Jaunes','Rouges','CS','MVP','Not.','Nationales','Internationales','Non enregistré'],
  es:['Atributos','PJ (Sup.)','Min','Gol','Asist.','G+A/90','Amar.','Rojas','CS','MVP','Val.','Nacionales','Internacionales','Sin registrar']
 };
 const rosterStatHelp={
  en:{appearances:'Appearances (substitute appearances)',minutes:'Minutes played',goals:'Goals',assists:'Assists',goalsAssistsPer90:'Goals plus assists per 90 minutes played',yellowCards:'Yellow cards',redCards:'Red cards',cleanSheets:'Clean sheets',mvpAwards:'Player of the match awards',averageRating:'Average match rating'},
  it:{appearances:'Presenze (da subentrato)',minutes:'Minuti giocati',goals:'Gol segnati',assists:'Assist',goalsAssistsPer90:'Gol più assist ogni 90 minuti giocati',yellowCards:'Cartellini gialli',redCards:'Cartellini rossi',cleanSheets:'Clean sheet',mvpAwards:'Premi migliore in campo',averageRating:'Valutazione media'},
  de:{appearances:'Spiele (Einwechslungen)',minutes:'Gespielte Minuten',goals:'Tore',assists:'Vorlagen',goalsAssistsPer90:'Tore und Vorlagen pro 90 Minuten',yellowCards:'Gelbe Karten',redCards:'Rote Karten',cleanSheets:'Spiele ohne Gegentor',mvpAwards:'Auszeichnungen als Spieler des Spiels',averageRating:'Durchschnittliche Bewertung'},
  fr:{appearances:'Matchs joués (entrées en jeu)',minutes:'Minutes jouées',goals:'Buts',assists:'Passes décisives',goalsAssistsPer90:'Buts et passes décisives par 90 minutes',yellowCards:'Cartons jaunes',redCards:'Cartons rouges',cleanSheets:'Matchs sans but encaissé',mvpAwards:'Distinctions de joueur du match',averageRating:'Note moyenne'},
  es:{appearances:'Partidos jugados (entradas como suplente)',minutes:'Minutos jugados',goals:'Goles',assists:'Asistencias',goalsAssistsPer90:'Goles más asistencias cada 90 minutos',yellowCards:'Tarjetas amarillas',redCards:'Tarjetas rojas',cleanSheets:'Porterías a cero',mvpAwards:'Premios al mejor jugador del partido',averageRating:'Valoración media'}
 };
 function rosterCompetition(params){
  const scope=params.get('competition');
  return scope==='domestic'||scope==='international'?scope:'all';
 }
 function rosterView(params){
  if(params.get('view')==='stats')return 'stats';
  if(params.get('view')!=='attributes')return 'info';
  const group=params.get('group');
  return Object.hasOwn(rosterGroups,group)?group:'technical';
 }
 function rosterSortKeys(view){
  if(view==='info')return rosterSortInfo;
  return [...rosterSortCommon,...(view==='stats'?statKeys:rosterGroups[view])];
 }
 function rosterViewQuery(search,view){
  const query=new URLSearchParams(search);
  const attributes=Object.hasOwn(rosterGroups,view);
  query.set('view',attributes?'attributes':view);
  if(view!=='stats')query.delete('competition');
  if(!attributes)query.delete('group');
  else query.set('group',view);
  const allowed=rosterSortKeys(view);
  if(!allowed.includes(query.get('sort'))){query.delete('sort');query.delete('order');}
  return query;
 }
 function renderRoster(clubKey,lang,t,snapshot,search=''){
  const w=rosterWords[lang],params=new URLSearchParams(search);
  const view=rosterView(params);
  const mode=view==='info'?'overview':view==='stats'?'stats':'attributes';
  const group=mode==='attributes'?view:'technical',words=rosterLabels[lang];
  const base='/clubs/'+clubKey.split('-')[0].toLowerCase()+'/'+clubKey.split('-')[1]+'/roster';
  const href=target=>base+'?'+rosterViewQuery(search,target);
  const attributeKeys=rosterGroups[group];
  const allowedSort=rosterSortKeys(view);
  const requestedSort=params.get('sort')||'';
  const sort=allowedSort.includes(requestedSort)?requestedSort:'';
  const order=sort?['desc','asc'].includes(params.get('order'))?params.get('order'):
   ['name','nationality','positions','foot'].includes(sort)?'asc':'desc':'';
  const attrNames=rosterAttributeNames[lang].split('|');
  const ready=snapshot?.source==='ready'&&snapshot.clubKey===clubKey&&
   Array.isArray(snapshot.players)&&Number.isSafeInteger(snapshot.count)&&snapshot.count===snapshot.players.length;
  const unavailable=snapshot?.source==='unavailable',pending=!ready&&!unavailable;
  // A verified empty squad has no usable subviews or table columns. Render only
  // localized text; unknown/loading states still reserve the table first paint.
  if(ready&&snapshot.count===0)
   return '<section class="club-roster" aria-busy="false" data-roster-mode="empty"><p class="club-roster-empty" role="status">'+escape(w.empty)+'</p></section>';
  const competitions=snapshot?.competitions||[];
  const scope=rosterCompetition(params);
  const groupIds=competitions.filter(id=>id.startsWith('int-')===(scope==='international'));
  const labels=mode==='attributes'
   ?['',w.name,w.positions,...attributeKeys.map(key=>attrNames[rosterAllAttributes.indexOf(key)])]
   :mode==='stats'?['',w.name,w.positions,...words.slice(1,1+statKeys.length)]:['',w.name,w.positions,w.age,w.height,w.foot,marketUI?.label(lang)||'Market value'];
  const columns='<colgroup><col class="app-players-flag-column"><col class="app-players-name-column">'+
   '<col class="app-players-view-third-column">'+'<col>'.repeat(labels.length-3)+'</colgroup>';
  const colCount=labels.length;
  const columnSorts=allowedSort;
  let body;
  if(pending){
   body=Array.from({length:5},(_,i)=>'<tr class="app-players-loading-row"'+(i?' aria-hidden="true"':'')+'><td colspan="'+colCount+'">'+
    (i?'':'<span class="sr-only" role="status">'+escape(w.loading)+'</span>')+'</td></tr>').join('');
  }else if(!ready||!snapshot.players.length){
   const message=ready?w.empty:snapshot?.status===404?w.missingApi:w.unavailable;
   body='<tr class="app-players-empty-row"><td colspan="'+colCount+'"><strong role="status">'+escape(message)+'</strong></td></tr>';
  }else{
   // At most one domestic and one international membership per club/season.
   // Use each separately aggregated projection: do not add ratings or per-90 rates.
   const players=mode==='stats'&&scope!=='all'?snapshot.players.map(player=>({
    ...player,stats:groupIds.length===1?player.competitionStats?.[groupIds[0]]??null:null
   })):snapshot.players;
   const statText=(stats,key)=>{
    const value=rosterStatValue(stats,key);
    if(value===undefined||value===null)return null;
    if(key==='averageRating')return value.toFixed(1);
    if(key==='goalsAssistsPer90')return value.toFixed(2);
    if(key==='appearances')return value+' ('+(stats.subAppearances??'—')+')';
    return String(value);
   };
   const statCell=(stats,key)=>{
    const value=statText(stats,key);
    return value===null?'<td><span title="'+escape(words[13])+'" aria-label="'+escape(words[12])+'">—</span></td>'
     :'<td>'+escape(value)+'</td>';
   };
   body=sortedRosterPlayers(players,sort||'positions',sort?order:'desc').map(player=>{
    const id=Number(player.id),country=player.nationality;
    const code=Object.hasOwn(rosterFlags,country)?rosterFlags[country]:null;
    const flag=code?'<img class="app-players-nationality-flag" src="/assets/flags/'+escape(code)+'.svg" width="20" height="15" alt="'+escape(country)+'" title="'+escape(country)+'">':escape(country||'');
    const positions=[player.primary_position,...(Array.isArray(player.secondary_positions)?player.secondary_positions:[])].filter(Boolean).join(', ');
    const value=v=>Number.isSafeInteger(v)?String(v):'—';
    const cells=mode==='stats'?'<td>'+escape(positions||'—')+'</td>'+statKeys.map(key=>statCell(player.stats,key)).join(''):mode==='attributes'
     ?'<td>'+escape(positions||'—')+'</td>'+attributeKeys.map(key=>'<td>'+value(player.attributes?.[key])+'</td>').join('')
     :'<td>'+escape(positions||'—')+'</td><td>'+value(player.age)+'</td><td>'+(Number.isSafeInteger(player.height_cm)?player.height_cm+' cm':'—')+'</td><td>'+escape(player.preferred_foot==='left'?w.left:player.preferred_foot==='right'?w.right:'—')+'</td><td class="app-market-value-col">'+escape(marketUI?.format(player.market_value_arc,lang)||'—')+'</td>';
    return '<tr><td>'+flag+'</td><td><a class="club-roster-player-link" href="/players/'+id+'" data-mobile-name="'+escape(compactPlayerName(player.display_name))+'" aria-label="'+escape(player.display_name)+'"><span class="fa-player-full-name">'+escape(player.display_name)+'</span><span class="fa-player-short-name">'+escape(compactPlayerName(player.display_name))+'</span></a></td>'+cells+'</tr>';
   }).join('');
  }
  const count=ready?new Intl.NumberFormat(lang).format(snapshot.count)+' '+(snapshot.count===1?w.one:w.many)
   :'<span class="app-players-count-placeholder" aria-hidden="true"></span>';
  const viewTabs=['info','stats','attributes'].map((key,i)=>{
   const active=key===(mode==='overview'?'info':mode);
   const label=[w.tabs[0],w.tabs[1],words[0]][i];
   return '<a role="tab" class="app-competition-tab'+(active?' is-active':'')+'" href="'+escape(href(key==='attributes'?group:key))+'" data-club-roster-view="'+key+'" aria-selected="'+active+'" tabindex="'+(active?'0':'-1')+'">'+escape(label)+'</a>';
  }).join('');
  let selector='';
  if(mode==='attributes'){
   const options=Object.keys(rosterGroups).map((key,i)=>[key,w.groups[i]]);
   selector=fixtureUI.control('group',words[0],options.find(([key])=>key===group)[1],options,'club-roster');
  }else if(mode==='stats'){
   const labels=fixtureUI.copy[lang];
   selector=fixtureUI.control('competition',labels.competition,scope==='all'?labels.all:words[scope==='international'?12:11],
    [['all',labels.all],['domestic',words[11]],['international',words[12]]],'club-roster');
  }
  return '<section class="club-roster" aria-busy="'+pending+'" data-roster-mode="'+mode+'">'+
   '<div class="club-roster-view-row"><nav class="app-competition-tabs app-players-tabs club-roster-tabs" role="tablist" aria-label="'+escape(t.roster)+'">'+viewTabs+'</nav>'+selector+'<span class="club-roster-count"><span aria-hidden="true" class="club-roster-count-width">99 '+w.many+'</span><span>'+count+'</span></span></div>'+
   '<div class="app-players-table-scroll club-roster-table-scroll" role="region" aria-label="'+escape(t.roster)+'" tabindex="0"'+(pending?' aria-busy="true"':'')+'>'+
   '<table class="app-players-table club-roster-table" data-players-table-mode="'+mode+'" data-roster-group="'+group+'" aria-label="'+escape(t.roster)+'">'+
   columns+'<thead><tr>'+labels.map((label,i)=>{
    const key=columnSorts[i],active=sort===key;
    return '<th scope="col" aria-sort="'+(active?order==='desc'?'descending':'ascending':'none')+'"'+(key==='market_value_arc'?' class="app-market-value-col"':'')+
     (i===0?' class="app-players-flag-col" aria-label="'+escape(w.nationality)+'"':'')+'>'+
     '<button type="button" class="app-players-sort-button" data-club-roster-sort="'+key+'"'+
     (mode==='stats'&&i>=3?' data-roster-stat-help="'+escape(rosterStatHelp[lang][key])+'"':'')+'>'+
     '<span class="app-players-sort-label">'+(i===0?'<span class="sr-only">'+escape(w.nationality)+'</span>':escape(label))+
     rosterSortChevron+'</span></button></th>';
   }).join('')+
   '</tr></thead><tbody>'+body+'</tbody></table></div></section>';
 }
 function render(manifest,selected,language='en',search='',snapshot=null,activeSeason=null,historySnapshot=null,rosterSnapshot=null,currentWorldSeason=null){
  const lang=Object.hasOwn(copies,language)?language:'en',t=copies[lang];
  const index=getIndex(manifest),c=index.clubs.get(selected.countryId+'-'+selected.clubId);
  if(!c)throw Error('Unknown club identity');
  const country=countryNames[lang][countries.indexOf(c.countryId)];
  const division=index.divisions.get(c.divisionId);
  // Reuse generated competition artwork, scoping SVG IDs for both placements.
  const flag=placement=>manifest.countryFlags[c.countryId]
   .replace('class="app-world-flag"','class="app-world-flag club-country-flag"')
   .replace(/id="([^"]+)"/g,(_,id)=>'id="club-'+placement+'-'+id+'"')
   .replace(/url\(#([^)]+)\)/g,(_,id)=>'url(#club-'+placement+'-'+id+')')
   .replace(/href="#([^"]+)"/g,(_,id)=>'href="#club-'+placement+'-'+id+'"');
  const link=division?routes.buildRoute({kind:'competition',id:division.id.toLowerCase(),view:'standings'}):null;
  const fact=(label,value)=>'<div><dt>'+escape(t[label])+'</dt><dd>'+value+'</dd></div>';
  const crestId=c.countryId+'-'+c.clubId;
  const crestMatch=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/.exec(crestId);
  const crestSource=crestMatch&&Object.hasOwn(manifest.clubCrests||{},crestId)&&
   manifest.clubCrests[crestId]==='assets/clubs/'+crestMatch[1]+'/'+crestMatch[2]+'/crest.svg'
   ?'/assets/clubs/'+crestMatch[1]+'/'+crestMatch[2]+'/crest.svg':null;
  const crest=()=>'<span class="app-world-club-crest-placeholder club-crest fa-crest-loading" data-club-crest="'+escape(crestId)+'"'+(crestSource?' data-club-crest-pending="true"':'')+' role="img" aria-label="'+escape(t.crest+' — '+c.primaryName)+'">'+(crestSource?'<img class="app-club-crest-image" src="'+escape(crestSource)+'" alt="" decoding="sync">':'')+'</span>';
  const divisionLogo=division?domesticLogoUrl(division.id):null;
  const summary=division&&snapshot?.source==='dev'&&snapshot.divisionId===division.id&&snapshot.clubId===c.clubId&&
   Number.isInteger(snapshot.season)&&snapshot.season>=1&&snapshot.season<=4&&
   (snapshot.position===null||Number.isInteger(snapshot.position)&&snapshot.position>=1&&snapshot.position<=16)&&
   Number.isInteger(snapshot.points)&&snapshot.points>=0&&snapshot.points<=90?snapshot:null;
  const params=new URLSearchParams(search);
  const requestedSeason=params.get('season');
  const competitionSeason=summary?.season||(/^[1-9]\d{0,8}$/.test(requestedSeason||'')?Number(requestedSeason):null)||(Number.isInteger(activeSeason)&&activeSeason>=1&&activeSeason<=999999999?activeSeason:null);
  const canonicalCurrent=Number.isSafeInteger(currentWorldSeason)&&currentWorldSeason>=0?Math.max(1,currentWorldSeason):
   params.has('season')?null:competitionSeason;
  const explicit=routes.resolveSeasonQuery(params,canonicalCurrent).explicit;
  const seasonLink=(path,year)=>routes.withSeason(path,year,canonicalCurrent,{preserveExplicit:explicit&&Number(requestedSeason)===year});
  const competitionLink=link?seasonLink(link,competitionSeason):null;
  // A verified season membership replaces the build-time Season 1 division. The
  // fallback is retained only for legacy isolated DEV/tests, never while a
  // public source is loading or after authoritative season hydration.
  const clubKey=c.countryId+'-'+c.clubId;
  const publicMemberships=snapshot?.source==='authoritative'&&snapshot.clubKey===clubKey&&
   (snapshot.season===activeSeason||snapshot.season===0)&&['complete','unstarted','unpublished'].includes(snapshot.coverage)&&Array.isArray(snapshot.memberships)?
    snapshot.memberships:null;
  const publicPending=snapshot?.source==='loading';
  const publicUnavailable=snapshot?.source==='unavailable';
  const publicUnpublished=publicMemberships!==null&&snapshot?.coverage==='unpublished';
  const currentDomestic=publicMemberships?.find(m=>m.category==='domestic')||null;
  const shownDomestic=currentDomestic?index.divisions.get(currentDomestic.competitionId):null;
  const divisionValue=publicMemberships
   ?shownDomestic?'<a class="app-link" data-club-division-link href="'+seasonLink(routes.buildRoute({kind:'competition',id:shownDomestic.id.toLowerCase(),view:'standings'}),Math.max(1,snapshot.season))+'">'+escape(shownDomestic.name)+'</a>':escape(t.outside)
   :publicPending?'<span class="club-fp-bar" style="--club-fp-width:55%"></span>':publicUnavailable?'—'
    :division?'<a class="app-link" data-club-division-link href="'+competitionLink+'">'+escape(division.name)+'</a>':escape(t.outside);
  const next=summary?.nextMatch;
  const homeCandidate=next&&index.clubs.get(c.countryId+'-'+next.homeId);
  const home=homeCandidate&&homeCandidate.divisionId===c.divisionId?homeCandidate:null;
  const awayCandidate=next&&index.clubs.get(c.countryId+'-'+next.awayId);
  const away=awayCandidate&&awayCandidate.divisionId===c.divisionId?awayCandidate:null;
  const validNext=home&&away&&home.clubId!==away.clubId&&[home.clubId,away.clubId].includes(c.clubId)&&Number.isInteger(next.round)&&next.round>=1&&next.round<=33;
  const fixtureLink=validNext?seasonLink(routes.buildRoute({kind:'competition',id:division.id.toLowerCase(),view:'fixtures'})+'?matchday='+(next.round<=30?next.round:division.tier===1?'playout':'playoffs'),summary.season):null;
  const rank=summary?.position===null||!summary?'—':ordinal(summary.position,lang);
  const nextContent=validNext?'<a class="app-link" href="'+escape(fixtureLink)+'"><span class="club-competition-match-name">'+escape(home.primaryName+' – '+away.primaryName)+'</span></a><small>'+escape(next.round<=30?t.matchdayLabel+' '+next.round:division.tier===1?t.playoutLabel:t.playoffsLabel)+'</small>':
   '<span class="club-competition-next-empty">'+escape(summary?t.noUpcomingMatch:t.noScheduledMatch)+'</span>';
  // One canonical DOM row for DEV and authoritative membership data. Debug
  // Settings must affect only the values, never the competition layout.
  const competitionRow=({id,badge,name,tier,status,nextInfo})=>
   '<div class="club-competition-layout club-competition-entry" data-club-competition-id="'+escape(id)+'">'+
   '<div class="club-competition-identity">'+badge+'<div class="club-competition-copy"><strong class="club-competition-name">'+name+'</strong>'+
   '<span class="club-competition-tier">'+escape(tier)+'</span></div></div>'+
   '<div class="club-competition-summary"><dl class="club-competition-metrics"><div><dt>'+escape(t.statusLabel)+'</dt><dd data-club-position>'+status+'</dd></div></dl>'+
   '<div class="club-competition-next"><span class="club-competition-label">'+escape(t.nextMatchLabel)+'</span><div class="club-competition-next-content">'+nextInfo+'</div></div></div></div>';
  const competitionCard=division?'<div class="club-competition-list">'+competitionRow({
   id:division.id,badge:'<img class="club-competition-logo" src="'+escape(divisionLogo)+'" width="64" height="64" alt="">',
   name:divisionValue,tier:division.tier===1?t.tier1Label:t.tier2Label,
   status:rank,nextInfo:nextContent
  })+'</div>':
   '<p class="club-competition-empty">'+escape(t.noActiveCompetitions)+'</p>';

  const memberCard=membership=>{
   const def=index.divisions.get(membership.competitionId),isDomestic=membership.category==='domestic';
   const title=isDomestic?(def?.name||membership.name):membership.name;
   const target=seasonLink(routes.buildRoute({kind:isDomestic?'competition':'cup',id:membership.competitionId.toLowerCase(),view:'standings'}),membership.season);
   const badge=isDomestic&&def?'<img class="club-competition-logo" src="'+escape(domesticLogoUrl(def.id))+'" width="64" height="64" alt="">':
    '<span class="club-competition-cup-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v8a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v3a4 4 0 0 0 4 4M16 6h3v3a4 4 0 0 1-4 4M12 16v3M8 21h8"/></svg></span>';
   const next=membership.nextMatch;
   const home=next&&index.clubs.get(next.homeId),away=next&&index.clubs.get(next.awayId);
   const valid=!!(home&&away&&home!==away&&[next.homeId,next.awayId].includes(clubKey));
   const phase=isDomestic?(next?.phaseId==='playout'?'playout':next?.phaseId==='promotionPlayoffs'?'playoffs':next?.round<=30?next.round:null)
     :(next?.phaseId==='league'?next.round:next?.phaseId);
   const fixtureUrl=valid&&phase!==null&&phase!==undefined?
    seasonLink(routes.buildRoute({kind:isDomestic?'competition':'cup',id:membership.competitionId.toLowerCase(),view:'fixtures'})+'?matchday='+phase,membership.season):null;
   const nextInfo=fixtureUrl
    ?'<a class="app-link" href="'+escape(fixtureUrl)+'"><span class="club-competition-match-name">'+escape(home.primaryName+' – '+away.primaryName)+'</span></a><small>'+escape(typeof phase==='number'?t.matchdayLabel+' '+phase:
      phase==='playout'?t.playoutLabel:phase==='playoffs'?t.playoffsLabel:phase==='quarterfinals'?'Quarter-finals':phase==='semifinals'?'Semi-finals':'Final')+'</small>'
    :'<span class="club-competition-next-empty">'+escape(t.noUpcomingMatch)+'</span>';
   const tier=isDomestic?(def?.tier===1?t.tier1Label:t.tier2Label):t.internationalLabel;
   return competitionRow({
    id:membership.competitionId,badge,
    name:'<a class="app-link" data-club-division-link href="'+escape(target)+'">'+escape(title)+'</a>',
    tier,
    status:isDomestic||!internationalStatusLabels[lang][membership.cupStatus]
     ?membership.position===null?'—':ordinal(membership.position,lang)
     :escape(internationalStatusLabels[lang][membership.cupStatus]),
    nextInfo
   });
  };
  const effectiveCompetitionCard=publicUnavailable?'<p class="club-competition-empty" role="status">'+escape(t.competitionUnavailable)+'</p>':publicUnpublished?
   '<p class="club-competition-empty" role="status">'+escape(t.competitionUnpublished)+'</p>':publicMemberships?
   (publicMemberships.length?'<div class="club-competition-list">'+publicMemberships.map(memberCard).join('')+'</div>':'<p class="club-competition-empty">'+escape(t.noActiveCompetitions)+'</p>'):
   publicPending?'<div class="club-competition-list club-fp-competition" aria-busy="true"><div class="club-competition-layout club-competition-entry"><div class="club-competition-identity"><span class="club-competition-logo club-fp-competition-logo" aria-hidden="true"></span><div class="club-competition-copy"><strong class="club-competition-name"><span class="club-fp-bar club-fp-competition-name" aria-hidden="true"></span></strong><span class="club-competition-tier"><span class="club-fp-bar club-fp-competition-tier" aria-hidden="true"></span></span></div></div><div class="club-competition-summary"><dl class="club-competition-metrics"><div><dt>'+escape(t.statusLabel)+'</dt><dd><span class="club-fp-bar club-fp-competition-position" aria-hidden="true"></span></dd></div></dl><div class="club-competition-next"><span class="club-competition-label">'+escape(t.nextMatchLabel)+'</span><div class="club-competition-next-content"><span class="club-fp-bar club-fp-competition-fixture" aria-hidden="true"></span><span class="club-fp-bar club-fp-competition-round" aria-hidden="true"></span></div></div></div></div></div>':
   competitionCard;
  // Navigation carries existing temporal context only into Fixtures/Stats. No clock is created here.
  const temporal=new URLSearchParams();
  for(const key of ['season','matchday'])if(params.has(key)&&(key!=='season'||explicit))temporal.set(key,params.get(key));
  const tabs='<nav class="app-competition-tabs club-tabs" aria-label="'+escape(t.navigation)+'">'+views.map(view=>{
   const query=view==='fixtures'?temporal:view==='records'&&temporal.has('season')?new URLSearchParams([['season',temporal.get('season')]]):null;
   const suffix=query?.size?'?'+query:'';
   return '<a class="app-competition-tab'+(view===selected.view?' is-active':'')+'" href="'+routes.buildRoute({kind:'club',country:selected.countryId.toLowerCase(),id:selected.clubId,view})+suffix+'"'+(view===selected.view?' aria-current="page"':'')+'>'+escape(t[view])+'</a>';
  }).join('')+'</nav>';
  const swatch=key=>{
   if(!/^#[0-9A-F]{6}$/.test(c[key]))throw Error('Invalid canonical color');
   return '<span class="club-color-value"><span class="club-color" style="--club-color:'+c[key]+'" aria-hidden="true"></span><span>'+c[key]+'</span></span>';
  };
  let content;
  if(selected.view==='overview'){
   const originalLang={IT:'it',ENG:'en',ES:'es',DE:'de',FR:'fr',PT:'pt',BR:'pt',NL:'nl'}[c.countryId];
   const translationAvailable=lang!==originalLang&&typeof c.descriptions?.[lang]==='string'&&c.descriptions[lang].trim();
   const colors='<span class="club-colors">'+swatch('primaryColor')+swatch('secondaryColor')+'</span>';
   const countryField='<span class="club-country-value">'+flag('identity')+' '+escape(country)+'</span>';
   const clubId=c.countryId+'-'+c.clubId;
   const rivals=(index.rivalries.get(clubId)||[]);
   const rivalItems=rivals.map(r=>{
    const opponent=r.clubAId===clubId?r.clubBId:r.clubAId;
    const target=index.clubs.get(opponent);
    if(!target)return '';
    const derby=escape(r.derbyName);
    return '<li><a class="app-link" href="'+routes.buildRoute({kind:'club',country:target.countryId.toLowerCase(),id:target.clubId,view:'overview'})+'">'+escape(target.primaryName)+'</a><span>'+derby+'</span></li>';
   }).join('');
   content='<div class="club-overview-layout"><div class="club-overview-main">'+
    '<section class="app-panel club-identity" aria-labelledby="club-identity-title"><h2 id="club-identity-title">'+escape(t.identity)+'</h2>'+
    '<dl class="club-facts">'+fact('nameLabel',escape(c.primaryName))+fact('country',countryField)+fact('city',escape(c.city))+fact('abbr',escape(c.abbr))+fact('colorsLabel',colors)+fact('nickname',escape(c.nickname))+fact('stadium',escape(c.stadiumName))+
    '<div class="club-fact-rivalries"><dt>'+escape(t.rivalriesLabel)+'</dt><dd>'+
    (rivalItems?'<ul class="club-rivalries-list">'+rivalItems+'</ul>':escape(t.noRivalries))+'</dd></div>'+
    '<div class="club-fact-description"><dt>'+escape(t.descriptionLabel)+'</dt><dd><p class="club-description" data-original-description="'+escape(c.description)+'" data-translated-description="'+escape(translationAvailable?c.descriptions[lang]:c.description)+'">'+escape(c.description)+'</p>'+
    (translationAvailable?'<button type="button" class="club-translate-button" data-translate-club aria-pressed="false">'+escape(t.translateLabel)+'</button>':'')+'</dd></div></dl></section>'+
    '</div><aside class="app-panel club-kits" aria-labelledby="club-kits-title"><h2 id="club-kits-title">'+escape(t.kitsLabel)+'</h2><p>'+escape(t.kitsPending)+'</p></aside>'+
    '<section class="app-panel club-competition" aria-labelledby="club-competition-title"><h2 id="club-competition-title">'+escape(t.competition)+'</h2>'+
    effectiveCompetitionCard+'</section></div>';
  }else if(selected.view==='roster'){
   content=renderRoster(clubKey,lang,t,rosterSnapshot,search);
  }else if(selected.view==='records'){
   content=recordsUI.render({selected,historySnapshot,language:lang,search,ordinal,index});
  }else if(selected.view==='history'){
   const words={
    en:{season:'Season',competition:'Competition',result:'Result',played:'MP',won:'W',drawn:'D',lost:'L',gf:'GF',ga:'GA',gd:'GD',points:'Pts',total:'Total',show:'Show competitions for',empty:'No games played',without:'No competitions this season.',unavailable:'Club history is temporarily unavailable.'},
    de:{season:'Saison',competition:'Wettbewerb',result:'Ergebnis',played:'Sp',won:'S',drawn:'U',lost:'N',gf:'T+',ga:'T−',gd:'TD',points:'Pkt',total:'Gesamt',show:'Wettbewerbe anzeigen für',empty:'Noch keine Spiele gespielt',without:'Keine Wettbewerbe in dieser Saison.',unavailable:'Die Vereinshistorie ist vorübergehend nicht verfügbar.'},
    es:{season:'Temporada',competition:'Competición',result:'Resultado',played:'PJ',won:'G',drawn:'E',lost:'P',gf:'GF',ga:'GC',gd:'DG',points:'Pts',total:'Total',show:'Mostrar competiciones de',empty:'No se han jugado partidos',without:'Sin competiciones esta temporada.',unavailable:'El historial del club no está disponible temporalmente.'},
    fr:{season:'Saison',competition:'Compétition',result:'Résultat',played:'MJ',won:'V',drawn:'N',lost:'D',gf:'BP',ga:'BC',gd:'DB',points:'Pts',total:'Total',show:'Afficher les compétitions de',empty:'Aucun match joué',without:'Aucune compétition cette saison.',unavailable:'L’historique du club est temporairement indisponible.'},
    it:{season:'Stagione',competition:'Competizione',result:'Risultato',played:'PG',won:'V',drawn:'N',lost:'P',gf:'GF',ga:'GS',gd:'DR',points:'Pt',total:'Totale',show:'Mostra competizioni della',empty:'Nessuna partita giocata',without:'Nessuna competizione in questa stagione.',unavailable:'La storia del club è temporaneamente non disponibile.'}
   }[lang];
   const historySourceVerified=historySnapshot?.source==='authoritative'||
    historySnapshot?.source==='dev'&&historySnapshot.provenance?.kind==='fictional'&&
    historySnapshot.provenance.sourceRef==='dev-fictional-preview'&&historySnapshot.provenance.approved===false;
   const verified=historySourceVerified&&historySnapshot.clubKey===clubKey&&
    ['complete','empty'].includes(historySnapshot.coverage)&&Array.isArray(historySnapshot.seasons);
   const pending=!verified&&historySnapshot?.source!=='unavailable';
   const columns=[words.season,words.competition,words.result,words.played,words.won,words.drawn,words.lost,words.gf,words.ga,words.gd,words.points];
   const heading='<thead><tr>'+columns.map((label,i)=>
    '<th scope="col" class="'+(i===0?'club-history-season-col':i===1?'club-history-name-col':i===2?'club-history-position-col':'club-history-number-col')+'"'+
    (i<3?' aria-label="'+escape(label)+'"':'')+'>'+escape(label)+'</th>').join('')+'</tr></thead>';
   const columnWidths='<colgroup><col class="club-history-col-season"><col class="club-history-col-name"><col class="club-history-col-position">'+
    Array.from({length:8},()=>'<col class="club-history-col-number">').join('')+'</colgroup>';
   const bar='<span class="club-fp-bar" aria-hidden="true"></span>';
   const sampleTotals={played:'30',won:'18',drawn:'10',lost:'12',gf:'104',ga:'104',gd:'+52'};
   const loadingStats=['played','won','drawn','lost','gf','ga','gd']
    .map(key=>'<td class="club-history-skeleton-stat" data-club-history-skeleton="'+key+'"><span class="club-history-stat-value"><span class="club-fp-bar" data-skeleton-sample="'+sampleTotals[key]+'" aria-hidden="true"></span></span></td>').join('');
   const displayNumber=value=>value>0&&typeof value==='number'?'+'+value:String(value);
   let body='';
   if(verified&&!historySnapshot.seasons.some(entry=>entry.memberships.some(m=>m.stats?.played>0)))
    body='<p class="club-history-status" role="status">'+escape(words.empty)+'</p>';
   else if(!pending&&!verified)
    body='<p class="club-history-status" role="status">'+escape(words.unavailable)+'</p>';
   else{
    let rows;
    if(pending)rows='<tr class="club-history-season-row club-history-row-loading" aria-hidden="true">'+
     '<th scope="row" class="club-history-season-value"><span class="club-history-expand club-history-skeleton-label">'+
     '<span class="club-history-chevron-space" aria-hidden="true"></span>'+bar+'</span></th>'+
     '<td class="club-history-total-label"><span class="club-history-total-value">'+bar+'</span></td><td></td>'+
     loadingStats+'<td></td></tr>';
    else rows=[...historySnapshot.seasons].reverse().map(entry=>{
     const year=entry.season;
     const members=[...entry.memberships].sort((a,b)=>
      a.category===b.category?a.competitionId.localeCompare(b.competitionId,'en'):a.category==='domestic'?-1:1);
     if(!members.length)return '<tr id="club-history-season-'+year+'" data-club-history-summary="'+year+'" class="club-history-season-row">'+
      '<th scope="row" class="club-history-season-value">'+escape(words.season)+' '+year+'</th>'+
      '<td class="club-history-empty-season">'+escape(words.empty)+'</td>'+
      '<td></td>'+Array.from({length:8},()=>'<td></td>').join('')+'</tr>';
     const totals=members.reduce((sum,m)=>{
      for(const key of ['played','won','drawn','lost','goalsFor','goalsAgainst','goalDifference'])sum[key]+=m.stats[key];
      return sum;
     },{played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalDifference:0});
     const numeric=[totals.played,totals.won,totals.drawn,totals.lost,totals.goalsFor,
      totals.goalsAgainst,displayNumber(totals.goalDifference),''];
     const summary='<tr id="club-history-season-'+year+'" class="club-history-season-row" data-club-history-summary="'+year+'">'+
      '<th scope="row" class="club-history-season-value"><button type="button" class="club-history-expand"'+
      ' data-club-history-toggle="'+year+'" aria-expanded="false" aria-label="'+escape(words.show+' '+words.season+' '+year)+'">'+
      '<span class="club-history-chevron" aria-hidden="true"></span>'+escape(words.season)+' '+year+'</button></th>'+
      '<td class="club-history-total-label"><span class="club-history-total-value">'+escape(words.total)+'</span></td><td></td>'+
      numeric.map(value=>'<td><span class="club-history-stat-value">'+escape(value)+'</span></td>').join('')+'</tr>';
     const details=members.map(m=>{
      const domestic=m.category==='domestic',def=index.divisions.get(m.competitionId);
      const title=domestic?(def?.name||m.name):m.name;
      const href=routes.buildRoute({kind:domestic?'competition':'cup',id:m.competitionId.toLowerCase(),view:'standings'})+'?season='+year;
      const position=domestic?(m.position===null?'':ordinal(m.position,lang)):
       (internationalStatusLabels[lang][m.cupStatus]||
        (entry.ongoing&&m.stats.played>0?internationalStatusLabels[lang].groupStage:''));
      // Official division logos come from the same validated competition identity
      // already used in Club Overview. International cups currently have no
      // published logo assets, so retain the existing neutral cup mark.
      const logo=domestic&&def?domesticLogoUrl(def.id):null;
      const badge='<span class="fa-competition-mark" aria-hidden="true">'+
       (logo?'<img src="'+escape(logo)+'" width="24" height="24" alt="" loading="lazy" decoding="async">':
        !domestic?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v8a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v3a4 4 0 0 0 4 4M16 6h3v3a4 4 0 0 1-4 4M12 16v3M8 21h8"/></svg>':'')+'</span>';
      const stats=m.stats;
      const values=[position,stats.played,stats.won,stats.drawn,stats.lost,stats.goalsFor,stats.goalsAgainst,
       displayNumber(stats.goalDifference),m.points];
      return '<tr class="club-history-competition-row" data-club-history-detail="'+year+'"'+
       ' data-history-competition-row="'+escape(m.competitionId)+'" hidden>'+
       '<td></td><th scope="row" class="club-history-competition-value"><span class="club-history-competition-identity">'+badge+'<a class="club-history-competition-link" href="'+escape(href)+'"><span class="club-history-competition-text">'+escape(title)+'</span></a></span></th>'+
       values.map((value,i)=>i===0?'<td>'+escape(value)+'</td>':'<td><span class="club-history-stat-value">'+escape(value)+'</span></td>').join('')+'</tr>';
     }).join('');
     return summary+details;
    }).join('');
    body='<div class="club-history-table-wrap"><table class="club-history-table" aria-label="'+escape(t.history)+'">'+columnWidths+heading+
     '<tbody>'+rows+'</tbody></table></div>';
   }
   content='<section class="club-history" aria-busy="'+pending+'">'+body+'</section>';
  }else if(selected.view==='fixtures'){
   content=fixtureUI.render({manifest,lang,season:params.get('season')==='1'?1:null});
  }else{
   const empty='empty'+selected.view[0].toUpperCase()+selected.view.slice(1);
   content='<section class="app-panel club-empty"><p>'+escape(t[empty])+'</p></section>';
  }
  return '<header class="club-header">'+crest()+'<div><h1 id="club-title" class="app-page-title" aria-label="'+escape(c.fullName)+'">'+
   '<span data-club-name="full">'+escape(c.fullName)+'</span>'+
   '<span data-club-name="primary">'+escape(c.primaryName)+'</span>'+
   '<span data-club-name="compact">'+escape(c.compactName)+'</span></h1><p class="club-location">'+flag('header')+escape(c.city)+', '+escape(country)+'</p></div></header>'+tabs+
   content;
 }
 return {views,copies,route,ordinal,render,renderRoster,rosterLabels,rosterTabs,rosterStatHelp,rosterCompetition,rosterView,rosterViewQuery,rosterSortKeys};
});
