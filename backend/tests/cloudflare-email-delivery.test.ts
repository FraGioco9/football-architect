import {describe,it,expect} from 'vitest';
import {cloudflareEmailDeliveries} from '../src/cloudflare-email-delivery.ts';

describe('Cloudflare Email Service delivery adapter (no real sends)',()=>{
 const origin='https://app.example.invalid',from='noreply@example.invalid',token='a'.repeat(64);
 const ready=(send:(message:any)=>Promise<unknown>)=>({
  PLAYER_EMAIL_DELIVERY_ENABLED:'cloudflare',
  PLAYER_MODE:'production',
  PLAYER_ORIGIN:origin,
  PLAYER_EMAIL_FROM:from,
  EMAIL:{send}
 });
 it('remains disabled for absent opt-in, local mode, missing binding or sender and unsafe origin',()=>{
  const fake=async()=>{throw Error('must not send')};
  expect(cloudflareEmailDeliveries({...ready(fake),PLAYER_EMAIL_DELIVERY_ENABLED:undefined}).verification).toBeUndefined();
  expect(cloudflareEmailDeliveries({...ready(fake),PLAYER_MODE:'local'}).reset).toBeUndefined();
  expect(cloudflareEmailDeliveries({...ready(fake),EMAIL:undefined}).verification).toBeUndefined();
  expect(cloudflareEmailDeliveries({...ready(fake),PLAYER_EMAIL_FROM:undefined}).reset).toBeUndefined();
  expect(cloudflareEmailDeliveries({...ready(fake),PLAYER_ORIGIN:'http://app.example.invalid'}).verification).toBeUndefined();
  expect(cloudflareEmailDeliveries({...ready(fake),PLAYER_ORIGIN:'https://evil.invalid/path'}).reset).toBeUndefined();
 });
 it('builds canonical verification and recovery links using fixed trusted origin',async()=>{
  const captured:any[]=[];
  const callbacks=cloudflareEmailDeliveries(ready(async msg=>{captured.push(msg);return {messageId:'fake'}}));
  await callbacks.verification!('player@example.invalid',token);
  await callbacks.reset!('player@example.invalid',token);
  expect(captured).toHaveLength(2);
  expect(captured[0]).toMatchObject({from,to:'player@example.invalid'});
  expect(new URL(captured[0].text.match(/https:\/\/[^\s]+/)![0]).pathname).toBe('/account/verify-email');
  expect(new URL(captured[1].text.match(/https:\/\/[^\s]+/)![0]).pathname).toBe('/account/recover');
  for(const msg of captured){
   expect(msg.html).toContain('token='+token);
   expect(msg.text).toContain('token='+token);
   expect(msg.subject).toBeTruthy();
   expect(msg.html).not.toContain('<script');
  }
 });
 it('rejects malformed tokens before sending and propagates delivery failures',async()=>{
  let count=0;
  const callbacks=cloudflareEmailDeliveries(ready(async()=>{count++;throw Error('fake-outage')}));
  await expect(callbacks.reset!('player@example.invalid','unsafe')).rejects.toThrow('invalid_delivery_token');
  expect(count).toBe(0);
  await expect(callbacks.verification!('player@example.invalid',token)).rejects.toThrow('fake-outage');
  expect(count).toBe(1);
 });
});
