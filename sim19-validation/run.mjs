import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {makeWorld} from '../src/data.js';
import {startCareer} from '../src/engine.js';
import {clubPlayers} from '../src/domain/selectors.js';
import {addMessage,careerMessageRequiresUserInput,firstCareerInputMessage} from '../src/domain/history.js';
import {syncCareerContracts,proposeCareerRenewal,respondCareerRenewal,decideCareerCounter} from '../src/domain/career-contracts.js';

function testBlockingMessageContract(){
  const world={season:1,round:0,currentDate:'2026-07-01',inbox:[],unread:0};
  addMessage(world,'Informativa','Solo informazione','info');
  assert.equal(careerMessageRequiresUserInput(world.inbox[0]),false,'informational mail must not block');
  addMessage(world,'Contratto in scadenza','Avviso facoltativo','transfer',{type:'contract.expired',params:{player:'Test Player'}});
  assert.equal(careerMessageRequiresUserInput(world.inbox[0]),false,'event type alone must never imply a blocker');
  addMessage(world,'Decisione obbligatoria','Serve una decisione','transfer',{type:'contract.expired',params:{player:'Required Player'},requiresUserInput:true});
  assert.equal(careerMessageRequiresUserInput(world.inbox[0]),true,'explicit blocking metadata must stop simulation');
  assert.equal(world.inbox[0].requiresUserInput,true,'blocking flag must be persisted');
  const restored=JSON.parse(JSON.stringify(world.inbox[0]));
  assert.equal(careerMessageRequiresUserInput(restored),true,'blocking metadata must survive save round-trips');
}

function testRealBlockingProducer(){
  const world=makeWorld(190019);
  startCareer(world,1,'SIM19 Blocking');
  syncCareerContracts(world);
  const player=clubPlayers(world,world.clubId)[0];
  const state=world.advancedV1.contractsV1;
  const offerId=proposeCareerRenewal(world,{
    playerId:player.id,
    expectedRevision:state.revision,
    years:2,
    annualWage:Math.max(5200,Math.round(player.wage))*52,
    signingBonus:0,
    appearanceBonus:0,
    goalBonus:0,
    promisedRole:'rotation',
    releaseFee:null
  });
  const response=respondCareerRenewal(world,{offerId,expectedRevision:state.revision,decision:'counter'});
  assert.equal(response.status,'awaiting_club','forced player counter must require a club decision');
  const blocker=firstCareerInputMessage(world);
  assert.ok(blocker,'counteroffer must create a blocking inbox message');
  assert.equal(blocker.inputRequest?.type,'contract-counter');
  assert.equal(blocker.inputRequest?.id,offerId);
  assert.equal(careerMessageRequiresUserInput(blocker,world),true,'live counteroffer message must block Continue');
  const restored=JSON.parse(JSON.stringify(world));
  assert.equal(firstCareerInputMessage(restored)?.inputRequest?.id,offerId,'blocking request must survive save round-trip');
  decideCareerCounter(world,{offerId,expectedRevision:state.revision,decision:'reject'});
  assert.equal(firstCareerInputMessage(world),null,'resolved counteroffer must stop blocking without deleting mail history');
}

async function browserGate(){
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror',error=>errors.push('pageerror: '+error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push('console: '+message.text());});
  try{
    await page.goto('http://127.0.0.1:2000',{waitUntil:'networkidle'});
    await page.locator('[data-action="menu-new"]').click();
    await page.locator('[data-action="start-career"]').waitFor({state:'visible'});
    await page.locator('#manager-name').fill('SIM19 Test');
    await page.locator('[data-action="start-career"]').click();
    await page.locator('[data-action="advance"]').first().waitFor({state:'visible'});
    // The start-career click commits its new slot after rendering the dashboard.
    // Give that durable commit a brief window before testing the next action.
    await page.waitForTimeout(500);

    const initialDate=(await page.locator('.top-round strong').textContent())?.trim();
    await page.locator('.continue-top[data-action="advance"]').click();
    await page.waitForTimeout(500);
    if(await page.locator('.continue-top[data-action="stop-advance"]').count()===0){
      console.log('SIM19 IMMEDIATE STOP STATE:',(await page.locator('body').innerText()).slice(-7000));
      console.log('SIM19 CAPTURED ERRORS:',errors);
      throw new Error('Continue stopped before Stop control could remain observable');
    }
    await page.waitForFunction(date=>{
      const current=document.querySelector('.top-round strong')?.textContent?.trim();
      const running=Boolean(document.querySelector('.continue-top[data-action="stop-advance"]'));
      return current!==date||!running;
    },initialDate,{timeout:60000});
    const progressedDate=(await page.locator('.top-round strong').textContent())?.trim();
    if(progressedDate===initialDate){
      console.log('SIM19 EARLY STOP STATE:',(await page.locator('body').innerText()).slice(-5000));
    }
    assert.notEqual(progressedDate,initialDate,'Continue stopped before crossing the first day');

    await page.waitForFunction(()=>{
      const text=document.querySelector('.side-season-bottom')?.textContent||'';
      const running=Boolean(document.querySelector('.continue-top[data-action="stop-advance"]'));
      return /1\s*\/\s*38/.test(text)||!running;
    },null,{timeout:90000});
    const roundText=(await page.locator('.side-season-bottom').textContent())||'';
    const reachedFirstMatch=/1\s*\/\s*38/.test(roundText);
    if(!reachedFirstMatch){
      console.log('SIM19 PRE-MATCH STOP STATE:',(await page.locator('body').innerText()).slice(-5000));
    }
    assert.equal(reachedFirstMatch,true,'continuous simulation stopped before the first matchday');
    assert.equal(await page.locator('.continue-top[data-action="stop-advance"]').count(),1,'a matchday must not stop continuous simulation');

    await page.locator('.continue-top[data-action="stop-advance"]').click();
    await page.locator('.continue-top[data-action="advance"]').waitFor({state:'visible'});
    const stoppedDate=(await page.locator('.top-round strong').textContent())?.trim();
    await page.waitForTimeout(350);
    assert.equal((await page.locator('.top-round strong').textContent())?.trim(),stoppedDate,'manual Stop must leave the date stable');

    await page.reload({waitUntil:'networkidle'});
    await page.locator('[data-action="menu-continue"]').waitFor({state:'visible'});
    await page.locator('[data-action="menu-continue"]').click();
    await page.locator('.top-round strong').waitFor({state:'visible'});
    assert.equal((await page.locator('.top-round strong').textContent())?.trim(),stoppedDate,'reload must resume from the last committed continuous-simulation date');
    await page.waitForTimeout(300);

    await page.locator('.continue-top[data-action="advance"]').click();
    await page.locator('.continue-top[data-action="stop-advance"]').waitFor({state:'visible'});
    await page.locator('[data-action="nav"][data-page="calendar"]').first().click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('[data-action="stop-advance"]').count(),0,'navigation must stop the loop');
    const navDate=(await page.locator('.top-round strong').textContent())?.trim();
    await page.waitForTimeout(350);
    assert.equal((await page.locator('.top-round strong').textContent())?.trim(),navDate,'date must remain stable after navigation stopped the loop');

    assert.equal(errors.length,0,'browser console/page errors: '+errors.join(' | '));
  } finally {
    await browser.close();
  }
}

testBlockingMessageContract();
testRealBlockingProducer();
await browserGate();
console.log('SIM19 VALIDATION PASS');
