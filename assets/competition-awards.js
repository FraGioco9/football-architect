/* AWARDS-02: presentation only. No winner calculations, no fabricated recipients. */
(() => {
"use strict";
const panel=document.getElementById("competition-panel-awards");
if(!panel)return;
const tier=window.faCompetitionDivision?.tier ?? (/(?:^|\/)\w+-2(?:\/|$)/i.test(location.pathname)?2:1);
const definitions=[
 {id:"champion",title:"League Champion",key:"awardsChampion",section:"honours",icon:"♛",tier:0},
 {id:"promotion",title:"Direct Promotion",key:"awardsPromotion",section:"honours",icon:"↑",tier:2},
 {id:"playoff",title:"Playoff Winner",key:"awardsPlayoff",section:"honours",icon:"★",tier:2},
 {id:"manager",title:"Manager of the Season",key:"awardsManager",section:"excellence",icon:"✦",tier:0},
 {id:"player",title:"Player of the Season",key:"awardsPlayer",section:"excellence",icon:"✦",tier:0},
 {id:"young",title:"Young Player of the Season",key:"awardsYoung",section:"excellence",icon:"✧",tier:0},
 {id:"boot",title:"Golden Boot",key:"awardsBoot",section:"performance",icon:"◎",tier:0},
 {id:"assists",title:"Top Assists",key:"awardsAssists",section:"performance",icon:"↗",tier:0},
 {id:"glove",title:"Golden Glove",key:"awardsGlove",section:"performance",icon:"◇",tier:0},
 {id:"defender",title:"Defender of the Season",key:"awardsDefender",section:"performance",icon:"⬡",tier:0},
 {id:"midfielder",title:"Midfielder of the Season",key:"awardsMidfielder",section:"performance",icon:"◈",tier:0},
 {id:"forward",title:"Forward of the Season",key:"awardsForward",section:"performance",icon:"➤",tier:0},
 {id:"xi",title:"Team of the Season",key:"awardsXi",section:"xi",icon:"✦",tier:0}
];
const visible=definitions.filter(item=>!item.tier||item.tier===tier);
const el=(tag,cls,text,key)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;if(key)node.dataset.appI18n=key;return node};
const wrap=el("div","fa-awards");
const header=el("header","fa-awards-head");
const heading=el("div");
heading.append(el("p","fa-awards-overline","FOOTBALL ARCHITECT · SEASON HONOURS","awardsHonours"),el("h2","","Season Awards","awardsHeading"),el("p","fa-awards-subtitle","Awards Ceremony","awardsCeremony"));
const status=el("span","fa-awards-status","AWARDS PENDING","awardsStatus");
header.append(heading,status);wrap.append(header);
const notice=el("p","fa-awards-notice","Winners and candidates will appear when verified competition data is available. No awards have been assigned.","awardsNotice");
notice.setAttribute("role","status");wrap.append(notice);
const sectionNames=[["honours","Season Honours","awardsHonours"],["excellence","Individual Excellence","awardsExcellence"],["performance","Performance & Position Awards","awardsPerformance"],["xi","Team of the Season","awardsXi"]];
for(const [id,name,key] of sectionNames){
 const section=el("section","fa-awards-section fa-awards-"+id);section.setAttribute("aria-labelledby","fa-awards-title-"+id);
 const label=el("h3","fa-awards-section-title",name,key);label.id="fa-awards-title-"+id;section.append(label);
 const grid=el("div","fa-awards-grid");
 for(const award of visible.filter(item=>item.section===id)){
   const card=el("article","fa-awards-card fa-awards-card-"+award.id);
   const medallion=el("span","fa-awards-medallion",award.icon);medallion.setAttribute("aria-hidden","true");
   const title=el("h4","fa-awards-card-title",award.title,award.key);
   const placeholder=el("p","fa-awards-card-pending","No verified recipient available","awardsUnverified");
   const chip=el("span","fa-awards-chip","PENDING","awardsPending");
   card.append(medallion,title,placeholder,chip);
   if(id==="xi"){
     const pitch=el("div","fa-awards-pitch");pitch.setAttribute("aria-label","Team of the Season formation placeholder: no players have been selected");pitch.setAttribute("role","img");pitch.dataset.appAria="awardsPitchAria";
     for(const count of [1,4,3,3]){
       const line=el("div","fa-awards-pitch-line");
       for(let i=0;i<count;i++){const spot=el("span","fa-awards-pitch-player");spot.setAttribute("aria-hidden","true");line.append(spot)}
       pitch.append(line);
     }
     card.insertBefore(pitch,placeholder);
   }
   grid.append(card);
 }
 section.append(grid);wrap.append(section);
}
panel.replaceChildren(wrap);
window.faAppRenderLanguage?.();
})();
