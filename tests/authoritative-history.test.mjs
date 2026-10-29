import test from 'node:test';
import assert from 'node:assert/strict';
import {historyViewModel} from '../assets/authoritative-history.mjs';
const club={countryId:'IT',clubId:1,primaryName:'Test club'};
const row={club,played:30,won:20,drawn:5,lost:5,gf:60,ga:20,gd:40,pts:65,recent:[]};
const context=()=>({selectedSeason:1,definition:{id:'IT-1',category:'domestic'},seasonData:{season:1,provenance:{kind:'authoritative'},world:{phase:'closed'},participants:[club],history:{season:1,championClubId:'IT-1',archiveHash:'a'.repeat(64),closedAt:100},statistics:{standings:[row]}}});
test('exposes champion and league-only historical table only after sealed selected-season closure',()=>{
 const model=historyViewModel(context());assert.equal(model.champion.primaryName,'Test club');assert.equal(model.table[0].pts,65);assert.equal(model.records.historyBestAttack.value,60);
 for(const alter of [c=>{c.seasonData.world.phase='active'},c=>{c.selectedSeason=2},c=>{c.seasonData.history=null},c=>{c.seasonData.provenance.kind='fictional'}]){const c=context();alter(c);assert.equal(historyViewModel(c),null)}
});
test('refuses unknown historical champion and preserves unavailable player/all-time records',()=>{
 const c=context();c.seasonData.history.championClubId='FR-1';assert.equal(historyViewModel(c),null);
 const data=historyViewModel(context());assert.equal(data.players,null);assert.equal(data.allTime,null);
});
test('keeps selected Season1 history when actual world advances into active Season2',()=>{
 const c=context();c.seasonData.world={phase:'active',seasonNumber:2,day:1};c.seasonData.seasonState={phase:'closed',day:56};assert.equal(historyViewModel(c).season,1);
});
