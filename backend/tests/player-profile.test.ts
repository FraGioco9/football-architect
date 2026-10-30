import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRegistrationProfile} from '../src/player-profile.ts';
test('normalizes registration profile without changing username display casing',()=>{
 assert.deepEqual(parseRegistrationProfile({username:'  Francesco_9  ',nationality:'IT',city:' Bologna '}),{username:'Francesco_9',nationality:'IT',city:'Bologna'});
 assert.deepEqual(parseRegistrationProfile({username:'abc',nationality:'',city:' '}),{username:'abc',nationality:null,city:null});
});
test('rejects malformed names, invalid countries and oversized or control-character cities',()=>{
 for(const input of [{},{username:'ab'},{username:'a'.repeat(25)},{username:'a b'},{username:'àbc'},{username:'abc',nationality:'ZZ'},{username:'abc',nationality:42},{username:'abc',city:'x'.repeat(101)},{username:'abc',city:'a\nb'}])assert.throws(()=>parseRegistrationProfile(input));
 assert.equal(parseRegistrationProfile({username:'abc',city:'😀'.repeat(100)}).city?.length,200);
});
