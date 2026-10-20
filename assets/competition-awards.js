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
 champion:["M4 10l6.5 6L16 6l5.5 10L28 10l-2.5 14h-19Z","M7 27h18","M5.3 9a1.3 1.3 0 1 0-2.6 0 1.3 1.3 0 1 0 2.6 0Z","M17.3 5a1.3 1.3 0 1 0-2.6 0 1.3 1.3 0 1 0 2.6 0Z","M29.3 9a1.3 1.3 0 1 0-2.6 0 1.3 1.3 0 1 0 2.6 0Z"],
 promotion:["M16 3L7 13h6v16h6V13h6z"],
 playoff:["M4.5 5h7v7H4.5z","M4.5 20h7v7H4.5z","M11.5 8.5h5V16h5","M11.5 23.5h5V16","M24.5 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"],
 manager:["M16 2.8a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8Z","M9.3 15.4c-4.6.5-6.8 3.4-6.8 7.7v5.7c0 1.2 1 2.2 2.2 2.2h22.6c1.2 0 2.2-1 2.2-2.2v-5.7c0-4.3-2.2-7.2-6.8-7.7l-5.1 13.1c-.6 1.4-2.6 1.4-3.2 0Z","M14.4 15.5h3.2l1 1.9-2.1 2.7.8 4.3-1.3 3.3-1.3-3.3.8-4.3-2.1-2.7Z"],
 player:["M16 2.7 20.1 11l9.2 1.3-6.7 6.5 1.6 9.2L16 23.7 7.9 28l1.6-9.2-6.7-6.5L12 11Z"],
 young:["M4 8v10c0 3.8 1.8 6 4.6 6s4.6-2.2 4.6-6V8","M16 12c0-2.7 1.5-4.3 3.9-4.3s3.9 1.6 3.9 4c0 2-1.2 3.5-3.3 5.6L16 24h8","M26 10l2-2v16"],
 boot:["M16 1a15 15 0 1 0 0 30a15 15 0 1 0 0-30Z M11.1 3.2 14.1 5 12.2 9.6 7 12.4 3.3 10.2 5.1 6.2Z M15.2 4 20.9 3.7 25.5 8.9 23.7 13 17.1 13.7 13.3 9.8Z M2.8 11.5 6.6 13.6 6.9 18.4 4.2 22.7 2.2 19.5 2.1 15.5Z M7.8 19.7 13.5 20.6 16.6 26.1 14.5 28.5 9 27.4 5 23.4Z M17.8 14.8 24.1 14.1 26.7 18.6 23.2 25.6 18 25.8 14.4 19.7Z M27.8 19.7 29.7 18.3 28.9 23.6 25.3 27.4 24.9 25.7Z M21.9 3.4 27 7.3 29.6 12.1 26.4 10.3Z"],
 assists:["M3 10.5C3.3 9.4 4.6 9 5.3 10C7.7 13.1 10.1 14 13.4 13.4L16.8 11.8L14.7 10.3C14.1 9.9 14 9.3 14.5 8.7L16 6.9C16.5 6.3 17.2 6.3 18 6.8L25.2 11.8C27 13 29.2 13.5 30.4 14.3C31.5 15 31.6 16.2 31 17.3C30 19.2 28 20 25.6 20H7C4.3 20 2.8 19 2.1 17.6C1.5 15.9 2.4 12.5 3 10.5Z M16.8 11.8 19.2 13.1 12.6 18.3 9.5 18.3Z M20.6 13.8 23.3 15.2 18.5 18.3 15.5 18.3Z","M6.1 20H8.8L8.5 23.1H6.6Z","M12.3 20H14.9L14.6 23.1H12.7Z","M21.1 20H23.6L23.8 23.1H21.5Z","M26.2 19.9 28.8 19.2 29.5 22.3 27.3 23Z"],
 glove:["M8 28V14c0-2.5 3.5-2.5 3.5 0V6c0-2.5 3.5-2.5 3.5 0v7-5c0-2.5 3.5-2.5 3.5 0v5-2c0-2.5 3.5-2.5 3.5 0v10c0 5-4 8-9 8z","M12 19l4 3 4-3"],
 defender:["M16 3l11 4.5V16c0 6-4 10.5-11 13-7-2.5-11-7-11-13V7.5z","M10 17l4 4 8-9"],
 midfielder:["M16 3l13 13-13 13L3 16z","M16 8v16M8 16h16","M12 12l8 8m0-8-8 8"],
 forward:["M4 26L27 4l-4 13-6-6z","M4 18v9h9","M11 25l9-9"],
 xi:["M6.5 12l5-4v16","M17.5 12l5-4v16"]
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
