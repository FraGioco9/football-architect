import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { addMessage, careerMessageRequiresUserInput } from '../src/domain/history.js';

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

async function browserGate(){
  const browser=await chromium.launch({headless:true});
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

    const initialDate=(await page.locator('.top-round strong').textContent())?.trim();
    await page.locator('.continue-top[data-action="advance"]').click();
    await page.locator('.continue-top[data-action="stop-advance"]').waitFor({state:'visible'});
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
await browserGate();
console.log('SIM19 VALIDATION PASS');
