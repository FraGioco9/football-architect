/* CLUB-01: pure presentation shared by generation tests and the browser. */
((root,factory)=>{
 const model=factory();root.faClubModel=model;
 if(typeof module!=='undefined'&&module.exports)module.exports=model;
})(typeof window!=='undefined'?window:globalThis,()=>{
 'use strict';
 const views=['overview','roster','fixtures','stats','history'];
 const keys=['overview','roster','fixtures','stats','history','identity','profile','competition','primaryName','fullName','compactName','abbr','nickname','city','country','primaryColor','secondaryColor','stadium','division','provisional','outside','emptyRoster','emptyFixtures','emptyStats','emptyHistory','navigation','crest','error','skip'];
 const rows={
  en:['Overview','Roster','Fixtures','Stats','History','Club identity','Club profile','Competition','Primary name','Full name','Compact name','Abbreviation','Nickname','City','Country','Primary color','Secondary color','Stadium','Division','Provisional allocation · no active season','Outside the current playing structure','No roster is available.','No fixtures are available.','No statistics are available.','No club history is available.','Club pages','Club crest placeholder','Club information is unavailable. Please reload the page.','Skip to content'],
  de:['Übersicht','Kader','Spielplan','Statistiken','Historie','Vereinsidentität','Vereinsprofil','Wettbewerb','Hauptname','Vollständiger Name','Kurzname','Kürzel','Spitzname','Stadt','Land','Primärfarbe','Sekundärfarbe','Stadion','Liga','Vorläufige Zuordnung · keine aktive Saison','Außerhalb der aktuellen Spielstruktur','Kein Kader verfügbar.','Kein Spielplan verfügbar.','Keine Statistiken verfügbar.','Keine Vereinshistorie verfügbar.','Vereinsseiten','Platzhalter für Vereinswappen','Vereinsinformationen sind nicht verfügbar. Bitte lade die Seite erneut.','Zum Inhalt springen'],
  es:['Resumen','Plantilla','Partidos','Estadísticas','Historial','Identidad del club','Perfil del club','Competición','Nombre principal','Nombre completo','Nombre corto','Abreviatura','Apodo','Ciudad','País','Color primario','Color secundario','Estadio','División','Asignación provisional · sin temporada activa','Fuera de la estructura de juego actual','No hay plantilla disponible.','No hay partidos disponibles.','No hay estadísticas disponibles.','No hay historial del club disponible.','Páginas del club','Escudo provisional del club','La información del club no está disponible. Recarga la página.','Saltar al contenido'],
  fr:['Présentation','Effectif','Matchs','Statistiques','Historique','Identité du club','Profil du club','Compétition','Nom principal','Nom complet','Nom court','Abréviation','Surnom','Ville','Pays','Couleur principale','Couleur secondaire','Stade','Division','Affectation provisoire · aucune saison active','Hors de la structure de jeu actuelle','Aucun effectif disponible.','Aucun match disponible.','Aucune statistique disponible.','Aucun historique du club disponible.','Pages du club','Écusson provisoire du club','Les informations du club sont indisponibles. Rechargez la page.','Aller au contenu'],
  it:['Panoramica','Rosa','Partite','Statistiche','Storia','Identità del club','Profilo del club','Competizione','Nome principale','Nome completo','Nome breve','Abbreviazione','Soprannome','Città','Paese','Colore primario','Colore secondario','Stadio','Divisione','Assegnazione provvisoria · nessuna stagione attiva','Fuori dalla struttura di gioco corrente','Nessuna rosa disponibile.','Nessuna partita disponibile.','Nessuna statistica disponibile.','Nessuna storia del club disponibile.','Pagine del club','Segnaposto dello stemma del club','Le informazioni del club non sono disponibili. Ricarica la pagina.','Vai al contenuto']
 };
 const copies=Object.fromEntries(Object.entries(rows).map(([lang,row])=>[lang,Object.fromEntries(keys.map((key,i)=>[key,row[i]]))]));
 const countryNames={en:['Italy','England','Spain','Germany','France','Portugal','Netherlands','Brazil'],de:['Italien','England','Spanien','Deutschland','Frankreich','Portugal','Niederlande','Brasilien'],es:['Italia','Inglaterra','España','Alemania','Francia','Portugal','Países Bajos','Brasil'],fr:['Italie','Angleterre','Espagne','Allemagne','France','Portugal','Pays-Bas','Brésil'],it:['Italia','Inghilterra','Spagna','Germania','Francia','Portogallo','Paesi Bassi','Brasile']};
 const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
 const flagCodes={IT:'it',ENG:'gb',ES:'es',DE:'de',FR:'fr',PT:'pt',NL:'nl',BR:'br'};
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function route(path){
  const m=path.match(/^\/clubs\/(it|eng|es|de|fr|pt|nl|br)\/(0[1-9]|[1-3][0-9]|40)\/(overview|roster|fixtures|stats|history)$/);
  return m?{countryId:m[1].toUpperCase(),clubId:Number(m[2]),view:m[3],base:'/clubs/'+m[1]+'/'+m[2]}:null;
 }
 function render(manifest,selected,language='en',search=''){
  const lang=Object.hasOwn(copies,language)?language:'en',t=copies[lang];
  const c=manifest.clubs.find(c=>c.countryId===selected.countryId&&c.clubId===selected.clubId);
  if(!c)throw Error('Unknown club identity');
  const country=countryNames[lang][countries.indexOf(c.countryId)];
  const division=manifest.divisions.find(d=>d.id===c.divisionId);
  const link=division?'/competitions/'+division.id.toLowerCase()+'/overview':null;
  const fact=(label,value)=>'<div><dt>'+escape(t[label])+'</dt><dd>'+value+'</dd></div>';
  const crest=()=>'<span class="app-world-club-crest-placeholder club-crest" data-club-crest="'+escape(c.countryId+'-'+c.clubId)+'" role="img" aria-label="'+escape(t.crest)+'"></span>';
  const divisionValue=division?'<a class="app-link" href="'+link+'">'+escape(division.name)+'</a>':escape(t.outside);
  const params=new URLSearchParams(search);
  // Navigation carries existing temporal context only into Fixtures/Stats. No clock is created here.
  const temporal=new URLSearchParams();
  for(const key of ['season','matchday'])if(params.has(key))temporal.set(key,params.get(key));
  const tabs='<nav class="app-competition-tabs club-tabs" aria-label="'+escape(t.navigation)+'">'+views.map(view=>{
   const suffix=['fixtures','stats'].includes(view)&&temporal.size?'?'+temporal:'';
   return '<a class="app-competition-tab'+(view===selected.view?' is-active':'')+'" href="'+selected.base+'/'+view+suffix+'"'+(view===selected.view?' aria-current="page"':'')+'>'+escape(t[view])+'</a>';
  }).join('')+'</nav>';
  const swatch=key=>{
   if(!/^#[0-9A-F]{6}$/.test(c[key]))throw Error('Invalid canonical color');
   return '<span class="club-color" style="--club-color:'+c[key]+'" aria-hidden="true"></span><span>'+c[key]+'</span>';
  };
  let content;
  if(selected.view==='overview'){
   content='<div class="club-overview-grid"><section class="app-panel" aria-labelledby="club-identity-title"><h2 id="club-identity-title">'+escape(t.identity)+'</h2><dl class="club-facts">'+
    ['primaryName','fullName','compactName','abbr','nickname','city'].map(key=>fact(key,escape(c[key]))).join('')+fact('country',escape(country))+fact('primaryColor',swatch('primaryColor'))+fact('secondaryColor',swatch('secondaryColor'))+'</dl></section>'+
    '<section class="app-panel" aria-labelledby="club-profile-title"><h2 id="club-profile-title">'+escape(t.profile)+'</h2>'+crest()+'<p class="club-description">'+escape(c.descriptions[lang])+'</p><dl class="club-facts">'+fact('stadium',escape(c.stadiumName))+fact('division',divisionValue)+'</dl></section>'+
    '<section class="app-panel club-competition" aria-labelledby="club-competition-title"><h2 id="club-competition-title">'+escape(t.competition)+'</h2><p>'+divisionValue+'</p>'+(division?'<p class="club-placement">'+escape(t.provisional)+'</p>':'')+'</section></div>';
  }else{
   const empty='empty'+selected.view[0].toUpperCase()+selected.view.slice(1);
   content='<section class="app-panel club-empty"><p>'+escape(t[empty])+'</p></section>';
  }
  return '<header class="club-header">'+crest()+'<div><h1 id="club-title" class="app-page-title">'+escape(c.fullName)+'</h1><p class="club-location"><img class="club-country-flag" src="/assets/flags/'+flagCodes[c.countryId]+'.svg" alt="'+escape(country)+'" width="24" height="18">'+escape(c.city)+'</p><p class="club-header-division">'+divisionValue+'</p></div></header>'+tabs+
   '<h2 id="club-view-title" class="club-view-title">'+escape(t[selected.view])+'</h2>'+content;
 }
 return {views,copies,route,render};
});
