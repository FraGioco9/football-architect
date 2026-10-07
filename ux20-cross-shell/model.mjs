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
const ui={language:'it',page:'dashboard',sidebarOpen:false,navOpenGroups:{},continuing:false,continuationBlocker:null,modal:null,languageMenu:null,previewSaved:false};
let html=shell(world,ui,'<section>dashboard</section>');

assert.doesNotMatch(html,/<details class="nav-group"/,'sidebar groups must not be collapsible');
assert.doesNotMatch(html,/nav-group-toggle|<summary/,'sidebar groups must have no collapse controls');
assert.doesNotMatch(html,/sidebar-career|club-side-link/,'managed club must leave the sidebar');
assert.doesNotMatch(html,/data-action="toggle-sidebar"/,'menu toggle must be removed');
assert.doesNotMatch(html,/data-action="menu-home"/,'Main menu action must be removed from the shell');
assert.match(html,/class="topbar-club"/,'managed club must be shown in the topbar');
assert.match(html,/data-language-picker="top"/,'language picker must remain in the topbar');
assert.match(html,/class="btn btn-primary topbar-primary" type="button" data-action="advance"/,'top-right action must default to Continue');
assert.equal((html.match(/data-action="advance"/g)||[]).length,1,'shell must expose a single Continue simulation action');

world.currentDate=world.fixtures[world.round].date;
html=shell(world,ui,'<section>dashboard</section>');
assert.match(html,/data-action="play-matchday"/,'due fixture must switch the top-right action to Match');
assert.match(html,/>Partita<\/span>/,'due fixture must label the action Partita');

world.inbox.unshift({id:'required-shell',season:world.season,round:world.round,date:world.currentDate,subject:'Decisione richiesta',text:'Serve una risposta.',kind:'board',read:false,requiresUserInput:true,inputRequest:{type:'board-contract',id:'shell-contract'}});
world.unread=world.inbox.filter(message=>!message.read).length;
html=shell(world,ui,'<section>dashboard</section>');
assert.match(html,/data-action="dashboard-open-input"/,'blocking input must own the top-right action');
assert.match(html,/>Posta<\/span>/,'blocking input must label the action Posta');
assert.doesNotMatch(html,/data-action="play-matchday"/,'Posta must take precedence over Match');

world.inbox=world.inbox.filter(message=>message.id!=='required-shell');world.unread=0;
ui.continuing=true;
html=shell(world,ui,'<section>dashboard</section>');
assert.match(html,/data-action="stop-advance"/,'running simulation must switch the action to Stop');

ui.continuing=false;ui.continuationBlocker={type:'board'};
html=shell(world,ui,'<section>dashboard</section>');
assert.match(html,/data-page="board"/,'board blocker must surface Dirigenza in the topbar');

ui.continuationBlocker=null;world.round=world.fixtures.length;
html=shell(world,ui,'<section>dashboard</section>');
assert.match(html,/data-action="new-season"/,'season end must surface New season in the topbar');

console.log('UX20 CROSS SHELL MODEL PASS');
