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
 champion:["M5 13h22l-2.5 11h-17z","M5 13 3 7l7 5 6-8 6 8 7-5-2 6","M10 27h12"],
 promotion:["M16 3 5 15h7v13h8V15h7z","M12 15h8"],
 playoff:["M16 3l3.8 8 8.7 1.2-6.3 6.1 1.5 8.7L16 23l-7.7 4 1.5-8.7-6.3-6.1 8.7-1.2z","M12 17l3 3 5-6"],
 manager:["M16 4a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9","M6 28v-4c0-5 4.5-8 10-8s10 3 10 8v4","M11 17l5 5 5-5","M16 22v6"],
 player:["M16 4a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9","M6 28v-4c0-5 4.5-8 10-8s10 3 10 8v4","M13 19h6l-3 4z"],
 young:["M15 4a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9","M5 28v-4c0-5 4.5-8 10-8 2 0 3.5.3 5 1","M24 17l1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z"],
 boot:["M8 5h9v10l5 5h6v6H4v-6l4-4z","M8 10h9M8 15h9M5 26h23"],
 assists:["M5 25l8-9 5 4 9-10","M20 10h7v7","M5 7h7v7H5z","M12 10h5"],
 glove:["M8 27V13a2 2 0 0 1 4 0V7a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v8-4a2 2 0 0 1 4 0v11c0 5-4 8-9 8z","M12 21l3 3 5-5"],
 defender:["M16 3l11 5v8c0 6-4 10.5-11 13C9 26.5 5 22 5 16V8z","M10 17l4 4 8-9"],
 midfielder:["M16 4 28 16 16 28 4 16z","M16 9v14M9 16h14","M11 11l10 10m0-10L11 21"],
 forward:["M5 25 26 5l-2 12-7-7z","M5 17v10h10","M13 23l8-8"],
 xi:["M7 7l4-3v24","M5 10l6-6","M21 7l4-3v24","M19 10l6-6"]
};
const createIcon=id=>{
 const svg=document.createElementNS(svgNS,"svg");svg.setAttribute("viewBox","0 0 32 32");svg.setAttribute("focusable","false");svg.setAttribute("aria-hidden","true");svg.classList.add("fa-awards-symbol");
 for(const d of iconPaths[id]){const path=document.createElementNS(svgNS,"path");path.setAttribute("d",d);svg.append(path)}
 return svg;
};
const wrap=el("div","fa-awards");

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
