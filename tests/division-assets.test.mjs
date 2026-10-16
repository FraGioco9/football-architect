import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,rmSync,symlinkSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateDivisionAssets,validateDivisionSvg,divisionAssetPath,renderDivisionLogo} from '../tools/validate-division-assets.mjs';
import {isAllowlistedPublicPath} from '../tools/publication-guard.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const canonical=JSON.parse(readFileSync(join(root,'data/divisions.json'),'utf8'));

test('ASSET-01: exactly 32 approved SVGs use deterministic paths and pass ZIP integrity',()=>{
 const verified=validateDivisionAssets();
 assert.deepEqual([...verified.divisions.keys()],canonical.map(d=>d.id));
 assert.equal(verified.paths.size,32);
 for(const d of canonical)for(const variant of ['primary','compact']){
  const path=divisionAssetPath(d,variant);
  assert.equal(isAllowlistedPublicPath(path),true);
  const source=readFileSync(join(root,path),'utf8');
  assert.equal(verified.divisions.get(d.id)[variant],source.replace(/^<\?xml[^?]+\?>\s*/,'').trim());
 }
 for(const path of ['assets/divisions/it-2/test.png','assets/divisions/it-1-lega-federale/manifest.json',
  'assets/divisions/it-1-lega-federale/source.psd','assets/divisions/it-1-lega-federale/primary-dark.svg'])
  assert.equal(isAllowlistedPublicPath(path),false,path);
});

test('ASSET-02: missing, changed, extra and symlinked assets fail closed',()=>{
 const verified=validateDivisionAssets(),temp=mkdtempSync(join(tmpdir(),'fa-division-svg-'));
 try{
  for(const path of verified.paths){const dest=join(temp,path);mkdirSync(dirname(dest),{recursive:true});copyFileSync(join(root,path),dest);}
  assert.equal(validateDivisionAssets(temp).paths.size,32);
  const first=[...verified.paths][0],path=join(temp,first),original=readFileSync(path);
  writeFileSync(path,Buffer.concat([original,Buffer.from('\n')]));
  assert.throws(()=>validateDivisionAssets(temp),/integrity/);
  rmSync(path);assert.throws(()=>validateDivisionAssets(temp),/ENOENT/);
  symlinkSync(join(root,first),path);assert.throws(()=>validateDivisionAssets(temp),/ordinary file/);
  rmSync(path);writeFileSync(path,original);
  writeFileSync(join(dirname(path),'legacy.png'),'legacy');
  assert.throws(()=>validateDivisionAssets(temp),/unexpected division asset/);
 }finally{rmSync(temp,{recursive:true,force:true});}
});

test('ASSET-03: unsafe XML, CSS, references, text, colors and viewBoxes are rejected',()=>{
 const d=canonical[0],original=validateDivisionAssets().divisions.get(d.id).compact;
 const attacks=[
  s=>s.replace('<g>','<script>alert(1)</script><g>'),
  s=>s.replace('<g>','<foreignObject/><g>'),
  s=>s.replace('<g>','<image href="x.png"/><g>'),
  s=>s.replace('<g>','<text>Logo</text><g>'),
  s=>s.replace('<g>','<use href="#a"/><g>'),
  s=>s.replace('<g>','<g id="a">'),
  s=>s.replace('<svg ','<svg onload="alert(1)" '),
  s=>s.replace('<style>','<style>@import "https://example.com/font";'),
  s=>s.replace(/fill: #[a-f\d]+/i,'fill: url(#x)'),
  s=>s.replace(/fill: #[a-f\d]+/i,'fill: #abcdef'),
  s=>s.replace('</svg>','&entity;</svg>'),
  s=>s.replace('</svg>','</g>'),
  s=>s.replace(/viewBox="[^"]+"/,'viewBox="0 0 0 10"'),
  s=>'<!DOCTYPE svg>'+s
 ];
 for(const attack of attacks)assert.throws(()=>validateDivisionSvg(attack(original),d),/Division assets invalid/);
});

test('ASSET-04: scoped inline source, contextual accessibility and reserved-space ID fallback',()=>{
 const logos=validateDivisionAssets().divisions,d=canonical[0];
 const decorative=renderDivisionLogo(d.id,'compact',logos);
 assert.ok(decorative.includes(logos.get(d.id).compact));
 assert.match(decorative,/aria-hidden="true"/);
 assert.match(decorative,/<template shadowrootmode="open">/);
 assert.match(decorative,/<\/template><span>BR-1<\/span>/,"unslotted ID is visible only without declarative shadow DOM");
 const standalone=renderDivisionLogo(d.id,'primary',logos,{large:true,name:d.name});
 assert.match(standalone,/role="img" aria-label="Liga das Associações"/);
 assert.doesNotMatch(standalone,/aria-hidden/);
 const fallback=renderDivisionLogo(d.id,'primary',new Map(),{large:true});
 assert.match(fallback,/>BR-1<\/div>$/);
 assert.match(fallback,/app-competition-logo-placeholder-large/);
 assert.doesNotMatch(fallback,/<svg|<template/);
});

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('DIV-ASSET-07: every logo is inline at first paint with isolated original styles',()=>{
 const index=read('app/competitions/index.html');
 assert.equal((index.match(/shadowrootmode="open"/g)||[]).length,16);
 for(const d of canonical){
  const page=read('app/competitions/'+d.id.toLowerCase()+'/index.html');
  assert.ok(page.includes('shadowrootmode="open"'),d.id);
  assert.ok(page.includes('data-division-variant="primary"'),d.id);
  assert.ok(page.includes('id="app-competition-badge"'),d.id);
  assert.doesNotMatch(page,/Loading competition/);
 }
 assert.equal(existsSync(new URL('../assets/division-logos.js',import.meta.url)),false);
 assert.equal(existsSync(new URL('../data/division-assets.final.json',import.meta.url)),false);
 assert.doesNotMatch(read('assets/competition-page.js'),/visualAsset|createElement\("picture"\)|shellResponse/);
});
