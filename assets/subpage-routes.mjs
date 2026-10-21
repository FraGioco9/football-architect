// ROUTE-02 canonical subpage contract. Pure helpers, no environment side effects.
export const competitionViews=Object.freeze(["overview","standings","postseason","fixtures","stats","history","rules","awards","teams"]);
export const clubViews=Object.freeze(["overview","roster","fixtures","stats","history"]);
const countries="it|eng|es|de|fr|pt|nl|br";
const division=new RegExp("^/competitions/("+countries+")-([12])(?:/([^/]+))?/?$");
const club=new RegExp("^/clubs/("+countries+")/([1-9]|[1-3][0-9]|40)(?:/([^/]+))?/?$");
export function resolveSubpage(pathname){
  const match=division.exec(pathname);
  if(match){
    const base="/competitions/"+match[1]+"-"+match[2];
    const view=match[3]||"overview";
    return competitionViews.includes(view)?{kind:"competition",base,view,canonical:base+"/"+view,redirect:!match[3]||pathname!==base+"/"+view}:null;
  }
  const found=club.exec(pathname);
  if(found){
    const base="/clubs/"+found[1]+"/"+found[2];
    const view=found[3]||"overview";
    return clubViews.includes(view)?{kind:"club",base,view,canonical:base+"/"+view,redirect:!found[3]||pathname!==base+"/"+view}:null;
  }
  return null;
}
export function competitionSubpage(id,view="overview"){
  if(!/^(it|eng|es|de|fr|pt|nl|br)-[12]$/.test(id)||!competitionViews.includes(view))throw Error("Invalid competition route");
  return "/competitions/"+id+"/"+view;
}
export function clubSubpage(country,id,view="overview"){
  if(!/^(it|eng|es|de|fr|pt|nl|br)$/.test(country)||!/^([1-9]|[1-3][0-9]|40)$/.test(id)||!clubViews.includes(view))throw Error("Invalid club route");
  return "/clubs/"+country+"/"+id+"/"+view;
}
