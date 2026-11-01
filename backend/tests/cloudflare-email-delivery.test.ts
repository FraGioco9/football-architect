import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {cloudflareEmailDeliveries,emailLocale} from '../src/cloudflare-email-delivery.ts';

describe('Cloudflare Email Service delivery adapter (no real sends)',()=>{
 const origin='https://app.example.invalid',from='noreply@example.invalid',token='a'.repeat(64);
 const ready=(send:(message:any)=>Promise<unknown>)=>({
  PLAYER_EMAIL_DELIVERY_ENABLED:'cloudflare',
  PLAYER_MODE:'production',
  PLAYER_ORIGIN:origin,
  PLAYER_EMAIL_FROM:from,
  EMAIL:{send}
 });
 it('selects a safe supported locale from UI or browser header values',()=>{
  assert.equal(emailLocale('it'),'it');
  assert.equal(emailLocale('de-DE,de;q=0.9'),'de');
  assert.equal(emailLocale('ja-JP,fr-FR;q=0.8,en;q=0.5'),'fr');
  assert.equal(emailLocale('es;q=0,en;q=1'),'en');
  assert.equal(emailLocale('xx-YY,zz;q=0.5'),'en');
  assert.equal(emailLocale('fr;q=NaN,it;q=0.8'),'it');
 });
 it('remains disabled for absent opt-in, local mode, missing binding or sender and unsafe origin',()=>{
  const fake=async()=>{throw Error('must not send')};
  assert.equal(cloudflareEmailDeliveries({...ready(fake),PLAYER_EMAIL_DELIVERY_ENABLED:undefined}).verification,undefined);
  assert.equal(cloudflareEmailDeliveries({...ready(fake),PLAYER_MODE:'local'}).reset,undefined);
  assert.equal(cloudflareEmailDeliveries({...ready(fake),EMAIL:undefined}).verification,undefined);
  assert.equal(cloudflareEmailDeliveries({...ready(fake),PLAYER_EMAIL_FROM:undefined}).reset,undefined);
  assert.equal(cloudflareEmailDeliveries({...ready(fake),PLAYER_ORIGIN:'http://app.example.invalid'}).verification,undefined);
  assert.equal(cloudflareEmailDeliveries({...ready(fake),PLAYER_ORIGIN:'https://evil.invalid/path'}).reset,undefined);
 });
 it('builds canonical verification and recovery links using fixed trusted origin',async()=>{
  const captured:any[]=[];
  const callbacks=cloudflareEmailDeliveries(ready(async msg=>{captured.push(msg);return {messageId:'fake'}}));
  await callbacks.verification!('player@example.invalid',token);
  await callbacks.reset!('player@example.invalid',token);
  assert.equal((captured).length,2);
  assert.equal(captured[0].from,from);
  assert.equal(captured[0].to,'player@example.invalid');
  assert.equal(new URL(captured[0].text.match(/https:\/\/[^\s]+/)![0]).pathname,'/account/verify-email');
  assert.equal(new URL(captured[1].text.match(/https:\/\/[^\s]+/)![0]).pathname,'/account/recover');
  for(const msg of captured){
   assert.ok((msg.html).includes('token='+token));
   assert.ok((msg.text).includes('token='+token));
   assert.ok(msg.subject);
   assert.ok(!(msg.html).includes('<script'));
  }
 });
 it('localizes both email types in all supported languages and falls back to English',async()=>{
  const received:any[]=[];
  const callbacks=cloudflareEmailDeliveries(ready(async message=>{received.push(message)}));
  for(const locale of ['en','de','es','fr','it']){
   await callbacks.verification!('player@example.invalid',token,locale);
   await callbacks.reset!('player@example.invalid',token,locale);
  }
  assert.equal((received).length,10);
  assert.equal(new Set(received.filter((_,i)=>i%2===0).map(m=>m.subject)).size,5);
  assert.equal(new Set(received.filter((_,i)=>i%2===1).map(m=>m.subject)).size,5);
  for(const message of received){
   assert.ok((message.html).includes('token='+token));
   assert.ok((message.text).includes('token='+token));
  }
  for(let i=0;i<10;i++){
   const locale=['en','de','es','fr','it'][Math.floor(i/2)];
   const link=new URL(received[i].text.match(/https:\/\/[^\s]+/)![0]);
   assert.equal(link.searchParams.get('lang'),locale==='en'?null:locale);
   assert.equal(link.searchParams.get('token'),token);
  }
  await callbacks.verification!('player@example.invalid',token,'unknown');
  assert.equal(received.at(-1).subject,received[0].subject);
  assert.equal(new URL(received.at(-1).text.match(/https:\/\/[^\s]+/)![0]).searchParams.has('lang'),false);
 });
 it('rejects malformed tokens before sending and propagates delivery failures',async()=>{
  let count=0;
  const callbacks=cloudflareEmailDeliveries(ready(async()=>{count++;throw Error('fake-outage')}));
  await assert.rejects(callbacks.reset!('player@example.invalid','unsafe'),{message:'invalid_delivery_token'});
  assert.equal(count,0);
  await assert.rejects(callbacks.verification!('player@example.invalid',token),{message:'fake-outage'});
  assert.equal(count,1);
 });
});
