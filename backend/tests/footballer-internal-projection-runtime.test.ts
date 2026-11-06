import {test} from 'vitest';
import assert from 'node:assert/strict';
import {
 FOOTBALLER_ATTRIBUTE_KEYS,projectInternalFootballerRecord
} from '../src/footballer-internal-projection.ts';
import {projectPublicFootballerProfile} from '../src/footballer-public-projection.ts';

const source={
 preview_id:'trial-0001',
 first_name:'Joao',last_name:'da Silva',
 known_as:'Alias',display_name:'Alias',
 initial_age:18,nationality:'BRA',secondary_nationality:null,
 height_cm:180,preferred_foot:'right',primary_position:'ST',
 secondary_positions:['RW'],
 attributes:Object.fromEntries(FOOTBALLER_ATTRIBUTE_KEYS.map((k,i)=>[k,20+i])),
 development_aptitude:83,career_status:'active',
 trial_role_profile:'versatile',
 trial_primary_suitability_target:75,
 trial_primary_suitability_actual:74.9,
 ranking_snapshot:'2026',identity_sources:{secret:true},seed:'hidden',
 persisted:false,trial_only:true,private_token:'never expose',
 future_private_field:{hidden:'yes'}
};
test('internal stored player is a strict allowlist of gameplay state',()=>{
 const internal=projectInternalFootballerRecord(source);
 assert.deepEqual(Object.keys(internal),[
  'first_name','last_name','nationality','secondary_nationality',
  'initial_age','height_cm','preferred_foot','primary_position',
  'secondary_positions','attributes','development_aptitude','career_status'
 ]);
 assert.equal(internal.first_name,'Joao');
 assert.equal(internal.last_name,'da Silva');
 assert.equal(internal.development_aptitude,83);
 assert.equal(Object.keys(internal.attributes).length,20);
 assert.deepEqual(internal.secondary_positions,['RW']);
 assert.equal(Object.isFrozen(internal),true);
 assert.equal(Object.isFrozen(internal.attributes),true);
 assert.equal(Object.isFrozen(internal.secondary_positions),true);
 for(const name of ['trial_role_profile','specialist','versatile','known_as',
 'preview_id','seed','trial_primary_suitability','identity_sources','private_token',
 'ranking_snapshot','trial_only','persisted','future_private_field','display_name'])
  assert.equal(JSON.stringify(internal).includes(name),false,name+' leaked');
});
test('internal gameplay state can be projected to public without leaking attributes',()=>{
 const internal=projectInternalFootballerRecord(source);
 const publicProfile=projectPublicFootballerProfile(internal,{publicId:'footballer-1',currentAge:18});
 assert.equal(publicProfile.display_name,'Joao da Silva');
 assert.equal(publicProfile.id,'footballer-1');
 assert.equal(Object.hasOwn(publicProfile,'attributes'),false);
 assert.equal(Object.hasOwn(publicProfile,'development_aptitude'),false);
 assert.equal(Object.hasOwn(publicProfile,'trial_role_profile'),false);
});
test('unknown attributes are dropped, missing or invalid gameplay values fail closed',()=>{
 const dirty={...source,attributes:{...source.attributes,private_stat:101}};
 const out=projectInternalFootballerRecord(dirty);
 assert.equal(Object.hasOwn(out.attributes,'private_stat'),false);
 const missing={...source,attributes:{shooting:61}};
 assert.throws(()=>projectInternalFootballerRecord(missing),/invalid_speed/);
 assert.throws(()=>projectInternalFootballerRecord({...source,development_aptitude:100}),/invalid_development_aptitude/);
 assert.throws(()=>projectInternalFootballerRecord({...source,secondary_positions:['RW','RW']}),/invalid_secondary_positions/);
 assert.throws(()=>projectInternalFootballerRecord({...source,trial_role_profile:'specialist',primary_position:'INVALID'}),/invalid_primary_position/);
});
