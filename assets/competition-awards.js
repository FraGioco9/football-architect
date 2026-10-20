/* AWARDS-02: presentation only. No winner calculations, no fabricated recipients. */
(() => {
"use strict";
const panel=document.getElementById("competition-panel-awards");
if(!panel)return;
const tier=window.faCompetitionDivision?.tier ?? (/(?:^|\/)\w+-2(?:\/|$)/i.test(location.pathname)?2:1);
const definitions=[
 {id:"champion",title:"League Champion",key:"awardsChampion",section:"honours",tier:0},
 {id:"promotion",title:"Direct Promotion",key:"awardsPromotion",section:"honours",tier:2},
 {id:"playoff",title:"Playoff Winner",key:"awardsPlayoff",section:"honours",tier:2},
 {id:"manager",title:"Manager of the Season",key:"awardsManager",section:"excellence",tier:0},
 {id:"player",title:"Player of the Season",key:"awardsPlayer",section:"excellence",tier:0},
 {id:"young",title:"Young Player of the Season",key:"awardsYoung",section:"excellence",tier:0},
 {id:"boot",title:"Golden Boot",key:"awardsBoot",section:"performance",tier:0},
 {id:"assists",title:"Top Assists",key:"awardsAssists",section:"performance",tier:0},
 {id:"glove",title:"Golden Glove",key:"awardsGlove",section:"performance",tier:0},
 {id:"defender",title:"Defender of the Season",key:"awardsDefender",section:"performance",tier:0},
 {id:"midfielder",title:"Midfielder of the Season",key:"awardsMidfielder",section:"performance",tier:0},
 {id:"forward",title:"Forward of the Season",key:"awardsForward",section:"performance",tier:0},
 {id:"xi",title:"Team of the Season",key:"awardsXi",section:"xi",tier:0}
];
const visible=definitions.filter(item=>!item.tier||item.tier===tier);
const el=(tag,cls,text,key)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;if(key)node.dataset.appI18n=key;return node};
const svgNS="http://www.w3.org/2000/svg";
const iconPaths={
 champion:["M5 18h22l3-14-10 7-4-9-4 9L2 4z","M7 23h18v4H7z"],
 promotion:["M16 3L7 13h6v16h6V13h6z"],
 playoff:["M16 2l4.4 9 9.9 1.4-7.2 7 1.7 9.9L16 24.7l-8.8 4.6 1.7-9.9-7.2-7 9.9-1.4z"],
 manager:["M7 6h18v4c0 5-3.5 8-9 8s-9-3-9-8z","M7 8H3v4c0 3 2 5 6 5M25 8h4v4c0 3-2 5-6 5","M16 18v6m-7 4h14m-11-4h8"],
 player:["M16 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8","M8 27v-5c0-4 3-7 8-7s8 3 8 7v5z","M3 12l3-3m20 0 3 3"],
 young:["M16 4l3.5 7.5 8.5 1-6.2 6 1.5 8.5-7.3-4-7.3 4 1.5-8.5-6.2-6 8.5-1z"],
 boot:["M7 3h10v10l5 5h6v7H4v-6l3-3z","M5 25h23"],
 assists:["M4 25l8-8 5 4 11-13","M20 8h8v8","M3 7h8v8H3z"],
 glove:["M9 28V12c0-3 4-3 4 0V5c0-3 4-3 4 0v7-5c0-3 4-3 4 0v7-3c0-3 4-3 4 0v10c0 5-4 8-9 8z"],
 defender:["M16 3l12 5v8c0 7-4.5 11-12 14C8.5 27 4 23 4 16V8z","M11 16l4 4 7-8"],
 midfielder:["M16 3L29 16 16 29 3 16z","M16 9v14M9 16h14"],
 forward:["M4 28L28 4l-4 13-7-7z","M4 19v9h9"],
 xi:["M6 5h20v22H6z","M16 5v22M6 16h20","M16 10a6 6 0 1 0 0 12 6 6 0 0 0 0-12"]
};
const createIcon=id=>{
 const svg=document.createElementNS(svgNS,"svg");svg.setAttribute("viewBox","0 0 32 32");svg.setAttribute("focusable","false");svg.setAttribute("aria-hidden","true");svg.classList.add("fa-awards-symbol");
 for(const d of iconPaths[id]){const path=document.createElementNS(svgNS,"path");path.setAttribute("d",d);svg.append(path)}
 return svg;
};
const wrap=el("div","fa-awards");
const header=el("header","fa-awards-head");
const status=el("span","fa-awards-status","AWARDS PENDING","awardsStatus");
header.append(status);wrap.append(header);
const notice=el("p","fa-awards-notice","Winners and candidates will appear when verified competition data is available. No awards have been assigned.","awardsNotice");
notice.setAttribute("role","status");wrap.append(notice);
const sectionNames=[["honours",null,null],["excellence","Individual Excellence","awardsExcellence"],["performance","Performance & Position Awards","awardsPerformance"],["xi","Team of the Season","awardsXi"]];
for(const [id,name,key] of sectionNames){
 const section=el("section","fa-awards-section fa-awards-"+id);section.setAttribute("aria-labelledby","fa-awards-title-"+id);
 if(name){const label=el("h3","fa-awards-section-title",name,key);label.id="fa-awards-title-"+id;section.append(label)}else section.removeAttribute("aria-labelledby");
 const grid=el("div","fa-awards-grid");
 for(const award of visible.filter(item=>item.section===id)){
   const card=el("article","fa-awards-card fa-awards-card-"+award.id);
   const medallion=el("span","fa-awards-medallion");medallion.setAttribute("aria-hidden","true");medallion.append(createIcon(award.id));
   const title=el("h4","fa-awards-card-title",award.title,award.key);
   const chip=el("span","fa-awards-chip","PENDING","awardsPending");
   card.append(medallion,title,chip);
   if(id==="xi"){
     const pitch=el("div","fa-awards-pitch");pitch.setAttribute("aria-label","Team of the Season formation placeholder: no players have been selected");pitch.setAttribute("role","img");pitch.dataset.appAria="awardsPitchAria";
     for(const count of [1,4,3,3]){
       const line=el("div","fa-awards-pitch-line");
       for(let i=0;i<count;i++){const spot=el("span","fa-awards-pitch-player");spot.setAttribute("aria-hidden","true");line.append(spot)}
       pitch.append(line);
     }
     card.insertBefore(pitch,chip);
   }
   grid.append(card);
 }
 section.append(grid);wrap.append(section);
}
panel.replaceChildren(wrap);
window.faAppRenderLanguage?.();
})();
