// CLUB-01: derive public presentation data without modifying canonical inputs.
import {clubCrestAssets} from './club-crest-assets.mjs';
import {loadWorldCatalog} from './load-world-catalog.mjs';
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
 const content='<section id="app-divisions" class="app-view app-world-view" aria-labelledby="club-title">'+
  '<div id="club-page" aria-live="polite"></div>'+
  '<noscript><p>JavaScript is required to display club pages.</p></noscript></section>';
 let html=template;
 for(const [token,value] of Object.entries({...replacements,'@@FA_WORLD_SECTION@@':content}))html=html.replaceAll(token,value);
 html=html.replace('class="fa-shell-link is-active" id="app-nav-divisions"','class="fa-shell-link" id="app-nav-divisions"').replace('data-app-view="divisions" aria-current="page"','data-app-view="divisions"');
 html=html.replace('</head>','  <link rel="stylesheet" href="/assets/club-page.css">\n  <script src="/assets/club-model.js" defer></script>\n  <script src="/assets/club-page.js" defer></script>\n</head>');
 html=html.replace('<body class="app-body">','<body class="app-body">\n  <a class="skip-link" href="#main-content">Skip to content</a>');
 return [{path:'clubs/_shared/index.html',content:html},
  {path:'clubs/_shared/manifest.json',content:JSON.stringify(manifest,null,2)+'\n'}];
}
