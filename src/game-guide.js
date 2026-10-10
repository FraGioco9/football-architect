import {icon} from './icons.js';
import {COUNTRIES,COMPETITIONS} from './leagues.js';
import {countryFlag} from './ui-pages.js';

/* Standalone, read-only asset atlas. Division identities are not published assets yet.
   Names, IDs, capacities and populated clubs are read from the canonical catalog. */
const COPY=Object.freeze({
 it:{
  eyebrow:'ATLANTE DEL GIOCO',
  title:"L'universo di Football Architect",
  introduction:"Una raccolta delle identità che compongono il mondo di Football Architect. Il primo capitolo è dedicato alle divisioni: nomi, Paesi, livelli e informazioni del catalogo.",
  sectionTitle:'Divisioni',
  sectionIntro:'Otto Paesi, due divisioni per Paese. Nomi e codici sono già definiti, mentre gli stemmi originali delle competizioni devono ancora essere progettati.',
  countries:'Paesi',
  divisions:'Divisioni',
  tiers:'Livelli',
  index:'Esplora per Paese',
  divisionAria:'Divisioni per Paese',
  level:'Livello',
  places:'Capienza',
  clubs:'Club catalogati',
  clubsNote:'La capacità prevista è di 20 club per divisione; solo le prime divisioni hanno oggi 20 squadre censite.',
  notArtwork:'Emblema non ancora definito',
  defined:'Catalogata con club',
  catalogOnly:'Solo catalogo',
  firstInfo:'Prima divisione presente nel gioco.',
  secondInfo:'Seconda divisione definita nel catalogo, senza club iscritti e non ancora giocabile.',
  designTitle:'Identità grafiche in progettazione',
  designIntro:'Le denominazioni mostrate sono canoniche, ma non esiste ancora un pack approvato di 16 stemmi. Questa pagina non rappresenta bozzetti come identità definitive.',
  designPoints:[
   'Ogni divisione avrà uno stemma originale, distinto da quelli delle competizioni reali.',
   'Le due divisioni dello stesso Paese dovranno essere riconoscibili come parte della stessa famiglia, ma distinguibili anche senza scritte.',
   'Colori, tipografia e versioni SVG saranno definiti in una fase di progettazione distinta.'
  ],
  back:'Torna al menu',
  closing:'Le informazioni sono lette dal catalogo del gioco. Questa pagina è solo descrittiva: non abilita nuove divisioni e non modifica le carriere.'
 },
 en:{
  eyebrow:'GAME ATLAS',
  title:'The world of Football Architect',
  introduction:"A reference collection of the identities that make up Football Architect's world. The first chapter covers divisions: their names, countries, tiers and catalog information.",
  sectionTitle:'Divisions',
  sectionIntro:'Eight countries, two divisions per country. Names and IDs are already defined, while the competitions’ original crests have yet to be designed.',
  countries:'Countries',
  divisions:'Divisions',
  tiers:'Tiers',
  index:'Explore by country',
  divisionAria:'Divisions by country',
  level:'Tier',
  places:'Capacity',
  clubs:'Catalogued clubs',
  clubsNote:'Each division has a planned capacity of 20 clubs; only first divisions currently have 20 registered clubs.',
  notArtwork:'Crest not yet defined',
  defined:'Clubs catalogued',
  catalogOnly:'Catalog only',
  firstInfo:'First division currently featured in the game.',
  secondInfo:'Second division defined in the catalog, without assigned clubs and not yet playable.',
  designTitle:'Visual identities in design',
  designIntro:'The names displayed are canonical, but no approved pack of 16 division crests exists yet. This page does not present concepts as finished identities.',
  designPoints:[
   'Each division will have an original crest, distinct from real-world competition branding.',
   'Both divisions in a country should feel related while remaining distinguishable even without lettering.',
   'Colors, typography and SVG variants will be specified in a separate design phase.'
  ],
  back:'Back to menu',
  closing:'Information comes from the game catalog. This is a reference-only page: it does not unlock divisions or change careers.'
 }
});

const esc=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number=value=>String(value);

