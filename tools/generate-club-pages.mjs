// CLUB-01: derive public presentation data without modifying canonical inputs.
import {clubCrestAssets} from './club-crest-assets.mjs';
import {loadWorldCatalog} from './load-world-catalog.mjs';
function bootstrapClubFirstPaint(identities, crestAssets){
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
 // Load only the visited club's existing published SVG instead of all eight
 // serialized flag drawings; the image reserves the original 25×20 pixel slot.
 const flagName={it:'it',eng:'gb-eng',es:'es',de:'de',fr:'fr',pt:'pt',nl:'nl',br:'br'}[country];
 const flag=document.createElement('img');
 flag.className='app-world-flag club-country-flag';
 flag.width=25;flag.height=20;flag.alt='';flag.decoding='sync';flag.draggable=false;
 flag.src='/assets/flags/'+flagName+'.svg';
 header.querySelector('.club-first-paint-flag').append(flag);
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
  '<p class="club-header-division"></p></div></header>'+
  '<nav class="app-competition-tabs club-tabs" aria-label="Club pages">'+
  ['overview','roster','fixtures','stats','history'].map(view=>'<a class="app-competition-tab" data-club-first-paint-tab="'+view+'">'+view[0].toUpperCase()+view.slice(1)+'</a>').join('')+
  '</nav>'+
  '<div class="club-overview-layout club-first-paint-overview" aria-hidden="true"><div class="club-overview-main"><section class="app-panel club-first-paint-panel"></section></div><aside class="app-panel club-first-paint-panel"></aside><section class="app-panel club-competition club-first-paint-panel"></section></div>'+
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
 const firstPaintScript='('+bootstrapClubFirstPaint.toString()+')('+safeJSON(identities)+','+safeJSON(manifest.clubCrests)+');';
 const staticContent=buildClubShell(firstPaintScript);
 let html=template;
 for(const [token,value] of Object.entries({...replacements,'@@FA_WORLD_SECTION@@':staticContent}))html=html.replaceAll(token,value);
 html=html.replace('class="fa-shell-link is-active" id="app-nav-divisions"','class="fa-shell-link" id="app-nav-divisions"').replace('data-app-view="divisions" aria-current="page"','data-app-view="divisions"');
 html=html.replace('</head>','  <link rel="stylesheet" href="/assets/club-page.css">\n  <script src="/assets/club-model.js" defer></script>\n  <script src="/assets/club-page.js" defer></script>\n</head>');
 html=html.replace('<body class="app-body">','<body class="app-body">\n  <a class="skip-link" href="#main-content">Skip to content</a>');
 return [{path:'clubs/_shared/index.html',content:html},
  {path:'clubs/_shared/manifest.json',content:JSON.stringify(manifest,null,2)+'\n'}];
}
