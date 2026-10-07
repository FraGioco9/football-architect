import assert from 'node:assert/strict';
import {NAV_GROUPS} from '../src/navigation-model.js';
import {makeWorld} from '../src/data.js';
import {startCareer} from '../src/domain/career.js';
import {shell} from '../src/ui.js';

const competitions=NAV_GROUPS.find(group=>group.id==='competitions');
const system=NAV_GROUPS.find(group=>group.id==='system');
assert.equal(competitions.items.some(item=>item.id==='advanced'),false,'Advanced analysis must leave Competitions');
assert.equal(system.items.some(item=>item.id==='advanced'),true,'Advanced analysis must move to System');

const world=makeWorld(404,'IT');
startCareer(world,1,'Shell Test');
const ui={language:'it',page:'dashboard',sidebarOpen:false,navOpenGroups:{},continuing:false,modal:null,languageMenu:null,previewSaved:false};
let html=shell(world,ui,'<section>dashboard</section>');

assert.doesNotMatch(html,/CARRIERA ATTIVA/,'sidebar must remove the active-career overline');
assert.doesNotMatch(html,/side-competition/,'sidebar must remove competition duplication');
assert.doesNotMatch(html,/side-season-bottom/,'sidebar must remove season duplication');
assert.doesNotMatch(html,/class="progress"/,'sidebar must remove season progress');
assert.doesNotMatch(html,/nav-group-count/,'navigation group item counts must be removed');
assert.doesNotMatch(html,/foot-network|foot-caption/,'sidebar technical footer copy must be removed');
assert.doesNotMatch(html,/class="breadcrumb"/,'topbar breadcrumb must be removed');
assert.doesNotMatch(html,/fa-home-top/,'topbar Main menu duplication must be removed');
assert.match(html,/data-language-picker="top"/,'desktop topbar language picker must remain');
assert.match(html,/data-language-picker="sidebar"/,'mobile drawer language picker must exist');
assert.doesNotMatch(html,/class="btn [^"]*continue-top/,'Dashboard must not duplicate the primary Continue control in the topbar');

ui.page='calendar';
html=shell(world,ui,'<section>calendar</section>');
assert.match(html,/continue-top/,'operational pages must keep the global simulation control');

world.inbox.unshift({id:'required-shell',season:world.season,round:world.round,date:world.currentDate,subject:'Decisione richiesta',text:'Serve una risposta.',kind:'board',read:false,requiresUserInput:true,inputRequest:{type:'board-contract',id:'shell-contract'}});
world.unread=world.inbox.filter(message=>!message.read).length;
html=shell(world,ui,'<section>calendar</section>');
assert.match(html,/topbar-decision/,'blocking input must surface in the topbar');
assert.match(html,/data-action="dashboard-open-input"/,'blocking topbar indicator must open the required request');
assert.doesNotMatch(html,/continue-top/,'Continue must disappear while input is required');

console.log('UX20 CROSS SHELL MODEL PASS');
