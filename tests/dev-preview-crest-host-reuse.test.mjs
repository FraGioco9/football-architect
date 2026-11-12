import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const client=readFileSync(new URL('../tools/dev-standings-preview-client.mjs',import.meta.url),'utf8');
const start=client.indexOf('function reuseCrestHosts(');
const end=client.indexOf('\nasync function boot(',start);
assert.ok(start>=0&&end>start,'#521 DEV crest swap is a shared, testable function');
const reuse=runInNewContext(client.slice(start,end)+';reuseCrestHosts',{});

function node(name,dataset={}){
 const n={name,dataset:{...dataset},children:[],parentNode:null,
  append(...items){for(const item of items)this.insertBefore(item,null)},
  insertBefore(item,before){
   if(item.parentNode){
    const p=item.parentNode;p.children.splice(p.children.indexOf(item),1);
   }
   const i=before?this.children.indexOf(before):-1;
   if(before&&i<0)throw Error('Missing DOM anchor');
   this.children.splice(i<0?this.children.length:i,0,item);
   item.parentNode=this;
  },
  replaceWith(item){
   const parent=this.parentNode;if(!parent)throw Error('Cannot replace a detached node');
   parent.insertBefore(item,this);
   parent.children.splice(parent.children.indexOf(this),1);
   this.parentNode=null;
  },
  get nextSibling(){
   if(!this.parentNode)return null;
   return this.parentNode.children[this.parentNode.children.indexOf(this)+1]||null;
  },
  querySelector(selector){
   assert.equal(selector,'[data-club-crest]');
   if(this.dataset.clubCrest)return this;
   for(const child of this.children){
    const found=child.querySelector(selector);if(found)return found;
   }
   return null;
  }
 };
 return n;
}
function row(id){
 const tr=node('tr',{worldClub:id}),identity=node('span');
 const host=node('span',{clubCrest:id}),image=node('img');
 host.append(image);identity.append(host,node('a'));tr.append(identity);
 return {tr,host,image};
}
const currentHost=r=>r.querySelector('[data-club-crest]');

test('#521 mounted desktop and mobile crest nodes survive DEV activation and restoration',()=>{
 for(const codes of [['ENG-1','ENG-2'],['BR-1','BR-2']]){
  const canonical=codes.map(row),dev=[...codes].reverse().map(row);
  const placeholders=dev.map(x=>x.host);
  reuse(canonical.map(x=>x.tr),dev.map(x=>x.tr));
  assert.equal(currentHost(dev[0].tr),canonical[1].host);
  assert.equal(currentHost(dev[1].tr),canonical[0].host);
  assert.equal(currentHost(dev[0].tr).children[0],canonical[1].image);
  assert.equal(currentHost(canonical[0].tr),placeholders[1]);
  assert.equal(currentHost(canonical[1].tr),placeholders[0]);
  reuse(dev.map(x=>x.tr),canonical.map(x=>x.tr));
  assert.equal(currentHost(canonical[0].tr),canonical[0].host);
  assert.equal(currentHost(canonical[1].tr),canonical[1].host);
  assert.equal(currentHost(dev[0].tr),placeholders[0]);
  assert.equal(currentHost(dev[1].tr),placeholders[1]);
 }
});

test('#521 a roster change preserves only matching club crests',()=>{
 const existing=[row('BR-1'),row('BR-2')],incoming=[row('BR-2'),row('BR-3')];
 reuse(existing.map(x=>x.tr),incoming.map(x=>x.tr));
 assert.equal(currentHost(incoming[0].tr),existing[1].host);
 assert.equal(currentHost(incoming[1].tr),incoming[1].host);
 assert.equal(currentHost(existing[0].tr),existing[0].host);
 reuse(incoming.map(x=>x.tr),existing.map(x=>x.tr));
 assert.equal(currentHost(existing[1].tr),existing[1].host);
});

test('#521 identical or empty source lists are no-ops',()=>{
 const rows=[row('ENG-1'),row('ENG-2')];
 reuse(rows.map(x=>x.tr),rows.map(x=>x.tr));
 assert.equal(currentHost(rows[0].tr),rows[0].host);
 reuse([],rows.map(x=>x.tr));
 assert.equal(currentHost(rows[1].tr),rows[1].host);
});

test('#521 DEV commit and restore protect both the desktop and mobile rows',()=>{
 assert.match(client,/reuseCrestHosts\(canonicalRows,\[\.\.\.fragment\.childNodes\]\);\s*tbody\.replaceChildren\(fragment\)/);
 assert.match(client,/commitMobile\(\);\s*reuseCrestHosts\(canonicalMobile,\[\.\.\.mobileList\.children\]\)/);
 assert.match(client,/reuseCrestHosts\(\[\.\.\.tbody\.children\],canonicalRows\)/);
 assert.match(client,/reuseCrestHosts\(\[\.\.\.mobileList\.children\],canonicalMobile\)/);
});
