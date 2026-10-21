// CLUB-01: derive public presentation data without modifying canonical inputs.
import {readFileSync} from 'node:fs';
import {clubCrestAssets} from './club-crest-assets.mjs';
export function clubOutputs({template,replacements,clubs,divisions,allocations}){
 const descriptions=JSON.parse(readFileSync(new URL('../data/club-descriptions.i18n.json',import.meta.url),'utf8'));
 const byClub=new Map();
 for(const allocation of allocations.allocations){
  const division=divisions.find(d=>d.id===allocation.divisionId);
  for(const id of allocation.clubIds)byClub.set(division.countryId+'-'+id,division.id);
 }
 const manifest={schemaVersion:1,approved:allocations.approved,clubCrests:clubCrestAssets().catalog,
  divisions:divisions.map(({id,name,tier,countryId,countryName})=>({id,name,tier,countryId,countryName})),
  clubs:[...clubs].sort((a,b)=>a.countryId.localeCompare(b.countryId,'en')||a.clubId-b.clubId).map(c=>{
   const native={DE:'de',ENG:'en',ES:'es',FR:'fr',IT:'it',PT:'pt',NL:'nl',BR:'pt'}[c.countryId];
   const localized={...descriptions[c.countryId]?.[c.clubId],[native]:c.description};
   if(!localized||['en','de','es','fr','it'].some(lang=>!localized[lang]))throw Error('Missing club translations');
   return {...c,descriptions:localized,divisionId:byClub.get(c.countryId+'-'+c.clubId)??null};
  })};
 const content='<section id="app-divisions" class="app-view app-world-view" aria-labelledby="club-title">'+
  '<div id="club-page" aria-live="polite"></div>'+
  '<noscript><p>JavaScript is required to display club pages.</p></noscript></section>';
 let html=template;
 for(const [token,value] of Object.entries({...replacements,'@@FA_WORLD_SECTION@@':content}))html=html.replaceAll(token,value);
 html=html.replace('</head>','  <link rel="stylesheet" href="/assets/club-page.css">\n  <script src="/assets/club-model.js" defer></script>\n  <script src="/assets/club-page.js" defer></script>\n</head>');
 html=html.replace('<body class="app-body">','<body class="app-body">\n  <a class="skip-link" href="#main-content">Skip to content</a>');
 return [{path:'clubs/_shared/index.html',content:html},
  {path:'clubs/_shared/manifest.json',content:JSON.stringify(manifest,null,2)+'\n'}];
}
