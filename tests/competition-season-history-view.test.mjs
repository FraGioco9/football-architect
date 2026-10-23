import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import model from '../assets/competition-model.js';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
const walk=node=>[node,...node.children.flatMap(walk)];
function fixture(id){
 const definition=loadCompetitionCatalogue().find(d=>d.id===id),document={activeElement:null,documentElement:{lang:'en'}};
 function node(tag='div',text=''){
  const n={tagName:tag,textContent:text,children:[],dataset:{},attrs:{},className:'',style:{},events:{},hidden:false,
   append(...children){for(const child of children){child.parentElement=this;this.children.push(child)}},
   replaceChildren(...children){this.children=[];this.append(...children)},
   setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]},
   addEventListener(k,fn){(this.events[k]??=[]).push(fn)},emit(k,event={}){for(const fn of this.events[k]||[])fn({target:this,...event})},
   focus(){document.activeElement=this},showModal(){this.open=true},close(){this.open=false;this.emit('close')},
   contains(other){return walk(this).includes(other)},
   matches(selector){if(selector.startsWith('.'))return this.className.split(' ').includes(selector.slice(1));if(selector.startsWith('[')){const key=selector.slice(1,-1).replace(/^data-/,'').replace(/-([a-z])/g,(_,x)=>x.toUpperCase());return Object.hasOwn(this.dataset,key)}return this.tagName===selector},
   querySelectorAll(selector){return walk(this).slice(1).filter(child=>child.matches(selector))},querySelector(selector){return this.querySelectorAll(selector)[0]||null},
   closest(selector){for(let n=this;n;n=n.parentElement)if(n.matches(selector))return n;return null}
  };
  n.classList={add(...names){n.className=[...new Set([...n.className.split(' '),...names])].join(' ')},remove(name){n.className=n.className.split(' ').filter(x=>x!==name).join(' ')}};
  return n;
 }
 document.createElement=node;document.createTextNode=text=>node('#text',text);document.body=node('body');
 const panel=node('section'),card=node('article');card.dataset.historyPlayerRecord='seasonGoals';card.dataset.historyScope='season';
 card.append(node('h5','Goals'));panel.append(card);document.body.append(panel);
 document.getElementById=id=>id==='competition-panel-history'?panel:null;document.querySelector=()=>null;
 const window={faCompetitionModel:model,faCompetitionContext:{definition,currentDefinition:definition,seasonData:{participants:[{countryId:'IT',clubId:1,primaryName:'Italian Club'},{countryId:'ENG',clubId:1,primaryName:'English Club'}]}},addEventListener(){}};
 runInNewContext(readFileSync(new URL('../assets/competition-history.js',import.meta.url),'utf8'),{window,document});
 return {window,document,panel,card,definition};
}
test('SEASON-CUP-DIALOG: actual History details retain country-qualified clubs and generic season links',()=>{
 for(const id of ['sovereign-cup','federation-cup']){
  const r=fixture(id),row=(playerId,playerName,countryId,goals)=>({playerId,playerName,countryId,clubId:1,goals,assists:0,appearances:1,cleanSheets:0});
  const payload={source:'canonical',competitionId:id,coverage:'complete',provenance:{approved:true},seasons:[{seasonId:1,status:'completed',dataStatus:'approved',playerStatsComplete:true,rulesVersion:r.definition.rules.version,rulesSnapshot:r.definition.rules,playerStats:[row('p1','First Player','IT',3),row('p1','First Player','ENG',3),row('p2','Second Player','ENG',6)]}]};
  const before=JSON.stringify(payload);
  assert.doesNotThrow(()=>r.window.faHistoryPlayerRecords.applyCanonicalHistory(payload));
  const trigger=walk(r.card).find(n=>n.dataset.historyDetail==='seasonGoals');assert.ok(trigger);
  assert.doesNotThrow(()=>r.panel.emit('click',{target:trigger}));
  const dialog=walk(r.document.body).find(n=>n.tagName==='dialog');assert.equal(dialog?.open,true);
  const links=walk(dialog).filter(n=>n.tagName==='a').map(n=>n.href);
  assert.ok(links.includes('/clubs/it/1/overview'));assert.ok(links.includes('/clubs/eng/1/overview'));
  assert.ok(links.includes('/competitions/'+id+'/standings?season=1'));
  assert.equal(JSON.stringify(payload),before);
  const exit=walk(dialog).find(n=>n.className==='app-history-player-close');exit.emit('click');
  assert.equal(dialog.open,false);assert.equal(r.document.activeElement,trigger);
 }
});
test('SEASON-LEGACY-DIALOG: approved domestic player history retains canonical club and season navigation',()=>{
 const r=fixture('IT-1'),season={seasonId:1,status:'completed',dataStatus:'approved',playerStatsComplete:true,playerStats:[{playerId:'p1',playerName:'First',clubId:1,goals:3,assists:0,appearances:1,cleanSheets:0},{playerId:'p2',playerName:'Second',clubId:1,goals:3,assists:0,appearances:1,cleanSheets:0}]};
 r.window.faHistoryPlayerRecords.applyCanonicalHistory({source:'canonical',competitionId:'IT-1',coverage:'complete',provenance:{approved:true},seasons:[season]});
 const trigger=walk(r.card).find(n=>n.dataset.historyDetail==='seasonGoals');r.panel.emit('click',{target:trigger});
 const dialog=walk(r.document.body).find(n=>n.tagName==='dialog'),links=walk(dialog).filter(n=>n.tagName==='a').map(n=>n.href);
 assert.equal(dialog.open,true);assert.ok(links.includes('/clubs/it/1/overview'));assert.ok(links.includes('/competitions/it-1/standings?season=1'));
});
