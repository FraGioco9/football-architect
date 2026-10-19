/* Passive club images, shared by standings, fixtures, Stats and History. */
(() => {
 'use strict';
 const catalog=window.faClubCrests;
 if(!catalog||typeof catalog!=='object')return;
 const rendered=new WeakMap();
 function render(host){
  const id=host.dataset.clubCrest;
  const asset=Object.hasOwn(catalog,id)?catalog[id]:null;
  if(rendered.has(host)&&rendered.get(host)===asset)return;
  rendered.set(host,asset);
  for(const image of host.querySelectorAll('.app-club-crest-image'))image.remove();
  delete host.dataset.clubCrestLoaded;
  if(typeof asset!=='string')return;
  const match=id.match(/^([A-Z]{2,3})-([1-9]\d*)$/);
  if(!match||asset!==`assets/clubs/${match[1]}/${match[2]}/crest.svg`)return;
  const image=document.createElement('img');
  image.className='app-club-crest-image';image.alt='';image.draggable=false;
  image.decoding='async';
  image.addEventListener('load',()=>{
   if(host.contains(image))host.dataset.clubCrestLoaded='true';
  },{once:true});
  image.addEventListener('error',()=>{
   if(host.contains(image)){delete host.dataset.clubCrestLoaded;image.remove()}
  },{once:true});
  host.append(image);image.src='/'+asset;
 }
 function scan(root){
  if(root.matches?.('[data-club-crest]'))render(root);
  for(const host of root.querySelectorAll?.('[data-club-crest]')||[])render(host);
 }
 scan(document);
 new MutationObserver(records=>{
  for(const record of records){
   if(record.type==='attributes')render(record.target);
   else for(const node of record.addedNodes)scan(node);
  }
 }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-club-crest']});
})();
