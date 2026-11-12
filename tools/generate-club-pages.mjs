import fixtureUI from '../assets/club-fixtures.js';
// CLUB-01: derive public presentation data without modifying canonical inputs.
import {clubCrestAssets} from './club-crest-assets.mjs';
import {loadWorldCatalog} from './load-world-catalog.mjs';
function bootstrapClubFirstPaint(){
 const match=location.pathname.match(/^\/clubs\/(it|eng|es|de|fr|pt|nl|br)\/([1-9]|[1-3][0-9]|40)\/(overview|roster|fixtures|stats|history)\/?$/);
 if(!match)return;
 const country=match[1],clubId=match[2],view=match[3];
 const names=['overview','roster','fixtures','stats','history'];
 const labels={
  en:['Overview','Roster','Fixtures','Stats','History'],
  de:['Übersicht','Kader','Spielplan','Statistiken','Historie'],
  es:['Resumen','Plantilla','Partidos','Estadísticas','Historial'],
  fr:['Présentation','Effectif','Matchs','Statistiques','Historique'],
  it:['Panoramica','Rosa','Partite','Statistiche','Storia']
 };
 const locale=Object.hasOwn(labels,document.documentElement.lang)?document.documentElement.lang:'en';
 const header=document.querySelector('#club-page > .club-header'),tabs=document.querySelector('#club-page > .club-tabs');
 if(!header||!tabs)return;
 const params=new URLSearchParams(location.search),context=new URLSearchParams();
 for(const key of ['season','matchday'])if(params.has(key))context.set(key,params.get(key));
 const activeIndex=names.indexOf(view);
 for(const link of tabs.querySelectorAll('[data-club-first-paint-tab]')){
  const id=link.dataset.clubFirstPaintTab,active=id===view;
  link.href='/clubs/'+country+'/'+clubId+'/'+id+(['fixtures','stats'].includes(id)&&context.size?'?'+context:'');
  link.textContent=labels[locale][names.indexOf(id)];
  link.classList.toggle('is-active',active);
  if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
 }
 const overview=document.querySelector('.club-first-paint-overview'),other=document.querySelector('.club-first-paint-other');
 overview.hidden=view!=='overview';other.hidden=view!=='history';
 const fixtures=document.querySelector('.club-fixtures');fixtures.hidden=view!=='fixtures';
 const fixtureLabels=JSON.parse(fixtures.dataset.labels)[locale];
 fixtures.setAttribute('aria-label',fixtureLabels.competition);
 for(const node of fixtures.querySelectorAll('[data-club-fixture-text]'))node.textContent=fixtureLabels[node.dataset.clubFixtureText];
 const requested=params.get('season'),valid=/^[1-9]\d{0,8}$/.test(requested||'');
  let initial=valid?Number(requested):null;
  // The protected DEV bootstrap exposes the same session season as Standings
  // before the asynchronous world/manifest read. Public default remains unknown
  // until the canonical world clock confirms it; never guess Season 1.
  if(window.faDevPreviewMode===true&&window.faDebugEnabled!==false){
   try{
    const raw=sessionStorage.getItem('football-architect:standings-dev-season');
    const candidate=raw===null||raw.trim()===''?1:Number(raw);
    const limit=Number.isInteger(candidate)&&candidate>=0&&candidate<=4?Math.max(1,candidate):1;
    initial=params.has('season')?(valid?Math.min(limit,initial):1):limit;
   }catch{}
  }
 for(const control of fixtures.querySelectorAll('[data-club-fixture-control]')){const id=control.dataset.clubFixtureControl,label=fixtureLabels[id];control.querySelector('button').setAttribute('aria-label',label);control.querySelector('[role=listbox]').setAttribute('aria-label',label);const value=control.querySelector('[data-club-fixture-value]');value.textContent=id==='season'?fixtureLabels.season+(initial===null?' ':' '+initial):fixtureLabels.all;if(id==='season'&&initial===null){const placeholder=document.createElement('span');placeholder.className='club-fp-bar club-fixture-season-loading';placeholder.setAttribute('aria-hidden','true');value.append(placeholder);}}
 other.setAttribute('aria-hidden',String(view!=='history'));
 if(view==='overview'){overview.removeAttribute('aria-hidden');overview.setAttribute('aria-busy','true');}
 const keyScroll='football-architect:club-tabs-scroll:/clubs/'+country+'/'+clubId;
 try{const raw=sessionStorage.getItem(keyScroll),offset=Number(raw);if(raw!==null&&Number.isFinite(offset)&&offset>=0)tabs.scrollLeft=offset}catch{}
 const chosen=tabs.querySelector('[aria-current="page"]');
 if(chosen){
  const bounds=tabs.getBoundingClientRect(),selected=chosen.getBoundingClientRect();
  if(selected.right>bounds.right)tabs.scrollLeft+=selected.right-bounds.right;
  else if(selected.left<bounds.left)tabs.scrollLeft+=selected.left-bounds.left;
 }
 const max=Math.max(0,tabs.scrollWidth-tabs.clientWidth);
 tabs.dataset.canScrollLeft=String(max>1&&tabs.scrollLeft>1);
 tabs.dataset.canScrollRight=String(max>1&&tabs.scrollLeft<max-1);
 const headings={
  en:['Club identity','Kits','Competitions'],de:['Vereinsidentität','Trikots','Wettbewerbe'],
  es:['Identidad del club','Equipaciones','Competiciones'],fr:['Identité du club','Tenues','Compétitions'],
  it:['Identità del club','Divise','Competizioni']
 };
 for(const heading of overview.querySelectorAll('[data-club-first-paint-title]')){
  const index=['identity','kits','competitions'].indexOf(heading.dataset.clubFirstPaintTitle);
  if(index>=0)heading.textContent=headings[locale][index];
 }
 const factKeys=['nameLabel','country','city','abbr','colorsLabel','nickname','stadium','rivalriesLabel','descriptionLabel','statusLabel','nextMatchLabel','kitsPending'];
 const factLabels={
  en:['Name','Country','City','Abbreviation','Colors','Nickname','Stadium','Rivalries','Description','Status','Next match','Kits not yet available'],
  de:['Name','Land','Stadt','Kürzel','Farben','Spitzname','Stadion','Rivalitäten','Beschreibung','Status','Nächstes Spiel','Noch keine Trikots verfügbar'],
  es:['Nombre','País','Ciudad','Abreviatura','Colores','Apodo','Estadio','Rivalidades','Descripción','Estado','Próximo partido','Equipaciones aún no disponibles'],
  fr:['Nom','Pays','Ville','Abréviation','Couleurs','Surnom','Stade','Rivalités','Description','Statut','Prochain match','Maillots pas encore disponibles'],
  it:['Nome','Paese','Città','Abbreviazione','Colori','Soprannome','Stadio','Rivalità','Descrizione','Stato','Prossima partita','Divise non ancora disponibili']
 };
 for(const label of overview.querySelectorAll('[data-club-first-paint-label]')){
  const index=factKeys.indexOf(label.dataset.clubFirstPaintLabel);
  if(index>=0)label.textContent=factLabels[locale][index];
 }
 const historyLabels={
  en:["Season","Competition","Pos.","MP","W","D","L","GF","GA","GD","Pts"],
  de:["Saison","Wettbewerb","Pl.","Sp","S","U","N","T+","T−","TD","Pkt"],
  es:["Temporada","Competición","Pos.","PJ","G","E","P","GF","GC","DG","Pts"],
  fr:["Saison","Compétition","Pl.","MJ","V","N","D","BP","BC","DB","Pts"],
  it:["Stagione","Competizione","Pos.","PG","V","N","P","GF","GS","DR","Pt"]
 };
 const historyKeys=["season","competition","position","played","won","drawn","lost","gf","ga","gd","points"];
 for(const label of other.querySelectorAll('[data-club-history-label]')){
  const index=historyKeys.indexOf(label.dataset.clubHistoryLabel);
  if(index>=0){
   if(index<3){label.textContent='';label.setAttribute('aria-label',historyLabels[locale][index]);}
   else label.textContent=historyLabels[locale][index];
  }
 }
 header.removeAttribute('aria-hidden');
 document.title=labels[locale][activeIndex]+' — Football Architect';
 document.documentElement.dataset.clubShellReady='true';
}
function buildClubShell(firstPaintScript){
 return '<section id="app-divisions" class="app-view app-world-view" aria-labelledby="club-title">'+
  '<div id="club-page" aria-live="polite">'+
  '<header class="club-header club-first-paint-header" aria-hidden="true"><span class="app-world-club-crest-placeholder club-crest fa-crest-loading"></span><div>'+
  '<h1 id="club-title" class="app-page-title"><span class="club-fp-bar club-fp-header-name" aria-hidden="true"></span></h1>'+
  '<p class="club-location"><span class="club-first-paint-flag" aria-hidden="true"></span><span data-club-first-paint-location><span class="club-fp-bar club-fp-header-location" aria-hidden="true"></span></span></p>'+
  '</div></header>'+
  '<nav class="app-competition-tabs club-tabs" aria-label="Club pages">'+
  ['overview','roster','fixtures','stats','history'].map(view=>'<a class="app-competition-tab" data-club-first-paint-tab="'+view+'">'+view[0].toUpperCase()+view.slice(1)+'</a>').join('')+
  '</nav>'+
  '<div class="club-overview-layout club-first-paint-overview" aria-hidden="true"><div class="club-overview-main"><section class="app-panel club-identity club-first-paint-panel" aria-busy="true"><h2 data-club-first-paint-title="identity">Club identity</h2><dl class="club-facts"><div><dt data-club-first-paint-label="nameLabel">Name</dt><dd data-club-first-paint-value="nameLabel"><span class="club-fp-bar" style="--club-fp-width:62%" aria-hidden="true"></span></dd></div><div><dt data-club-first-paint-label="country">Country</dt><dd data-club-first-paint-value="country"><span class="club-fp-bar" style="--club-fp-width:52%" aria-hidden="true"></span></dd></div><div><dt data-club-first-paint-label="city">City</dt><dd data-club-first-paint-value="city"><span class="club-fp-bar" style="--club-fp-width:42%" aria-hidden="true"></span></dd></div><div><dt data-club-first-paint-label="abbr">Abbreviation</dt><dd><span class="club-fp-bar club-fp-abbr" aria-hidden="true"></span></dd></div><div><dt data-club-first-paint-label="colorsLabel">Colors</dt><dd><span class="club-colors club-fp-colors" aria-hidden="true"><span class="club-color-value"><span class="club-color club-fp-color-swatch" aria-hidden="true"></span><span class="club-fp-bar club-fp-hex" aria-hidden="true"></span></span><span class="club-color-value"><span class="club-color club-fp-color-swatch" aria-hidden="true"></span><span class="club-fp-bar club-fp-hex" aria-hidden="true"></span></span></span></dd></div><div><dt data-club-first-paint-label="nickname">Nickname</dt><dd><span class="club-fp-bar" style="--club-fp-width:65%"></span></dd></div><div><dt data-club-first-paint-label="stadium">Stadium</dt><dd><span class="club-fp-bar" style="--club-fp-width:84%"></span></dd></div><div class="club-fact-rivalries"><dt data-club-first-paint-label="rivalriesLabel">Rivalries</dt><dd><span class="club-fp-bar" style="--club-fp-width:83%"></span></dd></div><div class="club-fact-description"><dt data-club-first-paint-label="descriptionLabel">Description</dt><dd><span class="club-fp-bar" style="--club-fp-width:90%"></span></dd></div></dl></section></div><aside class="app-panel club-kits club-first-paint-panel"><h2 data-club-first-paint-title="kits">Kits</h2><p data-club-first-paint-label="kitsPending">Kits not yet available</p></aside><section class="app-panel club-competition club-first-paint-panel" aria-busy="true"><h2 data-club-first-paint-title="competitions">Competitions</h2><div class="club-competition-list club-fp-competition" aria-busy="true"><div class="club-competition-layout club-competition-entry"><div class="club-competition-identity"><span class="club-competition-logo club-fp-competition-logo" aria-hidden="true"></span><div class="club-competition-copy"><strong class="club-competition-name"><span class="club-fp-bar club-fp-competition-name" aria-hidden="true"></span></strong><span class="club-competition-tier"><span class="club-fp-bar club-fp-competition-tier" aria-hidden="true"></span></span></div></div><div class="club-competition-summary"><dl class="club-competition-metrics"><div><dt data-club-first-paint-label="statusLabel">Status</dt><dd><span class="club-fp-bar club-fp-competition-position" aria-hidden="true"></span></dd></div></dl><div class="club-competition-next"><span class="club-competition-label" data-club-first-paint-label="nextMatchLabel">Next match</span><div class="club-competition-next-content"><span class="club-fp-bar club-fp-competition-fixture" aria-hidden="true"></span><span class="club-fp-bar club-fp-competition-round" aria-hidden="true"></span></div></div></div></div></div></section></div>'+
  '<section class="club-history club-first-paint-panel club-first-paint-other" aria-hidden="true" aria-busy="true" hidden><div class="club-history-table-wrap"><table class="club-history-table" aria-label="History"><colgroup><col class="club-history-col-season"><col class="club-history-col-name"><col class="club-history-col-position"><col class="club-history-col-number"><col class="club-history-col-number"><col class="club-history-col-number"><col class="club-history-col-number"><col class="club-history-col-number"><col class="club-history-col-number"><col class="club-history-col-number"><col class="club-history-col-number"></colgroup><thead><tr><th scope="col" class="club-history-season-col" data-club-history-label="season" aria-label="Season"></th><th scope="col" class="club-history-name-col" data-club-history-label="competition" aria-label="Competition"></th><th scope="col" class="club-history-position-col" data-club-history-label="position" aria-label="Pos."></th><th scope="col" class="club-history-number-col" data-club-history-label="played">MP</th><th scope="col" class="club-history-number-col" data-club-history-label="won">W</th><th scope="col" class="club-history-number-col" data-club-history-label="drawn">D</th><th scope="col" class="club-history-number-col" data-club-history-label="lost">L</th><th scope="col" class="club-history-number-col" data-club-history-label="gf">GF</th><th scope="col" class="club-history-number-col" data-club-history-label="ga">GA</th><th scope="col" class="club-history-number-col" data-club-history-label="gd">GD</th><th scope="col" class="club-history-number-col" data-club-history-label="points">Pts</th></tr></thead><tbody><tr class="club-history-season-row club-history-row-loading" aria-hidden="true"><th scope="row" class="club-history-season-value"><span class="club-history-expand club-history-skeleton-label"><span class="club-history-chevron-space" aria-hidden="true"></span><span class="club-fp-bar" aria-hidden="true"></span></span></th><td class="club-history-total-label"><span class="club-fp-bar" aria-hidden="true"></span></td><td></td><td><span class="club-fp-bar" aria-hidden="true"></span></td><td><span class="club-fp-bar" aria-hidden="true"></span></td><td><span class="club-fp-bar" aria-hidden="true"></span></td><td><span class="club-fp-bar" aria-hidden="true"></span></td><td><span class="club-fp-bar" aria-hidden="true"></span></td><td><span class="club-fp-bar" aria-hidden="true"></span></td><td><span class="club-fp-bar" aria-hidden="true"></span></td><td></td></tr></tbody></table></div></section>'+
  fixtureUI.render().replace('<section class="club-fixtures"', `<section hidden data-labels='${JSON.stringify(fixtureUI.copy).replaceAll("'", "&#39;")}' class="club-fixtures"`)+
  '<script data-fa-club-first-paint>'+firstPaintScript+'</script></div>'+
  '<noscript><p>JavaScript is required to display club pages.</p></noscript></section>';
}
export function clubOutputs({template,replacements,clubs,divisions,allocations,countryFlags}){
 const catalog=loadWorldCatalog();
 const rivalries=catalog.rivalries;
 const manifest={schemaVersion:1,approved:allocations.approved,clubCrests:clubCrestAssets().catalog,countryFlags,rivalries,
  divisions:divisions.map(({id,name,tier,countryId,countryName})=>({id,name,tier,countryId,countryName})),
  clubs:[...clubs].sort((a,b)=>a.countryId.localeCompare(b.countryId,'en')||a.clubId-b.clubId).map(c=>{
   const localized=catalog.getDescriptions(c.countryId+'-'+c.clubId);
   if(!localized||['en','de','es','fr','it'].some(lang=>!localized[lang]))throw Error('Missing club translations');
   return {...c,descriptions:localized,divisionId:catalog.getDivisionForClub(c.countryId+'-'+c.clubId)};
  })};
 const firstPaintScript='('+bootstrapClubFirstPaint.toString()+')();';
 const staticContent=buildClubShell(firstPaintScript);
 let html=template;
 for(const [token,value] of Object.entries({...replacements,'@@FA_WORLD_SECTION@@':staticContent}))html=html.replaceAll(token,value);
 html=html.replace('class="fa-shell-link is-active" id="app-nav-divisions"','class="fa-shell-link" id="app-nav-divisions"').replace('data-app-view="divisions" aria-current="page"','data-app-view="divisions"');
 html=html.replace('</head>','  <link rel="stylesheet" href="/assets/club-page.css">\n  <script src="/assets/club-fixtures.js" defer></script>\n  <script src="/assets/club-model.js" defer></script>\n  <script src="/assets/club-page.js" defer></script>\n</head>');
 html=html.replace('<body class="app-body">','<body class="app-body">\n  <a class="skip-link" href="#main-content">Skip to content</a>');
 return [{path:'clubs/_shared/index.html',content:html},
  {path:'clubs/_shared/manifest.json',content:JSON.stringify(manifest,null,2)+'\n'}];
}
