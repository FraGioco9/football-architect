// CLUB-01: derive public presentation data without modifying canonical inputs.
import {clubCrestAssets} from './club-crest-assets.mjs';
import {loadWorldCatalog} from './load-world-catalog.mjs';
function bootstrapClubFirstPaint(identities, crestAssets, flags){
 const match=location.pathname.match(/^\/clubs\/(it|eng|es|de|fr|pt|nl|br)\/([1-9]|[1-3][0-9]|40)\/(overview|roster|fixtures|stats|history)\/?$/);
 if(!match)return;
 const country=match[1],clubId=match[2],view=match[3],identity=identities[country+'/'+clubId];
 if(!identity)return;
 const names=['overview','roster','fixtures','stats','history'];
 const labels={
  en:['Overview','Roster','Fixtures','Stats','History'],
  de:['Übersicht','Kader','Spielplan','Statistiken','Historie'],
  es:['Resumen','Plantilla','Partidos','Estadísticas','Historial'],
  fr:['Présentation','Effectif','Matchs','Statistiques','Historique'],
  it:['Panoramica','Rosa','Partite','Statistiche','Storia']
 };
 const countries=['it','eng','es','de','fr','pt','nl','br'];
 const countryNames={
  en:['Italy','England','Spain','Germany','France','Portugal','Netherlands','Brazil'],
  de:['Italien','England','Spanien','Deutschland','Frankreich','Portugal','Niederlande','Brasilien'],
  es:['Italia','Inglaterra','España','Alemania','Francia','Portugal','Países Bajos','Brasil'],
  fr:['Italie','Angleterre','Espagne','Allemagne','France','Portugal','Pays-Bas','Brésil'],
  it:['Italia','Inghilterra','Spagna','Germania','Francia','Portogallo','Paesi Bassi','Brasile']
 };
 const crestLabels={en:'Club crest',de:'Vereinswappen',es:'Escudo del club',fr:'Écusson du club',it:'Stemma del club'};
 const locale=Object.hasOwn(labels,document.documentElement.lang)?document.documentElement.lang:'en';
 const [fullName,primaryName,city]=identity;
 const header=document.querySelector('#club-page > .club-header'),tabs=document.querySelector('#club-page > .club-tabs');
 if(!header||!tabs)return;
 header.querySelector('#club-title').textContent=fullName;
 const place=header.querySelector('[data-club-first-paint-location]');
 place.textContent=city+', '+countryNames[locale][countries.indexOf(country)];
 // Parser-time and hydrated header use exactly the same in-document SVG artwork.
 const flagSvg=flags[country.toUpperCase()].replace('class="app-world-flag"','class="app-world-flag club-country-flag"')
  .replace(/id="([^"]+)"/g,(_,id)=>'id="club-header-'+id+'"')
  .replace(/url\(#([^)]+)\)/g,(_,id)=>'url(#club-header-'+id+')')
  .replace(/href="#([^"]+)"/g,(_,id)=>'href="#club-header-'+id+'"');
 header.querySelector('.club-first-paint-flag').outerHTML=flagSvg;
 const crest=header.querySelector('.club-crest'),key=country.toUpperCase()+'-'+clubId;
 crest.dataset.clubCrest=key;
 crest.setAttribute('role','img');
 crest.setAttribute('aria-label',crestLabels[locale]+' — '+primaryName);
 const asset=crestAssets[key];
 if(typeof asset==='string'&&/^assets\/clubs\/(?:IT|ENG|ES|DE|FR|PT|NL|BR)\/(?:[1-9]|[1-3][0-9]|40)\/crest\.svg$/.test(asset)){
  const img=document.createElement('img');
  img.className='app-club-crest-image';img.alt='';img.decoding='sync';img.draggable=false;
  crest.dataset.clubCrestPending='true';
  img.src='/'+asset;
  crest.append(img);
 }
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
 overview.hidden=view!=='overview';other.hidden=view==='overview';
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
 const facts=overview.querySelector('.club-identity .club-facts');
 if(facts){
  for(const [field,value] of Object.entries({nameLabel:primaryName,country:countryNames[locale][countries.indexOf(country)],city})){
   const slot=facts.querySelector('[data-club-first-paint-value="'+field+'"]');
   if(slot)slot.textContent=value;
  }
  // Identity flag is available in the parser-time bundle; it is not an API placeholder.
  const countrySlot=facts.querySelector('[data-club-first-paint-value="country"]');
  if(countrySlot){
   const identityFlag=flags[country.toUpperCase()].replace('class="app-world-flag"','class="app-world-flag club-country-flag"')
    .replace(/id="([^"]+)"/g,(_,id)=>'id="club-identity-'+id+'"')
    .replace(/url\(#([^)]+)\)/g,(_,id)=>'url(#club-identity-'+id+')')
    .replace(/href="#([^"]+)"/g,(_,id)=>'href="#club-identity-'+id+'"');
   const flagWrap=document.createElement('span');
   flagWrap.className='club-country-value';
   flagWrap.innerHTML=identityFlag;
   const countryText=document.createElement('span');
   countryText.textContent=countryNames[locale][countries.indexOf(country)];
   flagWrap.append(countryText);
   countrySlot.replaceChildren(flagWrap);
  }
 }
 header.removeAttribute('aria-hidden');
 document.title=fullName+' · '+labels[locale][activeIndex]+' — Football Architect';
 document.documentElement.dataset.clubIdentityReady='true';
}
function buildClubShell(firstPaintScript){
 return '<section id="app-divisions" class="app-view app-world-view" aria-labelledby="club-title">'+
  '<div id="club-page" aria-live="polite">'+
  '<header class="club-header club-first-paint-header" aria-hidden="true"><span class="app-world-club-crest-placeholder club-crest"></span><div>'+
  '<h1 id="club-title" class="app-page-title"></h1>'+
  '<p class="club-location"><span class="club-first-paint-flag" aria-hidden="true"></span><span data-club-first-paint-location></span></p>'+
  '</div></header>'+
  '<nav class="app-competition-tabs club-tabs" aria-label="Club pages">'+
  ['overview','roster','fixtures','stats','history'].map(view=>'<a class="app-competition-tab" data-club-first-paint-tab="'+view+'">'+view[0].toUpperCase()+view.slice(1)+'</a>').join('')+
  '</nav>'+
  '<div class="club-overview-layout club-first-paint-overview" aria-hidden="true"><div class="club-overview-main"><section class="app-panel club-identity club-first-paint-panel" aria-busy="true"><h2 data-club-first-paint-title="identity">Club identity</h2><dl class="club-facts"><div><dt data-club-first-paint-label="nameLabel">Name</dt><dd data-club-first-paint-value="nameLabel"></dd></div><div><dt data-club-first-paint-label="country">Country</dt><dd data-club-first-paint-value="country"></dd></div><div><dt data-club-first-paint-label="city">City</dt><dd data-club-first-paint-value="city"></dd></div><div><dt data-club-first-paint-label="abbr">Abbreviation</dt><dd><span class="club-fp-bar club-fp-abbr" aria-hidden="true"></span></dd></div><div><dt data-club-first-paint-label="colorsLabel">Colors</dt><dd><span class="club-colors club-fp-colors" aria-hidden="true"><span class="club-color-value"><span class="club-color club-fp-color-swatch" aria-hidden="true"></span><span class="club-fp-bar club-fp-hex" aria-hidden="true"></span></span><span class="club-color-value"><span class="club-color club-fp-color-swatch" aria-hidden="true"></span><span class="club-fp-bar club-fp-hex" aria-hidden="true"></span></span></span></dd></div><div><dt data-club-first-paint-label="nickname">Nickname</dt><dd><span class="club-fp-bar" style="--club-fp-width:65%"></span></dd></div><div><dt data-club-first-paint-label="stadium">Stadium</dt><dd><span class="club-fp-bar" style="--club-fp-width:84%"></span></dd></div><div class="club-fact-rivalries"><dt data-club-first-paint-label="rivalriesLabel">Rivalries</dt><dd><span class="club-fp-bar" style="--club-fp-width:83%"></span></dd></div><div class="club-fact-description"><dt data-club-first-paint-label="descriptionLabel">Description</dt><dd><span class="club-fp-bar" style="--club-fp-width:90%"></span></dd></div></dl></section></div><aside class="app-panel club-kits club-first-paint-panel"><h2 data-club-first-paint-title="kits">Kits</h2><p data-club-first-paint-label="kitsPending">Kits not yet available</p></aside><section class="app-panel club-competition club-first-paint-panel" aria-busy="true"><h2 data-club-first-paint-title="competitions">Competitions</h2><div class="club-competition-layout club-fp-competition"><div class="club-competition-identity"><span class="club-fp-bar" style="--club-fp-width:65%"></span></div><div class="club-competition-summary"><dl class="club-competition-metrics"><div><dt data-club-first-paint-label="statusLabel">Status</dt><dd><span class="club-fp-bar" style="--club-fp-width:45%"></span></dd></div></dl><div class="club-competition-next"><span class="club-competition-label" data-club-first-paint-label="nextMatchLabel">Next match</span><span class="club-fp-bar" style="--club-fp-width:68%"></span></div></div></div></section></div>'+
  '<section class="app-panel club-first-paint-panel club-first-paint-other" aria-hidden="true" hidden></section>'+
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
 const identities=Object.fromEntries(manifest.clubs.map(c=>[c.countryId.toLowerCase()+'/'+c.clubId,[c.fullName,c.primaryName,c.city]]));
 const safeJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
 const firstPaintScript='('+bootstrapClubFirstPaint.toString()+')('+safeJSON(identities)+','+safeJSON(manifest.clubCrests)+','+safeJSON(manifest.countryFlags)+');';
 const staticContent=buildClubShell(firstPaintScript);
 let html=template;
 for(const [token,value] of Object.entries({...replacements,'@@FA_WORLD_SECTION@@':staticContent}))html=html.replaceAll(token,value);
 html=html.replace('class="fa-shell-link is-active" id="app-nav-divisions"','class="fa-shell-link" id="app-nav-divisions"').replace('data-app-view="divisions" aria-current="page"','data-app-view="divisions"');
 html=html.replace('</head>','  <link rel="stylesheet" href="/assets/club-page.css">\n  <script src="/assets/club-model.js" defer></script>\n  <script src="/assets/club-page.js" defer></script>\n</head>');
 html=html.replace('<body class="app-body">','<body class="app-body">\n  <a class="skip-link" href="#main-content">Skip to content</a>');
 return [{path:'clubs/_shared/index.html',content:html},
  {path:'clubs/_shared/manifest.json',content:JSON.stringify(manifest,null,2)+'\n'}];
}
