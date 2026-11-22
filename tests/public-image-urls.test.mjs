import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {clubCrestUrl,competitionLogoUrl,playerPortraitUrl} from '../assets/public-image-urls.mjs';
test('#733 competition logos are deterministic and validated by ID',()=>{
 assert.equal(competitionLogoUrl('IT-1'),'/assets/competitions/IT-1/compact.svg');
 // No approved international SVGs exist: no speculative requests / 404s.
 for(const id of ['int-1','int-2'])for(const variant of ['primary','compact'])
  assert.equal(competitionLogoUrl(id,variant),null);
 // Every emitted URL must correspond to a physically published asset.
 for(const country of ['IT','ENG','ES','DE','FR','PT','NL','BR'])for(const tier of [1,2]){
  const id=country+'-'+tier;
  for(const variant of ['primary','compact']){
   const url=competitionLogoUrl(id,variant);
   assert.equal(url,'/assets/competitions/'+id+'/'+variant+'.svg');
   assert.ok(existsSync(fileURLToPath(new URL('..'+url,import.meta.url))),url);
  }
 }
 for(const id of ['it-1','ZZ-1','IT-3','../IT-1','IT-1/../X',null])
  assert.equal(competitionLogoUrl(id),null);
 for(const variant of ['../../../file','thumbnail',null,'COMPACT'])
  assert.equal(competitionLogoUrl('IT-1',variant),null);
});
test('#733 club crest is ID-derived but only published identities are requested',()=>{
 const approved=new Set(['IT-1','ENG-40']);
 assert.equal(clubCrestUrl('IT-1',approved),'/assets/clubs/IT/1/crest.svg');
 assert.equal(clubCrestUrl('ENG-40',approved),'/assets/clubs/ENG/40/crest.svg');
 assert.equal(clubCrestUrl('IT-01',approved),null);
 assert.equal(clubCrestUrl('BR-1',approved),null);
});
test('#733 positive player ID alone does not authorize a WebP request',()=>{
 assert.equal(playerPortraitUrl(44,null),null);
 assert.equal(playerPortraitUrl(44,new Set()),null);
 assert.equal(playerPortraitUrl(44,new Set([45])),null);
 assert.equal(playerPortraitUrl(44,new Set([44])),'/assets/players/portraits/44.webp');
 for(const id of ['44',0,-1,Number.MAX_SAFE_INTEGER+1,null])
  assert.equal(playerPortraitUrl(id,new Set([44])),null);
});
