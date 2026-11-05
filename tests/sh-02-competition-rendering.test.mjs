import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('assets/competition-page.js');
const begin=page.indexOf('  const renderDOM=Object.freeze({');
const end=page.indexOf('\n  window.faCompetitionRenderDOM=renderDOM;',begin);
assert.ok(begin>=0&&end>begin,'The shared DOM reconciler is part of the mounted competition runtime');
const dom=runInNewContext(page.slice(begin,end)+';renderDOM',{});

function text(value){
 return {nodeType:3,nodeName:'#text',nodeValue:value,parent:null,remove(){const p=this.parent;p.childNodes.splice(p.childNodes.indexOf(this),1)}};
}
function element(name='div',key=null){
 const attrs=new Map(key==null?[]:[['data-club-crest',key]]);
 const n={nodeType:1,nodeName:name.toUpperCase(),childNodes:[],parent:null,
  get attributes(){return [...attrs].map(([name,value])=>({name,value}))},
  getAttribute:k=>attrs.get(k)??null,hasAttribute:k=>attrs.has(k),
  setAttribute:(k,v)=>attrs.set(k,String(v)),removeAttribute:k=>attrs.delete(k),
  append(...items){for(const child of items){child.parent=this;this.childNodes.push(child)}},
  replaceWith(next){const p=this.parent;assert.ok(p);const i=p.childNodes.indexOf(this);p.childNodes[i]=next;next.parent=p},
  get lastChild(){return this.childNodes.at(-1)},
  remove(){const p=this.parent;p.childNodes.splice(p.childNodes.indexOf(this),1)}
 };
 return n;
}
function parent(items=[]){
 return {children:[...items],replacements:0,
  insertBefore(item,before){
   const previous=this.children.indexOf(item);if(previous>=0)this.children.splice(previous,1);
   const index=before?this.children.indexOf(before):-1;
   this.children.splice(index>=0?index:this.children.length,0,item);
  },
  get lastElementChild(){const host=this;return{remove(){host.children.pop()}}},
  replaceChildren(...nodes){this.replacements++;this.children=[...nodes]}
 };
}
test('SH-02: keyed reconciliation preserves mobile details and loaded crest nodes while updating scores',()=>{
 const old=element('li');old.setAttribute('data-world-club','IT-1');
 const details=element('details');details.setAttribute('open','');
 const crest=element('span','IT-1'),image=element('img');crest.append(image);
 details.append(crest,text('—'));old.append(details);
 const updated=element('li');updated.setAttribute('data-world-club','IT-1');
 const incoming=element('details');incoming.append(element('span','IT-1'),text('5'));updated.append(incoming);
 const host=parent([old]);
 dom.keyed(host,[updated],row=>row.getAttribute('data-world-club'));
 assert.equal(host.children[0],old);
 assert.equal(old.childNodes[0],details);
 assert.equal(details.getAttribute('open'),'');
 assert.equal(details.childNodes[0],crest);
 assert.equal(crest.childNodes[0],image);
 assert.equal(details.childNodes[1].nodeValue,'5');
 assert.equal(host.replacements,0);
});
test('SH-02: keyed domestic/table identity reorders without rebuilding; changed crests are replaced',()=>{
 const a=element('tr'),b=element('tr');
 a.setAttribute('data-world-club','IT-1');b.setAttribute('data-world-club','IT-2');
 const host=parent([a,b]),aa=element('tr'),bb=element('tr');
 aa.setAttribute('data-world-club','IT-1');bb.setAttribute('data-world-club','IT-2');
 dom.keyed(host,[bb,aa],row=>row.getAttribute('data-world-club'));
 assert.equal(host.children[0],b);assert.equal(host.children[1],a);assert.equal(host.replacements,0);
 const original=element('span','IT-1'),holder=element('div');holder.append(original);
 dom.sync(original,element('span','IT-2'));
 assert.equal(holder.childNodes[0].getAttribute('data-club-crest'),'IT-2');
 const incoming=element('tr');incoming.setAttribute('data-world-club','IT-3');
 dom.keyed(host,[incoming,aa],row=>row.getAttribute('data-world-club'));
 assert.equal(host.children[0],incoming);assert.equal(host.children[1],a);
});
test('SH-02: all eighteen permanent shells still expose the seven view buttons and panels',()=>{
 const categories=['br','de','eng','es','fr','it','nl','pt'].flatMap(country=>[country+'-1',country+'-2']).concat(['int-1','int-2']);
 for(const id of categories){
  const html=read('competitions/'+id+'/index.html');
  for(const tab of ['standings','postseason','fixtures','stats','history','rules','awards']){
   assert.ok(html.includes('id="competition-tab-'+tab+'"'),id+'/'+tab);
   assert.ok(html.includes('id="competition-panel-'+tab+'"'),id+'/'+tab);
  }
  assert.ok(html.includes('data-fa-competition-shell'),id);
 }
});
test('SH-02: shared consumer boundary changes neither API authority nor phase policies',()=>{
 assert.match(page,/current\.revision!==expectedRevision/);
 assert.match(page,/renderDOM\.keyed\(tbody,desktop,/);
 assert.match(page,/resetBracket\(new Set\(updates\.filter/);
 assert.match(read('assets/competition-fixtures.js'),/faCompetitionRenderDOM\?\.reorder/);
 assert.match(read('assets/competition-awards.js'),/faCompetitionRenderDOM\?\.sync/);
 assert.match(read('assets/competition-stats.js'),/previousPresentation===presentation/);
 assert.match(read('assets/competition-history.js'),/previousPresentation/);
 assert.match(read('assets/competition-tabs.js'),/fa:source-change/);
 assert.ok(read('assets/competition-awards.js').includes(':scope > .fa-awards'),'Awards may reconcile only a mounted direct-child panel; never nested first-paint skeletons');
 assert.match(read('assets/competition-awards.js'),/presentation===lastPresentation/,'unchanged recipients do not recreate detached icons');
 assert.match(read('assets/competition-history.js'),/previousCards\?\.length===cards\.length/,'a replaced History tree must be hydrated even with unchanged data');
 assert.match(page,/restoreFocus/,'reordered standings preserve active element focus');
});
