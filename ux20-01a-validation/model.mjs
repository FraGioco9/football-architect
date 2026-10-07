import assert from 'node:assert/strict';
import {dashboardFocus} from '../src/dashboard-model.js';

assert.deepEqual(
  dashboardFocus({players:[],unread:5,hasNext:true,seasonFinished:false,requiredInput:null}),
  [],
  'generic unread mail and match preparation must not be operational priorities'
);

const required={id:'msg-required',subject:'Decision required'};
const focus=dashboardFocus({players:[],unread:0,hasNext:true,seasonFinished:false,requiredInput:required});
assert.equal(focus[0]?.kind,'input','required user input must be the first dashboard priority');
assert.equal(focus[0]?.message,required,'required user input must preserve the blocking message');
console.log('UX20 01A MODEL PASS');


import {makeWorld} from '../src/data.js';
import {startCareer} from '../src/domain/career.js';
import {dashboard} from '../src/ui.js';

const world=makeWorld(101,'IT');
startCareer(world,1,'Dashboard Contract');
world.inbox.unshift({id:'msg-dashboard-required',season:world.season,round:world.round,date:world.currentDate,subject:'Decisione dirigenza',text:'Serve una risposta.',kind:'board',read:false,requiresUserInput:true,inputRequest:{type:'board-contract',id:'req-dashboard-01'}});
world.unread=world.inbox.filter(message=>!message.read).length;
const html=dashboard(world,{language:'it',continuing:false,previewSaved:false,qol03:{widgets:['kpis','fixtures','results'],hidden:[]}});
assert.match(html,/dashboard-now-input/,'blocking input must render the decision-required Now state');
assert.match(html,/Decisione richiesta/,'blocking input must be visible as the primary Dashboard state');
assert.doesNotMatch(html,/data-action="advance"/,'Continue must not be offered while user input is required');
assert.equal((html.match(/btn btn-primary/g)||[]).length,1,'blocking Dashboard state must keep exactly one primary CTA');
console.log('UX20 01A BLOCKING RENDER PASS');
