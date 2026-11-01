import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {gmailEmailDeliveries} from '../src/gmail-email-delivery.ts';

const origin='https://football-architect-preview.example.workers.dev',token='a'.repeat(64);
const ready=()=>({PLAYER_MODE:'preview',PLAYER_TRUSTED_SOURCE:'cloudflare',PLAYER_ORIGIN:origin,
 PLAYER_EMAIL_DELIVERY_ENABLED:'gmail-preview',PLAYER_EMAIL_FROM:'notifications@gmail.com',
 PLAYER_EMAIL_PREVIEW_RECIPIENTS:'tester@example.invalid',GMAIL_CLIENT_ID:'synthetic-client',
 GMAIL_CLIENT_SECRET:'synthetic-secret',GMAIL_REFRESH_TOKEN:'synthetic-refresh'});
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
describe('Preview Gmail delivery without external requests',()=>{
 it('exchanges OAuth credentials and submits a localized MIME message to the configured mailbox',async()=>{
  const requests:Request[]=[];
  const transport=async(input:RequestInfo|URL,init?:RequestInit)=>{
   const r=new Request(input,init);requests.push(r);
   return requests.length===1?response({access_token:'synthetic-access',token_type:'Bearer',expires_in:3600}):response({id:'synthetic-message',threadId:'synthetic-thread',labelIds:['SENT']});
  };
  const delivery=gmailEmailDeliveries(ready(),transport);
  assert.equal(typeof delivery.verification,'function');
  await delivery.verification!('tester@example.invalid',token,'it');
  assert.equal(requests.length,2);
  assert.equal(requests[0].url,'https://oauth2.googleapis.com/token');
  const form=new URLSearchParams(await requests[0].text());
  assert.equal(form.get('grant_type'),'refresh_token');assert.equal(form.get('refresh_token'),'synthetic-refresh');
  assert.equal(requests[1].url,'https://gmail.googleapis.com/gmail/v1/users/notifications%40gmail.com/messages/send');
  assert.equal(requests[1].headers.get('Authorization'),'Bearer synthetic-access');
  for(const r of requests){assert.equal(r.method,'POST');assert.equal(r.redirect,'manual');assert.ok(r.signal)}
  const {raw}=await requests[1].json() as {raw:string};
  assert.match(raw,/^[A-Za-z0-9_-]+$/);
  const mime=Buffer.from(raw,'base64url').toString('utf8');
  assert.match(mime,/^From: notifications@gmail.com\r\nTo: tester@example.invalid\r\n/);
  assert.match(mime,/MIME-Version: 1.0/);assert.match(mime,/multipart\/alternative/);
  const textParts=[...mime.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)(?=\r\n--)/g)].map(m=>Buffer.from(m[1],'base64').toString('utf8'));
  assert.equal(textParts.length,2);
  for(const text of textParts){assert.ok(text.includes(origin+'/account/verify-email?token='+token));assert.ok(text.includes('lang=it'))}
  assert.ok(!mime.includes('synthetic-secret'));assert.ok(!mime.includes('synthetic-refresh'));
 });
 it('accepts only the new exact Preview host under the existing opt-in gates',()=>{
  assert.equal(typeof gmailEmailDeliveries({...ready(),PLAYER_ORIGIN:'https://preview.football-architect.workers.dev'}).verification,'function');
  assert.deepEqual(gmailEmailDeliveries({...ready(),PLAYER_ORIGIN:'https://preview.football-architect.workers.dev.evil.invalid'}),{});
 });
 it('fails closed for incomplete, local, production, unsafe-origin and unrestricted configurations',()=>{
  const fail=async()=>{throw Error('unexpected_network')};
  const cases=[{PLAYER_MODE:'production'},{PLAYER_MODE:'local'},{PLAYER_EMAIL_DELIVERY_ENABLED:'cloudflare'},
   {GMAIL_CLIENT_ID:''},{GMAIL_CLIENT_SECRET:''},{GMAIL_REFRESH_TOKEN:''},{PLAYER_EMAIL_PREVIEW_RECIPIENTS:''},
   {PLAYER_EMAIL_PREVIEW_RECIPIENTS:'*'},{PLAYER_TRUSTED_SOURCE:'local'},
   {PLAYER_ORIGIN:'http://football-architect-preview.example.workers.dev'},
   {PLAYER_ORIGIN:origin+'/'},{PLAYER_ORIGIN:'https://evil.invalid'},
   {PLAYER_ORIGIN:'https://football-architect-preview.example.workers.dev.evil.invalid'},
   {PLAYER_EMAIL_FROM:'noreply@example.invalid'},{PLAYER_EMAIL_FROM:'notifications@gmail.com\r\nBcc: attacker@example.invalid'}];
  for(const extra of cases)assert.deepEqual(gmailEmailDeliveries({...ready(),...extra},fail),{});
 });
 it('blocks recipients outside the exact allowlist and malformed tokens before OAuth',async()=>{
  let calls=0;const delivery=gmailEmailDeliveries(ready(),async()=>{calls++;throw Error('unexpected_network')});
  for(const email of ['other@example.invalid','tester@example.invalid.attacker.invalid','tester@example.invalid\r\nBcc: evil@example.invalid'])
   await assert.rejects(delivery.verification!(email,token),{message:'email_delivery_unavailable'});
  await assert.rejects(delivery.reset!('tester@example.invalid','bad-token'),{message:'email_delivery_unavailable'});
  assert.equal(calls,0);
 });
 it('does not retry ambiguous sends and sanitizes OAuth, provider and transport failures',async()=>{
  for(const phase of ['oauth','send','transport','malformed-oauth','malformed-send']){
   let calls=0;const delivery=gmailEmailDeliveries(ready(),async()=>{
    calls++;
    if(phase==='transport')throw Error('secret token body recipient@example.invalid');
    if(calls===1)return phase==='oauth'?response({error:'private-provider-error'},401):phase==='malformed-oauth'?response({token_type:'Bearer'}):response({access_token:'synthetic-access',token_type:'Bearer',expires_in:3600});
    return phase==='send'?response({error:'raw token and address'},429):response({});
   });
   await assert.rejects(delivery.reset!('tester@example.invalid',token),{message:'email_delivery_unavailable'});
   assert.equal(calls,phase==='send'||phase==='malformed-send'?2:1);
  }
 });
 it('rejects redirects, oversized responses and invalid bearer tokens without forwarding credentials',async()=>{
  for(const kind of ['redirect','oversized','invalid-bearer']){
   let calls=0;const delivery=gmailEmailDeliveries(ready(),async()=>{
    calls++;
    if(kind==='redirect')return new Response(null,{status:302,headers:{Location:'https://attacker.invalid'}});
    if(kind==='oversized')return response({access_token:'x'.repeat(20000),token_type:'Bearer'});
    return response({access_token:'bad\r\nheader',token_type:'Bearer'});
   });
   await assert.rejects(delivery.verification!('tester@example.invalid',token),{message:'email_delivery_unavailable'});
   assert.equal(calls,1);
  }
 });
 it('permits ten exact approved recipients but refuses an eleventh or ambiguous list entries',()=>{
  const fail=async()=>{throw Error('unexpected_network')};
  const emails=Array.from({length:10},(_,i)=>'tester'+i+'@example.invalid');
  assert.equal(typeof gmailEmailDeliveries({...ready(),PLAYER_EMAIL_PREVIEW_RECIPIENTS:emails.join(',')},fail).verification,'function');
  for(const value of [[...emails,'extra@example.invalid'].join(','), 'tester@example.invalid, other@example.invalid', 'tester@example.invalid,']){
   assert.deepEqual(gmailEmailDeliveries({...ready(),PLAYER_EMAIL_PREVIEW_RECIPIENTS:value},fail),{});
  }
 });
 it('rejects send-phase redirects and oversized success payloads without retrying the message',async()=>{
  for(const redirect of [true,false]){
   let calls=0;const delivery=gmailEmailDeliveries(ready(),async()=>{
    calls++;
    if(calls===1)return response({access_token:'synthetic-access',token_type:'Bearer',expires_in:3600});
    return redirect?new Response(null,{status:307,headers:{Location:'https://attacker.invalid'}}):response({id:'x'.repeat(20000)});
   });
   await assert.rejects(delivery.reset!('tester@example.invalid',token),{message:'email_delivery_unavailable'});assert.equal(calls,2);
  }
 });
});