function divisionCard(item,c){
 const isFirst=item.tier===1;
 return '<article class="guide-division-card" aria-labelledby="guide-division-'+esc(item.id)+'">'+
  '<div class="guide-division-symbol"><div class="guide-unassigned-crest" aria-hidden="true">—</div><span>'+esc(c.notArtwork)+'</span></div>'+
  '<div class="guide-division-content">'+
   '<div class="guide-division-meta"><span>'+esc(c.level)+' '+number(item.tier)+'</span><code>'+esc(item.id)+'</code></div>'+
   '<h3 id="guide-division-'+esc(item.id)+'">'+esc(item.name)+'</h3>'+
   '<p class="guide-division-status">'+esc(isFirst?c.defined:c.catalogOnly)+'</p>'+
   '<dl class="guide-division-facts">'+
    '<div><dt>'+esc(c.places)+'</dt><dd>'+number(item.capacity)+'</dd></div>'+
    '<div><dt>'+esc(c.clubs)+'</dt><dd>'+number(item.clubCount)+'</dd></div>'+
   '</dl><p class="guide-division-description">'+esc(isFirst?c.firstInfo:c.secondInfo)+'</p>'+
  '</div></article>';
}
export function guidePage(lang='it'){
 const language=lang==='en'?'en':'it',c=COPY[language];
 const countryLinks=COUNTRIES.map(country=>
  '<a href="#guide-country-'+esc(country.id)+'">'+countryFlag(country.id)+
  '<span>'+esc(country.country[language])+'</span>'+icon('chevron-right',15)+'</a>'
 ).join('');
 const countrySections=COUNTRIES.map(country=>{
  const competitions=COMPETITIONS.filter(item=>item.countryId===country.id);
  return '<section class="guide-country-group" id="guide-country-'+esc(country.id)+'" aria-labelledby="guide-country-title-'+esc(country.id)+'">'+
   '<div class="guide-country-heading">'+countryFlag(country.id)+
    '<div><span class="guide-country-code">'+esc(country.id)+'</span>'+
    '<h2 id="guide-country-title-'+esc(country.id)+'">'+esc(country.country[language])+'</h2></div>'+
   '</div><div class="guide-division-grid">'+competitions.map(item=>divisionCard(item,c)).join('')+'</div></section>';
 }).join('');
 return '<div class="game-guide guide-asset-page">'+
  '<header class="guide-header fa-page-heading"><button type="button" class="page-back" data-action="home">'+
   icon('arrow-left',17)+esc(c.back)+'</button><span class="kicker">'+esc(c.eyebrow)+'</span>'+
   '<h1 class="fa-page-title">'+esc(c.title)+'</h1><p>'+esc(c.introduction)+'</p></header>'+
  '<section class="guide-overview" aria-label="'+esc(c.sectionTitle)+'">'+
   '<div><strong>'+number(COUNTRIES.length)+'</strong><span>'+esc(c.countries)+'</span></div>'+
   '<div><strong>'+number(COMPETITIONS.length)+'</strong><span>'+esc(c.divisions)+'</span></div>'+
   '<div><strong>2</strong><span>'+esc(c.tiers)+'</span></div></section>'+
  '<section class="guide-division-overview" id="guide-divisions" aria-labelledby="guide-divisions-title">'+
   '<div class="guide-section-heading"><span class="kicker">'+esc(c.eyebrow)+'</span>'+
    '<h2 id="guide-divisions-title">'+esc(c.sectionTitle)+'</h2><p>'+esc(c.sectionIntro)+'</p></div>'+
   '<nav class="guide-nav panel" aria-label="'+esc(c.index)+'"><h2>'+esc(c.index)+'</h2>'+
    '<div class="guide-nav-links">'+countryLinks+'</div></nav>'+
   '<div class="guide-countries" aria-label="'+esc(c.divisionAria)+'">'+countrySections+'</div>'+
   '<p class="guide-catalog-note">'+icon('shield',16)+'<span>'+esc(c.clubsNote)+'</span></p>'+
  '</section>'+
  '<section class="panel guide-design" aria-labelledby="guide-design-title"><div class="guide-design-heading">'+
    icon('flag',20)+'<h2 id="guide-design-title">'+esc(c.designTitle)+'</h2></div>'+
   '<p>'+esc(c.designIntro)+'</p><ul>'+c.designPoints.map(point=>'<li>'+esc(point)+'</li>').join('')+'</ul></section>'+
  '<p class="guide-footnote">'+icon('shield',17)+'<span>'+esc(c.closing)+'</span></p>'+
 '</div>';
}
