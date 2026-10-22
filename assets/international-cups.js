/* INT-24 UI localization. Display only; no sporting state changes. */
(()=>{"use strict";
const copy={"en":["International Cups","24 clubs · 8 countries","24 clubs qualify from eight countries. The six-round league phase is followed by playoffs, quarterfinals, semifinals and one neutral-site final. Season fixtures and results are not yet available.","The 24-club league table will appear when season standings are available.","The six league rounds and knockout fixtures will appear when the official schedule is generated."],"it":["Coppe internazionali","24 club · 8 Paesi","Si qualificano 24 club da otto Paesi. La fase campionato di sei turni precede playoff, quarti, semifinali e finale in campo neutro. Calendario e risultati non sono ancora disponibili.","La classifica a 24 club sarà disponibile quando inizierà la stagione.","Le sei giornate e le partite a eliminazione diretta saranno disponibili dopo la generazione del calendario."],"de":["Internationale Pokale","24 Klubs · 8 Länder","24 Klubs aus acht Ländern qualifizieren sich. Auf sechs Ligaspieltage folgen Playoffs, Viertelfinale, Halbfinale und ein Finale auf neutralem Platz. Spielplan und Ergebnisse sind noch nicht verfügbar.","Die Tabelle mit 24 Klubs erscheint, sobald Saisonergebnisse vorliegen.","Die sechs Ligaspieltage und K.-o.-Spiele erscheinen, sobald der Spielplan erstellt ist."],"es":["Copas internacionales","24 clubes · 8 países","Se clasifican 24 clubes de ocho países. Tras seis jornadas de liga llegan los playoffs, cuartos, semifinales y una final en sede neutral. Todavía no hay calendario ni resultados.","La tabla de 24 clubes aparecerá cuando haya resultados de la temporada.","Las seis jornadas y las eliminatorias aparecerán cuando se genere el calendario."],"fr":["Coupes internationales","24 clubs · 8 pays","24 clubs de huit pays se qualifient. Après six journées de ligue viennent les barrages, quarts, demi-finales et une finale sur terrain neutre. Calendrier et résultats ne sont pas encore disponibles.","Le classement des 24 clubs apparaîtra lorsque les résultats seront disponibles.","Les six journées et les matchs à élimination directe apparaîtront une fois le calendrier établi."]};
const apply=()=>{
 const lang=Object.hasOwn(copy,document.documentElement.lang)?document.documentElement.lang:"en",t=copy[lang];
 const heading=document.getElementById("international-cups-heading");if(heading)heading.textContent=t[0];
 for(const link of document.querySelectorAll('a[href="/competitions/sovereign-cup"],a[href="/competitions/federation-cup"]')){const small=link.querySelector("small");if(small)small.textContent=t[1];}
 for(const node of document.querySelectorAll('[data-cup-copy="category"]'))node.textContent=t[0];
 for(const node of document.querySelectorAll('[data-cup-copy="summary"]'))node.textContent=t[1];
 const body=document.getElementById("app-standings-body");
 if(body){
  let row=body.querySelector("td");
  if(!row){const tr=document.createElement("tr");row=document.createElement("td");row.colSpan=11;row.className="app-competition-empty-row";tr.append(row);body.append(tr)}
  row.textContent=t[3];
 }
 const format=document.querySelector('#rules-format p');if(format)format.textContent=t[2];
 const postseason=document.querySelector('#competition-panel-postseason p');if(postseason){postseason.removeAttribute('data-app-i18n');postseason.textContent=t[4]}

};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply,{once:true});else apply();
new MutationObserver(apply).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
})();
