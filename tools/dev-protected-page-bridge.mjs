// I05 DEV-only, reversible bridge between protected candidate registry and
// page-specific presenters. It never mounts itself or changes the page chrome.
import {subscribeProtectedCandidates,currentProtectedCandidates} from "./dev-protected-consumer-registry.mjs";
const supported=new Set(["calendar","stats","history","international","club"]);
export function attachProtectedPresenter({kind,prepare,commit,rollback,clubId}){
 if(!supported.has(kind)||typeof prepare!=="function"||typeof commit!=="function"||typeof rollback!=="function")throw TypeError("I05 invalid presenter");
 let release=null,revision=0,disposed=false;
 const clear=()=>{const old=release;release=null;if(old){try{rollback(old)}catch{}}};
 const listener=snapshot=>{
  if(disposed)return;
  if(!snapshot){clear();return}
  if(snapshot.revision<revision)return;
  revision=snapshot.revision;
  const source=snapshot.consumers;
  let payload;
  try{payload=kind==="club"?source.club(clubId):source[kind]}catch{clear();return}
  if(!payload){clear();return}
  let next;
  try{next=prepare(payload,{revision,source:source.source,cursor:source.cursor})}
  catch{clear();return}
  clear();
  if(disposed||currentProtectedCandidates()?.revision!==revision){try{rollback(next)}catch{}return;}
  try{commit(next);release=next}catch{try{rollback(next)}catch{}}
 };
 const unsubscribe=subscribeProtectedCandidates(listener);
 return ()=>{disposed=true;unsubscribe();clear()};
}
