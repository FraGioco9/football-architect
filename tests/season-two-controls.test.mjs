import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{canRunCommand}=require('../assets/admin-settings.js');
const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:70,seasonNumber:1,day:56,phase:'closed'};
const events={worldGeneration:world.generation,worldRevision:70,mode:'sporting',rows:[],closure:{days:56,ties:54,archived:true}};
const proposal={worldGeneration:world.generation,worldRevision:70,snapshot:{snapshotHash:'a'.repeat(64)},approval:{snapshotHash:'a'.repeat(64)},activation:{targetSeason:2,ready:true}};
test('next preparation requires closedSeason1 and exact approved snapshot/current review',()=>{
 assert.equal(canRunCommand('nextPrepare',world,events,proposal),true);
 for(const p of [null,{...proposal,approval:null},{...proposal,activation:{targetSeason:2,ready:false}},{...proposal,worldRevision:69},{...proposal,approval:{snapshotHash:'b'.repeat(64)}}])assert.equal(canRunCommand('nextPrepare',world,events,p),false);
 assert.equal(canRunCommand('nextPrepare',{...world,seasonNumber:2},events,proposal),false);
 assert.equal(canRunCommand('nextPrepare',{...world,phase:'active'},events,proposal),false);
});
