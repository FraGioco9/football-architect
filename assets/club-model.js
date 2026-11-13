/* CLUB-01: pure presentation shared by generation tests and the browser. */
((root,factory)=>{
 const routes=typeof module!=='undefined'&&module.exports&&typeof require==='function'?require('./routes-registry.js'):root.faRoutesRegistry;
 const model=factory(routes);root.faClubModel=model;
 if(typeof module!=='undefined'&&module.exports)module.exports=model;
})(typeof window!=='undefined'?window:globalThis,(routes)=>{
 'use strict';
 const fixtureUI=typeof module!=='undefined'&&module.exports&&typeof require==='function'?require('./club-fixtures.js'):globalThis.faClubFixtures;
 const views=['overview','roster','fixtures','stats','history'];
 const rosterFlags=Object.freeze({
  ESP:'es',ARG:'ar',FRA:'fr',ENG:'gb-eng',POR:'pt',BRA:'br',MAR:'ma',BEL:'be',NED:'nl',MEX:'mx',
  COL:'co',SUI:'ch',GER:'de',CRO:'hr',ITA:'it',USA:'us',JPN:'jp',SEN:'sn',NOR:'no',URU:'uy',
  DEN:'dk',AUT:'at',IRN:'ir',ECU:'ec',EGY:'eg',AUS:'au',CAN:'ca',ALG:'dz',CIV:'ci',NGA:'ng',
  TUR:'tr',KOR:'kr',PAR:'py',SWE:'se',RUS:'ru',UKR:'ua',POL:'pl',HUN:'hu',WAL:'gb-wls',COD:'cd',
  GRE:'gr',CMR:'cm',SCO:'gb-sct',SRB:'rs',SVK:'sk',PAN:'pa',MLI:'ml',RSA:'za',VEN:'ve',CHI:'cl'
 });
 const keys=['overview','roster','fixtures','stats','history','identity','profile','competition','primaryName','fullName','compactName','abbr','nickname','city','country','primaryColor','secondaryColor','stadium','division','provisional','outside','emptyRoster','emptyFixtures','emptyStats','emptyHistory','navigation','crest','error','skip'];
 const rows={
  en:['Overview','Roster','Fixtures','Stats','History','Club identity','Club profile','Competitions','Primary name','Full name','Compact name','Abbreviation','Nickname','City','Country','Primary color','Secondary color','Stadium','Division','Provisional allocation · no active season','Outside the current playing structure','No roster is available.','No fixtures are available.','No statistics are available.','No club history is available.','Club pages','Club crest','Club information is unavailable. Please reload the page.','Skip to content'],
  de:['Übersicht','Kader','Spielplan','Statistiken','Historie','Vereinsidentität','Vereinsprofil','Wettbewerbe','Hauptname','Vollständiger Name','Kurzname','Kürzel','Spitzname','Stadt','Land','Primärfarbe','Sekundärfarbe','Stadion','Liga','Vorläufige Zuordnung · keine aktive Saison','Außerhalb der aktuellen Spielstruktur','Kein Kader verfügbar.','Kein Spielplan verfügbar.','Keine Statistiken verfügbar.','Keine Vereinshistorie verfügbar.','Vereinsseiten','Vereinswappen','Vereinsinformationen sind nicht verfügbar. Bitte lade die Seite erneut.','Zum Inhalt springen'],
  es:['Resumen','Plantilla','Partidos','Estadísticas','Historial','Identidad del club','Perfil del club','Competiciones','Nombre principal','Nombre completo','Nombre corto','Abreviatura','Apodo','Ciudad','País','Color primario','Color secundario','Estadio','División','Asignación provisional · sin temporada activa','Fuera de la estructura de juego actual','No hay plantilla disponible.','No hay partidos disponibles.','No hay estadísticas disponibles.','No hay historial del club disponible.','Páginas del club','Escudo del club','La información del club no está disponible. Recarga la página.','Saltar al contenido'],
  fr:['Présentation','Effectif','Matchs','Statistiques','Historique','Identité du club','Profil du club','Compétitions','Nom principal','Nom complet','Nom court','Abréviation','Surnom','Ville','Pays','Couleur principale','Couleur secondaire','Stade','Division','Affectation provisoire · aucune saison active','Hors de la structure de jeu actuelle','Aucun effectif disponible.','Aucun match disponible.','Aucune statistique disponible.','Aucun historique du club disponible.','Pages du club','Écusson du club','Les informations du club sont indisponibles. Rechargez la page.','Aller au contenu'],
  it:['Panoramica','Rosa','Partite','Statistiche','Storia','Identità del club','Profilo del club','Competizioni','Nome principale','Nome completo','Nome breve','Abbreviazione','Soprannome','Città','Paese','Colore primario','Colore secondario','Stadio','Divisione','Assegnazione provvisoria · nessuna stagione attiva','Fuori dalla struttura di gioco corrente','Nessuna rosa disponibile.','Nessuna partita disponibile.','Nessuna statistica disponibile.','Nessuna storia del club disponibile.','Pagine del club','Stemma del club','Le informazioni del club non sono disponibili. Ricarica la pagina.','Vai al contenuto']
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
 const rosterSortInfo=Object.freeze(['nationality','name','age','positions','height','foot']);
 function rosterSortValue(player,key){
  if(key==='positions')return rosterPositionRank.get(player.primary_position)??0;
  if(key==='name')return player.display_name;
  if(key==='nationality')return player.nationality;
  if(key==='age')return player.age;
  if(key==='height')return player.height_cm;
  if(key==='foot')return player.preferred_foot;
  return player.attributes?.[key];
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
  en:{name:'Player',age:'Age',positions:'Positions',height:'Height',foot:'Foot',nationality:'Nationality',one:'player',many:'players',left:'Left',right:'Right',tabs:['Info'],groups:['Technical','Mental','Physical','Goalkeeper'],empty:'No players are currently assigned to this club.',unavailable:'The roster is temporarily unavailable.',missingApi:'Roster API is unavailable in this build. Restart the local development server from this branch.',loading:'Loading roster'},
  de:{name:'Spieler',age:'Alter',positions:'Positionen',height:'Größe',foot:'Fuß',nationality:'Nationalität',one:'Spieler',many:'Spieler',left:'Links',right:'Rechts',tabs:['Info'],groups:['Technisch','Mental','Physisch','Torwart'],empty:'Diesem Verein sind derzeit keine Spieler zugeordnet.',unavailable:'Der Kader ist vorübergehend nicht verfügbar.',missingApi:'Die Kader-API fehlt in diesem Build. Starte den lokalen Entwicklungsserver mit diesem Branch neu.',loading:'Kader wird geladen'},
  es:{name:'Jugador',age:'Edad',positions:'Posiciones',height:'Altura',foot:'Pie',nationality:'Nacionalidad',one:'jugador',many:'jugadores',left:'Izquierdo',right:'Derecho',tabs:['Info'],groups:['Técnicos','Mentales','Físicos','Portero'],empty:'Actualmente no hay jugadores asignados a este club.',unavailable:'La plantilla no está disponible temporalmente.',missingApi:'La API de la plantilla no está disponible en esta versión. Reinicia el servidor local desde esta rama.',loading:'Cargando plantilla'},
  fr:{name:'Joueur',age:'Âge',positions:'Postes',height:'Taille',foot:'Pied',nationality:'Nationalité',one:'joueur',many:'joueurs',left:'Gauche',right:'Droit',tabs:['Info'],groups:['Techniques','Mentaux','Physiques','Gardien'],empty:'Aucun joueur n’est actuellement affecté à ce club.',unavailable:'L’effectif est temporairement indisponible.',missingApi:'L’API de l’effectif manque dans cette version. Redémarrez le serveur local depuis cette branche.',loading:'Chargement de l’effectif'},
  it:{name:'Giocatore',age:'Età',positions:'Posizioni',height:'Altezza',foot:'Piede',nationality:'Nazionalità',one:'giocatore',many:'giocatori',left:'Sinistro',right:'Destro',tabs:['Info'],groups:['Tecnici','Mentali','Fisici','Portiere'],empty:'Nessun giocatore è attualmente assegnato a questo club.',unavailable:'La rosa è temporaneamente non disponibile.',missingApi:'L’API della rosa non è disponibile in questa versione. Riavvia il server locale dal branch corrente.',loading:'Caricamento rosa'}
 };
 function renderRoster(clubKey,lang,t,snapshot,search=''){
  const w=rosterWords[lang],params=new URLSearchParams(search);
  const requested=params.get('view');
  const group=Object.hasOwn(rosterGroups,requested)?requested:
   requested==='attributes'&&Object.hasOwn(rosterGroups,params.get('group'))?params.get('group'):'technical';
  const mode=Object.hasOwn(rosterGroups,requested)||requested==='attributes'?'attributes':'overview';
  const base='/clubs/'+clubKey.split('-')[0].toLowerCase()+'/'+clubKey.split('-')[1]+'/roster';
  const href=view=>{const query=new URLSearchParams(search);query.delete('view');query.delete('group');query.set('view',view);return base+'?'+query.toString();};
  const attributeKeys=rosterGroups[group];
  const allowedSort=mode==='attributes'?[...rosterSortCommon,...attributeKeys]:rosterSortInfo;
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
  const labels=mode==='attributes'
   ?['',w.name,w.positions,...attributeKeys.map(key=>attrNames[rosterAllAttributes.indexOf(key)])]
   :['',w.name,w.age,w.positions,w.height,w.foot];
  const columns='<colgroup><col class="app-players-flag-column"><col class="app-players-name-column">'+
   (mode==='attributes'?'<col class="app-players-view-third-column">'+attributeKeys.map(()=>'<col>').join(''):'<col><col><col><col>')+'</colgroup>';
  const colCount=labels.length;
  const columnSorts=mode==='attributes'?['nationality','name','positions',...attributeKeys]:rosterSortInfo;
  let body;
  if(pending){
   body=Array.from({length:5},(_,i)=>'<tr class="app-players-loading-row"'+(i?' aria-hidden="true"':'')+'><td colspan="'+colCount+'">'+
    (i?'':'<span class="sr-only" role="status">'+escape(w.loading)+'</span>')+'</td></tr>').join('');
  }else if(!ready||!snapshot.players.length){
   const message=ready?w.empty:snapshot?.status===404?w.missingApi:w.unavailable;
   body='<tr class="app-players-empty-row"><td colspan="'+colCount+'"><strong role="status">'+escape(message)+'</strong></td></tr>';
  }else{
   body=sortedRosterPlayers(snapshot.players,sort||'positions',sort?order:'desc').map(player=>{
    const id=Number(player.id),country=player.nationality;
    const code=Object.hasOwn(rosterFlags,country)?rosterFlags[country]:null;
    const flag=code?'<img class="app-players-nationality-flag" src="/assets/flags/'+escape(code)+'.svg" width="24" height="18" alt="'+escape(country)+'" title="'+escape(country)+'">':escape(country||'');
    const positions=[player.primary_position,...(Array.isArray(player.secondary_positions)?player.secondary_positions:[])].filter(Boolean).join(', ');
    const value=v=>Number.isSafeInteger(v)?String(v):'—';
    const cells=mode==='attributes'
     ?'<td>'+escape(positions||'—')+'</td>'+attributeKeys.map(key=>'<td>'+value(player.attributes?.[key])+'</td>').join('')
     :'<td>'+value(player.age)+'</td><td>'+escape(positions||'—')+'</td><td>'+(Number.isSafeInteger(player.height_cm)?player.height_cm+' cm':'—')+'</td><td>'+escape(player.preferred_foot==='left'?w.left:player.preferred_foot==='right'?w.right:'—')+'</td>';
    return '<tr><td>'+flag+'</td><td><a class="club-roster-player-link" href="/players/'+id+'">'+escape(player.display_name)+'</a></td>'+cells+'</tr>';
   }).join('');
  }
  const count=ready?new Intl.NumberFormat(lang).format(snapshot.count)+' '+(snapshot.count===1?w.one:w.many)
   :'<span class="app-players-count-placeholder" aria-hidden="true"></span>';
  const tabsDisabled=!ready;
  const viewTabs=['info',...Object.keys(rosterGroups)].map((key,i)=>{
   const active=key===(mode==='overview'?'info':group);
   const label=i===0?w.tabs[0]:w.groups[i-1];
   return '<a role="tab" class="app-competition-tab'+(active?' is-active':'')+'"'+(tabsDisabled?'':' href="'+escape(href(key))+'"')+' data-club-roster-view="'+key+'" aria-selected="'+active+'"'+(tabsDisabled?' aria-disabled="true"':'')+' tabindex="'+(tabsDisabled?'-1':active?'0':'-1')+'">'+escape(label)+'</a>';
  }).join('');
  return '<section class="club-roster" aria-busy="'+pending+'" data-roster-mode="'+mode+'">'+
   '<div class="club-roster-view-row"><nav class="app-competition-tabs app-players-tabs club-roster-tabs" role="tablist" aria-label="'+escape(t.roster)+'">'+viewTabs+'</nav><span class="club-roster-count">'+count+'</span></div>'+
   '<div class="app-players-table-scroll club-roster-table-scroll"'+(pending?' aria-busy="true"':'')+'>'+
   '<table class="app-players-table club-roster-table" data-players-table-mode="'+mode+'" data-roster-group="'+group+'" aria-label="'+escape(t.roster)+'">'+
   columns+'<thead><tr>'+labels.map((label,i)=>{
    const key=columnSorts[i],active=sort===key;
    return '<th scope="col" aria-sort="'+(active?order==='desc'?'descending':'ascending':'none')+'"'+
     (i===0?' class="app-players-flag-col" aria-label="'+escape(w.nationality)+'"':'')+'>'+
     '<button type="button" class="app-players-sort-button" data-club-roster-sort="'+key+'">'+
     '<span class="app-players-sort-label">'+(i===0?'<span class="sr-only">'+escape(w.nationality)+'</span>':escape(label))+
     rosterSortChevron+'</span></button></th>';
   }).join('')+
   '</tr></thead><tbody>'+body+'</tbody></table></div></section>';
 }
 function render(manifest,selected,language='en',search='',snapshot=null,activeSeason=null,historySnapshot=null,rosterSnapshot=null){
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
  const crest=()=>'<span class="app-world-club-crest-placeholder club-crest fa-crest-loading" data-club-crest="'+escape(c.countryId+'-'+c.clubId)+'"'+(Object.hasOwn(manifest.clubCrests||{},c.countryId+'-'+c.clubId)?' data-club-crest-pending="true"':'')+' role="img" aria-label="'+escape(t.crest+' — '+c.primaryName)+'">'+(manifest.clubCrests?.[c.countryId+'-'+c.clubId]?'<img class="app-club-crest-image" src="/'+escape(manifest.clubCrests[c.countryId+'-'+c.clubId])+'" alt="" decoding="sync">':'')+'</span>';
  const divisionLogo=division?'/assets/divisions/'+division.id.toLowerCase()+'-'+division.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'/compact.svg':null;
  const summary=division&&snapshot?.source==='dev'&&snapshot.divisionId===division.id&&snapshot.clubId===c.clubId&&
   Number.isInteger(snapshot.season)&&snapshot.season>=1&&snapshot.season<=4&&
   (snapshot.position===null||Number.isInteger(snapshot.position)&&snapshot.position>=1&&snapshot.position<=16)&&
   Number.isInteger(snapshot.points)&&snapshot.points>=0&&snapshot.points<=90?snapshot:null;
  const params=new URLSearchParams(search);
  const requestedSeason=params.get('season');
  const competitionSeason=summary?.season||(/^[1-9]\d{0,8}$/.test(requestedSeason||'')?Number(requestedSeason):null)||(Number.isInteger(activeSeason)&&activeSeason>=1&&activeSeason<=999999999?activeSeason:null);
  const competitionLink=link+(competitionSeason?'?season='+competitionSeason:'');
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
   ?shownDomestic?'<a class="app-link" data-club-division-link href="'+routes.buildRoute({kind:'competition',id:shownDomestic.id.toLowerCase(),view:'standings'})+'?season='+snapshot.season+'">'+escape(shownDomestic.name)+'</a>':escape(t.outside)
   :publicPending?'<span class="club-fp-bar" style="--club-fp-width:55%"></span>':publicUnavailable?'—'
    :division?'<a class="app-link" data-club-division-link href="'+competitionLink+'">'+escape(division.name)+'</a>':escape(t.outside);
  const next=summary?.nextMatch;
  const homeCandidate=next&&index.clubs.get(c.countryId+'-'+next.homeId);
  const home=homeCandidate&&homeCandidate.divisionId===c.divisionId?homeCandidate:null;
  const awayCandidate=next&&index.clubs.get(c.countryId+'-'+next.awayId);
  const away=awayCandidate&&awayCandidate.divisionId===c.divisionId?awayCandidate:null;
  const validNext=home&&away&&home.clubId!==away.clubId&&[home.clubId,away.clubId].includes(c.clubId)&&Number.isInteger(next.round)&&next.round>=1&&next.round<=33;
  const fixtureLink=validNext?routes.buildRoute({kind:'competition',id:division.id.toLowerCase(),view:'fixtures'})+'?season='+summary.season+'&matchday='+(next.round<=30?next.round:division.tier===1?'playout':'playoffs'):null;
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
   '<p class="club-competition-empty">'+escape(t.outside)+'</p>';

  const memberCard=membership=>{
   const def=index.divisions.get(membership.competitionId),isDomestic=membership.category==='domestic';
   const title=isDomestic?(def?.name||membership.name):membership.name;
   const target=routes.buildRoute({kind:isDomestic?'competition':'cup',id:membership.competitionId.toLowerCase(),view:'standings'})+'?season='+membership.season;
   const badge=isDomestic&&def?'<img class="club-competition-logo" src="/assets/divisions/'+escape(def.id.toLowerCase()+'-'+def.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'/compact.svg')+'" width="64" height="64" alt="">':
    '<span class="club-competition-cup-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v8a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v3a4 4 0 0 0 4 4M16 6h3v3a4 4 0 0 1-4 4M12 16v3M8 21h8"/></svg></span>';
   const next=membership.nextMatch;
   const home=next&&index.clubs.get(next.homeId),away=next&&index.clubs.get(next.awayId);
   const valid=!!(home&&away&&home!==away&&[next.homeId,next.awayId].includes(clubKey));
   const phase=isDomestic?(next?.phaseId==='playout'?'playout':next?.phaseId==='promotionPlayoffs'?'playoffs':next?.round<=30?next.round:null)
     :(next?.phaseId==='league'?next.round:next?.phaseId);
   const fixtureUrl=valid&&phase!==null&&phase!==undefined?
    routes.buildRoute({kind:isDomestic?'competition':'cup',id:membership.competitionId.toLowerCase(),view:'fixtures'})+'?season='+membership.season+'&matchday='+phase:null;
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
   (publicMemberships.length?'<div class="club-competition-list">'+publicMemberships.map(memberCard).join('')+'</div>':'<p class="club-competition-empty">'+escape(t.outside)+'</p>'):
   publicPending?'<div class="club-competition-list club-fp-competition" aria-busy="true"><div class="club-competition-layout club-competition-entry"><div class="club-competition-identity"><span class="club-competition-logo club-fp-competition-logo" aria-hidden="true"></span><div class="club-competition-copy"><strong class="club-competition-name"><span class="club-fp-bar club-fp-competition-name" aria-hidden="true"></span></strong><span class="club-competition-tier"><span class="club-fp-bar club-fp-competition-tier" aria-hidden="true"></span></span></div></div><div class="club-competition-summary"><dl class="club-competition-metrics"><div><dt>'+escape(t.statusLabel)+'</dt><dd><span class="club-fp-bar club-fp-competition-position" aria-hidden="true"></span></dd></div></dl><div class="club-competition-next"><span class="club-competition-label">'+escape(t.nextMatchLabel)+'</span><div class="club-competition-next-content"><span class="club-fp-bar club-fp-competition-fixture" aria-hidden="true"></span><span class="club-fp-bar club-fp-competition-round" aria-hidden="true"></span></div></div></div></div></div>':
   competitionCard;
  // Navigation carries existing temporal context only into Fixtures/Stats. No clock is created here.
  const temporal=new URLSearchParams();
  for(const key of ['season','matchday'])if(params.has(key))temporal.set(key,params.get(key));
  const tabs='<nav class="app-competition-tabs club-tabs" aria-label="'+escape(t.navigation)+'">'+views.map(view=>{
   const suffix=view==='roster'?'?view=info':['fixtures','stats'].includes(view)&&temporal.size?'?'+temporal:'';
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
  }else if(selected.view==='history'){
   const words={
    en:{season:'Season',competition:'Competition',position:'Pos.',played:'MP',won:'W',drawn:'D',lost:'L',gf:'GF',ga:'GA',gd:'GD',points:'Pts',total:'Total',show:'Show competitions for',empty:'No games played',without:'No competitions this season.',unavailable:'Club history is temporarily unavailable.'},
    de:{season:'Saison',competition:'Wettbewerb',position:'Pl.',played:'Sp',won:'S',drawn:'U',lost:'N',gf:'T+',ga:'T−',gd:'TD',points:'Pkt',total:'Gesamt',show:'Wettbewerbe anzeigen für',empty:'Noch keine Spiele gespielt',without:'Keine Wettbewerbe in dieser Saison.',unavailable:'Die Vereinshistorie ist vorübergehend nicht verfügbar.'},
    es:{season:'Temporada',competition:'Competición',position:'Pos.',played:'PJ',won:'G',drawn:'E',lost:'P',gf:'GF',ga:'GC',gd:'DG',points:'Pts',total:'Total',show:'Mostrar competiciones de',empty:'No se han jugado partidos',without:'Sin competiciones esta temporada.',unavailable:'El historial del club no está disponible temporalmente.'},
    fr:{season:'Saison',competition:'Compétition',position:'Pl.',played:'MJ',won:'V',drawn:'N',lost:'D',gf:'BP',ga:'BC',gd:'DB',points:'Pts',total:'Total',show:'Afficher les compétitions de',empty:'Aucun match joué',without:'Aucune compétition cette saison.',unavailable:'L’historique du club est temporairement indisponible.'},
    it:{season:'Stagione',competition:'Competizione',position:'Pos.',played:'PG',won:'V',drawn:'N',lost:'P',gf:'GF',ga:'GS',gd:'DR',points:'Pt',total:'Totale',show:'Mostra competizioni della',empty:'Nessuna partita giocata',without:'Nessuna competizione in questa stagione.',unavailable:'La storia del club è temporaneamente non disponibile.'}
   }[lang];
   const historySourceVerified=historySnapshot?.source==='authoritative'||
    historySnapshot?.source==='dev'&&historySnapshot.provenance?.kind==='fictional'&&
    historySnapshot.provenance.sourceRef==='dev-fictional-preview'&&historySnapshot.provenance.approved===false;
   const verified=historySourceVerified&&historySnapshot.clubKey===clubKey&&
    ['complete','empty'].includes(historySnapshot.coverage)&&Array.isArray(historySnapshot.seasons);
   const pending=!verified&&historySnapshot?.source!=='unavailable';
   const columns=[words.season,words.competition,words.position,words.played,words.won,words.drawn,words.lost,words.gf,words.ga,words.gd,words.points];
   const heading='<thead><tr>'+columns.map((label,i)=>
    '<th scope="col" class="'+(i===0?'club-history-season-col':i===1?'club-history-name-col':i===2?'club-history-position-col':'club-history-number-col')+'"'+
    (i<3?' aria-label="'+escape(label)+'"':'')+'>'+(i<3?'':escape(label))+'</th>').join('')+'</tr></thead>';
   const columnWidths='<colgroup><col class="club-history-col-season"><col class="club-history-col-name"><col class="club-history-col-position">'+
    Array.from({length:8},()=>'<col class="club-history-col-number">').join('')+'</colgroup>';
   const bar='<span class="club-fp-bar" aria-hidden="true"></span>';
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
     '<td class="club-history-total-label">'+bar+'</td><td></td>'+
     Array.from({length:7},()=>'<td>'+bar+'</td>').join('')+'<td></td></tr>';
    else rows=[...historySnapshot.seasons].reverse().map(entry=>{
     const year=entry.season;
     const members=[...entry.memberships].sort((a,b)=>
      a.category===b.category?a.competitionId.localeCompare(b.competitionId,'en'):a.category==='domestic'?-1:1);
     if(!members.length)return '<tr data-club-history-summary="'+year+'" class="club-history-season-row">'+
      '<th scope="row" class="club-history-season-value">'+escape(words.season)+' '+year+'</th>'+
      '<td class="club-history-empty-season">'+escape(words.empty)+'</td>'+
      '<td></td>'+Array.from({length:8},()=>'<td></td>').join('')+'</tr>';
     const totals=members.reduce((sum,m)=>{
      for(const key of ['played','won','drawn','lost','goalsFor','goalsAgainst','goalDifference'])sum[key]+=m.stats[key];
      return sum;
     },{played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalDifference:0});
     const numeric=[totals.played,totals.won,totals.drawn,totals.lost,totals.goalsFor,
      totals.goalsAgainst,displayNumber(totals.goalDifference),''];
     const summary='<tr class="club-history-season-row" data-club-history-summary="'+year+'">'+
      '<th scope="row" class="club-history-season-value"><button type="button" class="club-history-expand"'+
      ' data-club-history-toggle="'+year+'" aria-expanded="false" aria-label="'+escape(words.show+' '+words.season+' '+year)+'">'+
      '<span class="club-history-chevron" aria-hidden="true"></span>'+escape(words.season)+' '+year+'</button></th>'+
      '<td class="club-history-total-label">'+escape(words.total)+'</td><td></td>'+
      numeric.map(value=>'<td>'+escape(value)+'</td>').join('')+'</tr>';
     const details=members.map(m=>{
      const domestic=m.category==='domestic',def=index.divisions.get(m.competitionId);
      const title=domestic?(def?.name||m.name):m.name;
      const href=routes.buildRoute({kind:domestic?'competition':'cup',id:m.competitionId.toLowerCase(),view:'standings'})+'?season='+year;
      const position=domestic?(m.position===null?'':ordinal(m.position,lang)):
       (internationalStatusLabels[lang][m.cupStatus]||
        (entry.ongoing&&m.stats.played>0?internationalStatusLabels[lang].groupStage:''));
      const stats=m.stats;
      const values=[position,stats.played,stats.won,stats.drawn,stats.lost,stats.goalsFor,stats.goalsAgainst,
       displayNumber(stats.goalDifference),m.points];
      return '<tr class="club-history-competition-row" data-club-history-detail="'+year+'"'+
       ' data-history-competition-row="'+escape(m.competitionId)+'" hidden>'+
       '<td></td><th scope="row" class="club-history-competition-value"><a class="club-history-competition-link" href="'+escape(href)+'" title="'+escape(title)+'"><span class="club-history-competition-text">'+escape(title)+'</span></a></th>'+
       values.map((value,i)=>i===0?'<td'+(value?' title="'+escape(value)+'"':'')+'>'+escape(value)+'</td>':'<td>'+escape(value)+'</td>').join('')+'</tr>';
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
  return '<header class="club-header">'+crest()+'<div><h1 id="club-title" class="app-page-title">'+escape(c.fullName)+'</h1><p class="club-location">'+flag('header')+escape(c.city)+', '+escape(country)+'</p></div></header>'+tabs+
   content;
 }
 return {views,copies,route,render};
});
