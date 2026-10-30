import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {profileDestination}=require('../assets/profile-navigation.js');
test('profile destination keeps app origin, language and safe post-login return',()=>{
 const origin='http://app.localhost:2000';
 assert.equal(profileDestination(true,origin+'/account/','it'),origin+'/account/?lang=it');
 const anonymous=new URL(profileDestination(false,origin+'/account/','fr'));
 assert.equal(anonymous.origin,origin);assert.equal(anonymous.pathname,'/account/login/');
 assert.equal(anonymous.searchParams.get('next'),'/account/');assert.equal(anonymous.searchParams.get('lang'),'fr');
 assert.equal(new URL(profileDestination(false,origin,'invalid')).searchParams.get('lang'),'en');
});
