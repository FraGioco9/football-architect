import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateDivisionAssets} from '../tools/validate-division-assets.mjs';
import {isAllowlistedPublicPath} from '../tools/publication-guard.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const registry=JSON.parse(readFileSync(join(root,'data/division-assets.final.json'),'utf8'));
const clone=()=>structuredClone(registry);

test('ASSET-01: registered division images are byte-verified, up to 16 divisions',()=>{
 const verified=validateDivisionAssets();
 assert.deepEqual([...verified.divisions.keys()],registry.divisions.map(d=>d.id));
 assert.equal(verified.paths.size,registry.divisions.length*8);
 for(const id of verified.divisions.keys()) {
  const projection=verified.divisions.get(id);
  assert.deepEqual(Object.keys(projection),['primary','primary-dark','compact','compact-dark']);
  for(const variant of Object.values(projection))for(const path of Object.values(variant))
   assert.equal(isAllowlistedPublicPath(path),true,path);
 }
 assert.equal(isAllowlistedPublicPath('assets/divisions/it-2/test.png'),false);
 assert.equal(isAllowlistedPublicPath('assets/divisions/it-1-lega-federale/manifest.json'),false);
 assert.equal(isAllowlistedPublicPath('assets/divisions/eng-1-crown-league/eng-1-crown-league-primary.psd'),false);
});

test('ASSET-02: changed metadata, missing files, duplicate IDs and changed image bytes fail closed',()=>{
 const original=validateDivisionAssets();
 const temp=mkdtempSync(join(tmpdir(),'fa-division-assets-'));
 try{
  const jsonPath=join(temp,'data/division-assets.final.json');
  mkdirSync(dirname(jsonPath),{recursive:true});
  const snapshot=r=>writeFileSync(jsonPath,JSON.stringify(r));
  for(const path of original.paths){
   const dest=join(temp,path);mkdirSync(dirname(dest),{recursive:true});copyFileSync(join(root,path),dest);
  }
  snapshot(clone());
  assert.equal(validateDivisionAssets(temp).paths.size,registry.divisions.length*8);
  const checks=[
   r=>r.schemaVersion=2,
   r=>r.divisions.push(structuredClone(r.divisions[0])),
   r=>r.divisions[0].id='IT-2',
   r=>r.divisions[1].id='IT-1',
   r=>r.divisions[0].source.commit='0000000000000000000000000000000000000000',
   r=>r.divisions[1].variants.compact.png.path='../unsafe.png',
   r=>r.divisions[1].variants.compact.png.sha256='0'.repeat(64)
  ];
  for(const apply of checks){const r=clone();apply(r);snapshot(r);assert.throws(()=>validateDivisionAssets(temp),/Division assets invalid|ENOENT/);}
  snapshot(clone());
  const asset=[...original.paths][0];
  const path=join(temp,asset);writeFileSync(path,Buffer.concat([readFileSync(path),Buffer.from([0])]));
  assert.throws(()=>validateDivisionAssets(temp),/integrity/);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
