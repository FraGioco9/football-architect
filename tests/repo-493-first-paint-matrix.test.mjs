import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuditInventory,createAuditMatrix,auditStates,auditActions,competitionTabs} from '../tools/repo-493-first-paint-matrix.mjs';

test('REPO-493: inventory includes every canonical competition tab and all 320x5 club routes',()=>{
 const inventory=createAuditInventory();
 assert.equal(inventory.competitions.length,18);
 assert.equal(inventory.competitions.filter(c=>c.category==='domestic').length,16);
 assert.equal(inventory.competitions.filter(c=>c.category==='international').length,2);
 assert.equal(inventory.competitions.flatMap(c=>c.routes).length,18*competitionTabs.length);
 assert.equal(inventory.allClubRoutes.length,320*5);
 assert.equal(new Set(inventory.allClubRoutes).size,1600);
 for(const competition of inventory.competitions)assert.equal(competition.routes.length,7);
});
test('REPO-493: four distinct world/Debug states and eight actions are inventoried without invented PASS claims',()=>{
 const {inventory,rows}=createAuditMatrix();
 assert.equal(inventory.sampledClubRoutes.length,16*5);
 assert.equal(inventory.sitePaths.length,17);
 assert.equal(inventory.applicationRoutes.length,18*7+16*5+17);
 assert.equal(rows.length,inventory.applicationRoutes.length*auditStates.length*auditActions.length);
 assert.equal(new Set(rows.map(r=>r.route+'|'+r.state+'|'+r.action)).size,rows.length);
 assert.ok(rows.every(r=>r.status==='UNKNOWN'&&r.evidence.includes('Not browser-verified')));
 assert.ok(rows.some(r=>r.route==='/admin/players'&&r.note.includes('Authentication')));
});
