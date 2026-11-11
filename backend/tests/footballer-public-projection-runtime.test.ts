import assert from 'node:assert/strict';
import {test} from 'vitest';
import {
  projectPublicFootballerCard,projectPublicFootballerProfile
} from '../src/footballer-public-projection.ts';
const internal={
  id:'internal-do-not-send',
  preview_id:'trial-0001',
  first_name:'Joao',
  last_name:'da Silva',
  display_name:'Joaozinho',
  known_as:'Joaozinho',
  nationality:'BRA',
  secondary_nationality:'POR',
  primary_position:'ST',
  secondary_positions:['RW','LW'],
  initial_age:18,
  height_cm:181,
  preferred_foot:'right',
  career_status:'active',
  attributes:{shooting:90,passing:66,secret_flag:'internal'},
  development_aptitude:99,
  trial_primary_suitability_target:88,
  trial_primary_suitability_actual:87.5,
  trial_role_profile:'specialist',
  seed:'secret-seed',
  identity_sources:{given_names:'internal'},
  credentials:{token:'secret'},
  future_internal_field:'must stay private'
};
test('roster view is an exact allowlist and ignores arbitrary internal fields',()=>{
 const output=projectPublicFootballerCard(internal,{publicId:123,currentAge:19});
 assert.deepEqual(output,{
  display_name:'Joao da Silva',nationality:'BRA',primary_position:'ST',
  id:123,age:19,career_status:'active'
 });
 assert.equal(Object.isFrozen(output),true);
 for(const phrase of ['known_as','Joaozinho','internal-do-not-send','trial-0001',
 'development_aptitude','shooting','secret','identity_sources','trial_primary','future_internal_field'])
  assert.equal(JSON.stringify(output).includes(phrase),false,phrase+' leaked');
});
test('profile view adds only public physical and position fields, never abilities',()=>{
 const output=projectPublicFootballerProfile(internal,{publicId:123,currentAge:19});
 assert.deepEqual(output,{
  display_name:'Joao da Silva',nationality:'BRA',primary_position:'ST',
  id:123,age:19,career_status:'active',
  secondary_positions:['RW','LW'],height_cm:181,preferred_foot:'right'
 });
 assert.equal(Object.isFrozen(output),true);
 assert.equal(Object.isFrozen(output.secondary_positions),true);
 assert.notEqual(output.secondary_positions,internal.secondary_positions);
 assert.doesNotMatch(JSON.stringify(output),/known_as|aptitude|attributes|seed|suitability|preview|credentials/i);
});
test('trial preview ids, initial age and trial metadata are never silently published',()=>{
 const output=projectPublicFootballerCard(internal);
 assert.deepEqual(Object.keys(output),['display_name','nationality','primary_position','career_status']);
 assert.equal('id' in output,false);
 assert.equal('age' in output,false);
 assert.equal('initial_age' in output,false);
});
test('reject invalid source fields and untrusted authoritative context',()=>{
 for(const p of [null,[],{...internal,first_name:''},{...internal,last_name:' SurName'},
 {...internal,nationality:null}])
  assert.throws(()=>projectPublicFootballerCard(p as any),TypeError);
 for(const ctx of [{publicId:''},{publicId:0},{publicId:-1},{publicId:1.5},{currentAge:-1},{currentAge:18.5}])
  assert.throws(()=>projectPublicFootballerCard(internal,ctx as any),TypeError);
 assert.throws(()=>projectPublicFootballerProfile({...internal,secondary_positions:'ST'} as any),TypeError);
 assert.throws(()=>projectPublicFootballerProfile({...internal,preferred_foot:'both'}),TypeError);
});
